import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@prisma/client';
import { getViewer } from '../lib/auth.js';

export async function attachViewer(req: Request, _res: Response, next: NextFunction) {
  const userId = req.session.userId;
  if (!userId) {
    req.viewer = null;
    next();
    return;
  }

  const viewer = await getViewer(userId);
  req.viewer = viewer;
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.viewer) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication is required.',
      },
    });
    return;
  }
  next();
}

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.viewer) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication is required.',
        },
      });
      return;
    }
    if (!roles.includes(req.viewer.role)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You are not allowed to access this resource.',
        },
      });
      return;
    }
    next();
  };
}
