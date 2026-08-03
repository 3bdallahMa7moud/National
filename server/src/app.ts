import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import session from 'express-session';
import { PrismaSessionStore } from '@quixo3/prisma-session-store';
import { env, isProduction } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { attachViewer } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { bootstrapRouter } from './routes/bootstrap.js';
import { calendarSyncRouter } from './routes/calendarSync.js';
import { departmentsRouter } from './routes/departments.js';
import { employeesRouter } from './routes/employees.js';
import { healthRouter } from './routes/health.js';
import { notificationsRouter } from './routes/notifications.js';
import { overtimeRouter } from './routes/overtime.js';
import { profileRouter } from './routes/profile.js';
import { scheduleRouter } from './routes/schedule.js';
import { shiftRequestsRouter } from './routes/shiftRequests.js';
import { auditRouter } from './routes/audit.js';

function resolveAllowedOrigins(primaryOrigin: string) {
  const allowed = new Set([primaryOrigin]);

  if (!isProduction) {
    try {
      const primaryUrl = new URL(primaryOrigin);
      if (primaryUrl.hostname === 'localhost' || primaryUrl.hostname === '127.0.0.1') {
        const alternateUrl = new URL(primaryOrigin);
        alternateUrl.hostname = primaryUrl.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
        allowed.add(alternateUrl.origin);
      }
    } catch {
      // Ignore malformed environment origins; Zod validation handles the primary value.
    }
  }

  return allowed;
}

export function createApp() {
  const app = express();
  const allowedOrigins = resolveAllowedOrigins(env.APP_ORIGIN);
  const sessionStore = isProduction
    ? new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000,
      dbRecordIdIsSessionId: true,
    })
    : new session.MemoryStore();

  app.use(cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      callback(null, allowedOrigins.has(origin));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());
  app.use(session({
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
    name: 'sid',
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
  }));
  app.use(attachViewer);

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/bootstrap', bootstrapRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/departments', departmentsRouter);
  app.use('/api/employees', employeesRouter);
  app.use('/api/schedule', scheduleRouter);
  app.use('/api/overtime', overtimeRouter);
  app.use('/api/shift-requests', shiftRequestsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/calendar-sync', calendarSyncRouter);

  app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    void next;
    const message = error instanceof Error ? error.message : 'Internal server error.';
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: isProduction ? 'Internal server error.' : message,
      },
    });
  });

  return app;
}
