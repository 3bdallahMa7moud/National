import type { UserRole } from './employee';

export type NotificationAudience =
  | { kind: 'account'; accountId: string }
  | { kind: 'departmentRole'; role: UserRole; departmentId: string }
  | { kind: 'broadcast' };

export type NotificationType =
  | 'shift_change'
  | 'oncall_assignment'
  | 'overtime_assignment'
  | 'schedule_published'
  | 'shift_request_received'
  | 'shift_request_submitted'
  | 'shift_request_recipient_accepted'
  | 'shift_request_approved'
  | 'shift_request_rejected'
  | 'shift_request_stale'
  | 'shift_request_cancelled'
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
  audience?: NotificationAudience;
  dedupeKey?: string;
  titleKey?: string;
  messageKey?: string;
  params?: Record<string, string | number>;
  /** Per-account delivery state for shared department-role or broadcast notifications. */
  readByAccountIds?: string[];
  deletedForAccountIds?: string[];
}

export type TargetedNotificationDraft = Omit<
  AppNotification,
  'id' | 'createdAt' | 'isRead' | 'readByAccountIds' | 'deletedForAccountIds'
> & {
  isRead?: boolean;
};
