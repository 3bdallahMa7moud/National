import { describe, expect, it } from 'vitest';
import { getNotificationTargetUrl } from './notificationNavigation';
import type { AppNotification } from '@/types/notification';
import type { AuthUser } from '@/types';

const adminUser: AuthUser = {
  id: 'admin-1',
  name: 'Admin User',
  email: 'admin@example.test',
  role: 'admin',
  departmentId: 'dept-1',
  departmentName: 'CT Scan',
};

const employeeUser: AuthUser = {
  id: 'emp-1',
  name: 'Employee User',
  email: 'employee@example.test',
  role: 'employee',
  departmentId: 'dept-1',
  departmentName: 'CT Scan',
};

describe('notificationNavigation', () => {
  it('resolves explicit actionUrls mapped according to user role', () => {
    const notification: AppNotification = {
      id: 'notif-1',
      type: 'shift_change',
      title: 'Shift Change',
      message: 'Updated shift',
      isRead: false,
      isUrgent: false,
      actionUrl: '/schedule',
      createdAt: '2026-07-26T00:00:00.000Z',
    };

    expect(getNotificationTargetUrl(notification, adminUser)).toBe('/admin/schedule');
    expect(getNotificationTargetUrl(notification, employeeUser)).toBe('/schedule/me');
  });

  it('handles shift request notifications without actionUrl', () => {
    const notification: AppNotification = {
      id: 'notif-2',
      type: 'shift_request_received',
      title: 'New Request',
      message: 'You received a request',
      isRead: false,
      isUrgent: true,
      relatedRequestId: 'req-123',
      createdAt: '2026-07-26T00:00:00.000Z',
    };

    expect(getNotificationTargetUrl(notification, adminUser)).toBe('/admin/shift-requests?requestId=req-123');
    expect(getNotificationTargetUrl(notification, employeeUser)).toBe('/shift-requests?requestId=req-123');
  });

  it('handles overtime assignment notifications without actionUrl', () => {
    const notification: AppNotification = {
      id: 'notif-3',
      type: 'overtime_assignment',
      title: 'Overtime',
      message: 'Overtime assigned',
      isRead: false,
      isUrgent: false,
      createdAt: '2026-07-26T00:00:00.000Z',
    };

    expect(getNotificationTargetUrl(notification, adminUser)).toBe('/admin/late-schedule');
    expect(getNotificationTargetUrl(notification, employeeUser)).toBe('/schedule/me?tab=ot');
  });
});
