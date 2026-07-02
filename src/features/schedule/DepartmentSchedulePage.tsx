import { useState } from 'react';
import Card from '@/components/ui/Card';
import ScheduleCalendar from './ScheduleCalendar';
import { useSchedule } from '@/hooks/useSchedule';
import { mockEmployees } from '@/mocks/mockData';

export default function DepartmentSchedulePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const { shifts } = useSchedule(undefined, month, year);
  const employees = mockEmployees.filter(e => e.role === 'employee');

  const handlePrevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const handleNextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">جدول القسم</h1>
        <p className="mt-1 text-sm leading-6 text-text-secondary">عرض جدول شيفتات جميع موظفي قسم الأشعة المقطعية</p>
      </div>

      <Card padding={false} className="overflow-hidden p-3 sm:p-4">
        <ScheduleCalendar
          shifts={shifts}
          employees={employees}
          mode="matrix"
          editable={false}
          year={year}
          month={month}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
        />
      </Card>
    </div>
  );
}
