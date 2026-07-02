import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { mockNotifications } from '@/mocks/mockData';
import { Bell, CheckCheck, Trash2, Filter, AlertTriangle } from 'lucide-react';
import type { AppNotification } from '@/types';
import dayjs from '@/lib/dayjs';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>(mockNotifications);
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent'>('all');

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'urgent') return n.isUrgent;
    return true;
  });

  const handleMarkRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleDelete = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">التنبيهات والإشعارات</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            إشعارات فورية بالتكليفات، التبديلات، التحديثات، ونوبات الطوارئ (On-Call)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleMarkAllRead} icon={<CheckCheck className="w-4 h-4" />}>
            تحديد الكل كمقروء
          </Button>
        </div>
      </div>

      <Card>
        {/* Filter Tabs */}
        <div className="mb-5 flex items-center gap-2 overflow-x-auto border-b border-border pb-4">
          <Filter className="w-4 h-4 text-text-secondary flex-shrink-0" />
          {[
            { id: 'all', label: 'جميع الإشعارات', count: notifications.length },
            { id: 'unread', label: 'غير مقروءة', count: notifications.filter((n) => !n.isRead).length },
            { id: 'urgent', label: 'تنبيهات الطوارئ والعمل الإضافي', count: notifications.filter((n) => n.isUrgent).length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as 'all' | 'unread' | 'urgent')}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-btn px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === tab.id
                  ? 'bg-primary-50 text-primary ring-1 ring-primary/15'
                  : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${filter === tab.id ? 'bg-white text-primary' : 'bg-gray-200 text-gray-700'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="divide-y divide-border/60">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-text-secondary">
              <Bell className="w-10 h-10 mx-auto text-gray-300 mb-2" />
              <p className="text-base font-medium">لا توجد إشعارات حالياً في هذا القسم</p>
            </div>
          ) : (
            filtered.map((notif) => (
              <div
                key={notif.id}
                onClick={() => !notif.isRead && handleMarkRead(notif.id)}
                className={`flex cursor-pointer items-start justify-between gap-4 rounded-card px-3 py-4 transition-colors ${
                  !notif.isRead ? 'bg-primary-50/40 font-medium' : 'hover:bg-gray-50'
                } ${notif.isUrgent && !notif.isRead ? 'border-s-4 border-danger bg-danger-50/30' : ''}`}
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className={`mt-0.5 flex-shrink-0 rounded-btn p-2 ${
                    notif.isUrgent ? 'bg-danger text-white' : 'bg-primary-50 text-primary'
                  }`}>
                    {notif.isUrgent ? <AlertTriangle className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-text-primary">{notif.title}</h4>
                      {notif.isUrgent && (
                        <span className="bg-danger text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                          طوارئ / عاجل
                        </span>
                      )}
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="text-xs text-text-secondary mt-1 leading-relaxed">{notif.message}</p>

                    {(notif.oldShiftType || notif.newShiftType) && (
                      <div className="flex items-center gap-2 mt-2 text-xs bg-white p-2 rounded border border-border/60 w-fit">
                        {notif.oldShiftType && <span className="text-text-secondary font-medium">من: {notif.oldShiftType}</span>}
                        {notif.oldShiftType && notif.newShiftType && <span className="text-text-secondary">←</span>}
                        {notif.newShiftType && <span className="text-primary font-bold">إلى: {notif.newShiftType}</span>}
                      </div>
                    )}
                    <span className="text-[10px] text-text-secondary mt-2 block">{dayjs(notif.createdAt).fromNow()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(notif.id); }}
                    className="p-1.5 rounded hover:bg-danger-50 text-text-secondary hover:text-danger transition-colors"
                    title="حذف الإشعار"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
