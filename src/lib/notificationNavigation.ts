import type { AppNotification } from '@/types/notification';
import type { AuthUser } from '@/types';
import { isAdminOrSuperAdmin } from '@/types';

/**
 * Resolves the destination URL for any given notification based on its actionUrl,
 * type, related request ID, and the current user's role (admin/super_admin vs employee).
 */
export function getNotificationTargetUrl(
  notification: AppNotification,
  user?: AuthUser | null,
): string {
  const isAdmin = isAdminOrSuperAdmin(user);
  const rawUrl = notification.actionUrl?.trim();

  if (rawUrl) {
    // Preserve query parameters if present in rawUrl
    const [pathname, queryString] = rawUrl.split('?');
    const query = queryString ? `?${queryString}` : '';

    if (isAdmin) {
      if (pathname === '/schedule') return `/admin/schedule${query}`;
      if (pathname === '/late-schedule') return `/admin/late-schedule${query}`;
      if (pathname === '/employees') return `/admin/employees${query}`;
      if (pathname === '/shift-requests') return `/admin/shift-requests${query}`;
      if (pathname === '/departments') return `/admin/departments${query}`;
      if (pathname === '/reports') return `/admin/reports${query}`;
      if (pathname === '/audit-log') return `/admin/audit-log${query}`;
      if (pathname === '/employee-justification') return `/admin/employee-justification${query}`;
      if (pathname === '/dashboard') return `/admin/dashboard${query}`;
    } else {
      if (pathname === '/schedule' || pathname === '/admin/schedule') return `/schedule/me${query}`;
      if (pathname === '/late-schedule' || pathname === '/admin/late-schedule') return `/schedule/me?tab=ot${query ? `&${queryString}` : ''}`;
      if (pathname === '/employees' || pathname === '/admin/employees') return `/profile${query}`;
      if (pathname === '/admin/shift-requests') return `/shift-requests${query}`;
      if (pathname === '/admin/departments' || pathname === '/admin/reports' || pathname === '/admin/audit-log') {
        return `/employee/dashboard${query}`;
      }
      if (pathname === '/dashboard' || pathname === '/admin/dashboard') return `/employee/dashboard${query}`;
    }

    return rawUrl;
  }

  // Fallback routing when actionUrl is missing
  switch (notification.type) {
    case 'shift_request_received':
    case 'shift_request_submitted':
    case 'shift_request_recipient_accepted':
    case 'shift_request_approved':
    case 'shift_request_rejected':
    case 'shift_request_stale':
    case 'shift_request_cancelled': {
      const baseUrl = isAdmin ? '/admin/shift-requests' : '/shift-requests';
      return notification.relatedRequestId
        ? `${baseUrl}?requestId=${encodeURIComponent(notification.relatedRequestId)}`
        : baseUrl;
    }

    case 'overtime_assignment':
      return isAdmin ? '/admin/late-schedule' : '/schedule/me?tab=ot';

    case 'shift_change':
    case 'oncall_assignment':
    case 'schedule_published':
      return isAdmin ? '/admin/schedule' : '/schedule/me';

    case 'general':
    default:
      return isAdmin ? '/admin/dashboard' : '/employee/dashboard';
  }
}
