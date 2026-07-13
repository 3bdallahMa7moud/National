import { CalendarClock, Clock3, Users, Workflow } from 'lucide-react';

interface LateScheduleStatsProps {
  isRtl: boolean;
  shiftRows: number;
  assignments: number;
  hours: number;
  employees: number;
}

export default function LateScheduleStats({ isRtl, shiftRows, assignments, hours, employees }: LateScheduleStatsProps) {
  const items = [
    { label: isRtl ? 'صفوف OT' : 'OT shift rows', value: shiftRows, icon: Workflow, tone: 'text-pink-700 dark:text-pink-300 bg-pink-500/10' },
    { label: isRtl ? 'التعيينات' : 'Assignments', value: assignments, icon: CalendarClock, tone: 'text-cyan-700 dark:text-cyan-300 bg-cyan-500/10' },
    { label: isRtl ? 'ساعات OT' : 'OT hours', value: hours, icon: Clock3, tone: 'text-amber-700 dark:text-amber-300 bg-amber-500/10' },
    { label: isRtl ? 'الموظفون' : 'Employees', value: employees, icon: Users, tone: 'text-teal-700 dark:text-teal-300 bg-teal-500/10' },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={isRtl ? 'إحصائيات OT' : 'OT statistics'}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <article key={item.label} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.tone}`}><Icon className="h-5 w-5" /></span>
            <span className="min-w-0"><span className="block text-xl font-bold text-text-primary">{item.value}</span><span className="block truncate text-xs text-text-secondary">{item.label}</span></span>
          </article>
        );
      })}
    </section>
  );
}
