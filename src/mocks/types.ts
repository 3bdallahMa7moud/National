import type { LocalizedText } from '@/types/localized';
import type { ShiftTypeKey } from '@/types';
import type { UserRole } from '@/types/employee';
import type { NotificationType } from '@/types/notification';
import type { AuditAction, AuditEntityType } from '@/types/audit';

export interface MockDepartmentSource {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  managerId?: string;
  employeeCount?: number;
}

export interface MockShiftTypeSource {
  id: string;
  key: ShiftTypeKey;
  label: LocalizedText;
  color: string;
  startTime: string;
  endTime: string;
  hours: number;
}

export interface MockEmployeeSource {
  id: string;
  name: LocalizedText;
  email: string;       // can be empty string '' if employee hasn't set it yet
  phone: string;
  role: UserRole;
  departmentId: string;
  departmentName: LocalizedText;
  position: LocalizedText;
  employeeNumber: string;
  code: string;        // الاختصار (abbreviation, e.g. AH, MK)
  avatar?: string;
  isActive: boolean;
  createdAt: string;
  scheduleEmployeeId?: string;
}

export interface MockNotificationSource {
  id: string;
  type: NotificationType;
  title: LocalizedText;
  message: LocalizedText;
  oldShiftTypeKey?: ShiftTypeKey;
  newShiftTypeKey?: ShiftTypeKey;
  isRead: boolean;
  isUrgent: boolean;
  createdAt: string;
}

export interface MockAuditLogSource {
  id: string;
  userId: string;
  userName: LocalizedText;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  description: LocalizedText;
  oldValue?: LocalizedText;
  newValue?: LocalizedText;
  timestamp: string;
}
