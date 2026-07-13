import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import EmployeeScheduleMonth from './EmployeeScheduleMonth';
import EmployeeScheduleWeek from './EmployeeScheduleWeek';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import { buildEmployeeScheduleView } from '@/lib/employeeScheduleView';
import { useAuthStore } from '@/stores/authStore';
import { useEmployeeRosterStore } from '@/stores/employeeRosterStore';
import { useLateScheduleStore } from '@/stores/lateScheduleStore';
import { useScheduleMatrixStore } from '@/stores/scheduleMatrixStore';
import type { OperationalOccurrence } from '@/types/operationalSchedule';

type ViewMode = 'week' | 'month';
function fmt(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

export default function EmployeeSchedulePage() {
  const { t, i18n } = useTranslation('schedule');
  const [mode, setMode] = useState<ViewMode>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState<OperationalOccurrence | null>(null);
  const user = useAuthStore((state) => state.user);
  const roster = useEmployeeRosterStore((state) => state.employees);
  const matrices = useScheduleMatrixStore((state) => state.matricesByMonth);
  const otMonths = useLateScheduleStore((state) => state.rowsByMonth);

  if (!user?.scheduleEmployeeId) return <Card className="mx-auto max-w-2xl py-10 text-center"><h1 className="text-xl font-semibold text-text-primary">{t('employeeView.unlinked')}</h1><p className="mt-2 text-sm text-text-secondary">{t('employeeView.unlinkedHint')}</p></Card>;

  const start = mode === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth(), 1) : new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - anchor.getDay());
  const end = mode === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0) : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const view = buildEmployeeScheduleView(user.scheduleEmployeeId, { startDate: fmt(start), endDate: fmt(end) }, matrices, otMonths, roster, fmt(new Date()));
  const move = (direction: number) => setAnchor((current) => mode === 'month' ? new Date(current.getFullYear(), current.getMonth() + direction, 1) : new Date(current.getFullYear(), current.getMonth(), current.getDate() + direction * 7));
  const title = mode === 'month' ? new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(start) : `${new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric' }).format(start)} – ${new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' }).format(end)}`;

  return <div className="space-y-5"><header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-xl font-semibold text-text-primary sm:text-2xl">{t('employeeView.title')}</h1><p className="mt-1 text-sm text-text-secondary">{t('employeeView.subtitle')}</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant={mode === 'week' ? 'primary' : 'secondary'} aria-pressed={mode === 'week'} aria-label={t('employeeView.weekView')} onClick={() => setMode('week')} icon={<List className="h-4 w-4" />}>{t('employeeView.week')}</Button><Button type="button" variant={mode === 'month' ? 'primary' : 'secondary'} aria-pressed={mode === 'month'} aria-label={t('employeeView.monthView')} onClick={() => setMode('month')} icon={<CalendarDays className="h-4 w-4" />}>{t('employeeView.month')}</Button></div></header><div className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface p-3 shadow-card"><Button type="button" variant="ghost" aria-label={t('employeeView.previous')} onClick={() => move(-1)} className="min-h-11 min-w-11 px-2"><ChevronLeft className="h-5 w-5 rtl:rotate-180" /></Button><h2 className="text-center font-semibold text-text-primary">{title}</h2><Button type="button" variant="ghost" aria-label={t('employeeView.next')} onClick={() => move(1)} className="min-h-11 min-w-11 px-2"><ChevronRight className="h-5 w-5 rtl:rotate-180" /></Button></div>{view.availability === 'missing' ? <Card className="py-10 text-center"><p className="font-medium text-text-primary">{t('employeeView.missing')}</p></Card> : mode === 'week' ? <EmployeeScheduleWeek days={view.days} locale={i18n.language} onSelect={setSelected} /> : <EmployeeScheduleMonth days={view.days} locale={i18n.language} onSelect={setSelected} />}<Modal isOpen={!!selected} onClose={() => setSelected(null)} title={t('employeeView.details')} size="sm">{selected && <div className="space-y-3 text-sm"><p className="text-lg font-semibold text-text-primary">{t(`employeeView.categories.${selected.category}`)}</p><p className="text-text-secondary">{selected.facility} · {selected.unit}</p><p className="font-medium text-text-primary" dir="ltr">{selected.timeRange}</p><p className="text-text-secondary">{selected.source === 'ot' ? 'OT' : t('employeeView.scheduleSource')}</p>{selected.category === 'ot' && <p className="text-text-secondary">{t('employeeView.hours', { count: selected.hours })}</p>}</div>}</Modal></div>;
}
