import { useState } from 'react';
import Card from '@/components/ui/Card';
import ScheduleCalendar from './ScheduleCalendar';
import { useSchedule } from '@/hooks/useSchedule';
import { useAuthStore } from '@/stores/authStore';
import ShiftBadge from '@/components/common/ShiftBadge';
import { mockShiftTypes } from '@/mocks/mockData';
import type { Shift, ShiftTypeKey } from '@/types';
import Modal from '@/components/ui/Modal';
import { formatTime } from '@/lib/utils';

export default function EmployeeSchedulePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const user = useAuthStore((s) => s.user);
  const { shifts } = useSchedule(user?.id, month, year);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

  const handlePrevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const handleNextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Summary stats
  const shiftCounts = mockShiftTypes.reduce((acc, st) => {
    acc[st.key] = shifts.filter(s => s.shiftType === st.key).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">جدولي الشخصي</h1>
        <p className="mt-1 text-sm leading-6 text-text-secondary">مرحباً {user?.name}، هذا جدول شيفتاتك</p>
      </div>

      {/* Shift summary */}
      <div className="flex flex-wrap gap-2">
        {mockShiftTypes.map((st) => (
          shiftCounts[st.key] > 0 && (
            <div key={st.id} className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 shadow-soft">
              <ShiftBadge type={st.key as ShiftTypeKey} size="sm" />
              <span className="text-xs font-medium text-text-primary">{shiftCounts[st.key]}</span>
            </div>
          )
        ))}
      </div>

      <Card padding={false} className="p-3 sm:p-4">
        <ScheduleCalendar
          shifts={shifts}
          mode="personal"
          year={year}
          month={month}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onCellShiftClick={setSelectedShift}
        />
      </Card>

      {/* Shift Detail Modal */}
      <Modal isOpen={!!selectedShift} onClose={() => setSelectedShift(null)} title="تفاصيل الشيفت" size="sm">
        {selectedShift && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <ShiftBadge type={selectedShift.shiftType as ShiftTypeKey} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-text-secondary text-xs">التاريخ</p>
                <p className="font-medium">{new Date(selectedShift.date).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <div>
                <p className="text-text-secondary text-xs">الوقت</p>
                <p className="font-medium">{formatTime(selectedShift.startTime)} - {formatTime(selectedShift.endTime)}</p>
              </div>
              <div>
                <p className="text-text-secondary text-xs">الحالة</p>
                <p className="font-medium">{selectedShift.status === 'completed' ? 'مكتمل' : selectedShift.status === 'scheduled' ? 'مجدول' : selectedShift.status}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
