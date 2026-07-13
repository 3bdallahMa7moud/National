export type UserRole = 'admin' | 'employee';

export interface JobTitleOption {
  id: string;
  ar: string;
  en: string;
}

export const JOB_TITLE_OPTIONS: JobTitleOption[] = [
  { id: 'ct-tech-1', ar: 'فني أشعة مقطعية أول (CT Tech I)', en: 'CT Tech I' },
  { id: 'ct-tech-2', ar: 'فني أشعة مقطعية ثان (CT Tech II)', en: 'CT Tech II' },
  { id: 'supervisor', ar: 'مشرف', en: 'Supervisor' },
];

export function findJobTitleOption(value?: string): JobTitleOption {
  if (!value) return JOB_TITLE_OPTIONS[0];
  return (
    JOB_TITLE_OPTIONS.find(
      (opt) => opt.id === value || opt.ar === value || opt.en === value
    ) ?? JOB_TITLE_OPTIONS[0]
  );
}

export interface Employee {
  id: string;
  name: string;        // username (full name displayed as username)
  email: string;       // optional, set by employee from profile
  phone: string;
  role: UserRole;
  departmentId: string;
  departmentName?: string;
  position: string;
  employeeNumber: string;
  code: string;        // الاختصار (e.g. AH, MK)
  avatar?: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: string;
  departmentName: string;
  code?: string;
  avatar?: string;
  /** Explicit link to the official operational roster; never infer this from account text. */
  scheduleEmployeeId?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
