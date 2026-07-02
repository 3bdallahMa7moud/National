export type NotificationType = 'shift_change' | 'oncall_assignment' | 'overtime_assignment' | 'schedule_published' | 'general';

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
  createdAt: string;
}
