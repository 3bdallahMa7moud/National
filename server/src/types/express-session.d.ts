import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    role?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      viewer: {
        id: string;
        employeeNumber: string;
        code: string;
        role: 'super_admin' | 'admin' | 'employee';
        email: string;
        phone: string;
        isActive: boolean;
        scheduleEmployeeId?: string;
        name: { en: string; ar: string };
        department: { id: string; name: { en: string; ar: string } };
        position: { en: string; ar: string };
        access: {
          templateId: 'standard' | 'view_only' | 'coordinator';
          overrides: Record<string, boolean>;
          active: boolean;
          updatedAt: string;
          updatedBy: string;
        } | null;
      } | null;
    }
  }
}

export {};
