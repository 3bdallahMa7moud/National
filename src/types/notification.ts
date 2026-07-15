import type { UserRole } from './employee';

export type NotificationType =
  | 'shift_change'
  | 'oncall_assignment'
  | 'overtime_assignment'
  | 'schedule_published'
  | 'shift_request_received'
  | 'shift_request_recipient_accepted'
  | 'shift_request_approved'
  | 'shift_request_rejected'
  | 'shift_request_stale'
  | 'general';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  oldShiftType?: string;
  newShiftType?: string;
  oldDate?: string;
  newDate?: string;
  isRead: boolean;
  isUrgent: boolean;
  actionUrl?: string;
  createdAt: string;
  recipientAccountId?: string;
  recipientRole?: UserRole;
  departmentId?: string;
  relatedRequestId?: string;
}

export type TargetedNotificationDraft = Omit<AppNotification, 'id' | 'createdAt' | 'isRead'> & {
  isRead?: boolean;
};
