import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import DepartmentScheduleDesktop from './DepartmentScheduleDesktop';
import DepartmentScheduleMobile from './DepartmentScheduleMobile';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { buildDepartmentScheduleView, filterDepartmentScheduleView } from '@/lib/employeeScheduleView';
import { useAuthStore } from '@/stores/authStore';
import { useEmployeeRosterStore } from '@/stores/employeeRosterStore';
import { useLateScheduleStore } from '@/stores/lateScheduleStore';
import { useScheduleMatrixStore } from '@/stores/scheduleMatrixStore';
import type { DepartmentScheduleFilters } from '@/types/employeeScheduleView';

type ViewMode = 'week' | 'month';
function fmt(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

export default function DepartmentSchedulePage() {
  const { t, i18n } = useTranslation('schedule');
  const [mode, setMode] = useState<ViewMode>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [filters, setFilters] = useState<DepartmentScheduleFilters>({ facility: 'all', category: 'all' });
  const user = useAuthStore((state) => state.user);
  const roster = useEmployeeRosterStore((state) => state.employees);
  const matrices = useScheduleMatrixStore((state) => state.matricesByMonth);
  const otMonths = useLateScheduleStore((state) => state.rowsByMonth);
  const start = mode === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth(), 1) : new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - anchor.getDay());
  const end = mode === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0) : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const fullView = buildDepartmentScheduleView({ startDate: fmt(start), endDate: fmt(end) }, matrices, otMonths, roster);
  const view = filterDepartmentScheduleView(fullView, filters);
  const move = (direction: number) => setAnchor((current) => mode === 'month' ? new Date(current.getFullYear(), current.getMonth() + direction, 1) : new Date(current.getFullYear(), current.getMonth(), current.getDate() + direction * 7));

  return <div className="space-y-5"><header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><h1 className="text-xl font-semibold text-text-primary sm:text-2xl">{t('department.title')}</h1><p className="mt-1 text-sm text-text-secondary">{t('departmentView.subtitle')}</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant={mode === 'week' ? 'primary' : 'secondary'} aria-pressed={mode === 'week'} onClick={() => setMode('week')} icon={<List className="h-4 w-4" />}>{t('employeeView.week')}</Button><Button type="button" variant={mode === 'month' ? 'primary' : 'secondary'} aria-pressed={mode === 'month'} onClick={() => setMode('month')} icon={<CalendarDays className="h-4 w-4" />}>{t('employeeView.month')}</Button></div></header><Card className="p-4 sm:p-4"><div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end"><label className="text-xs font-medium text-text-secondary"><span className="mb-1.5 block">{t('departmentView.facilityFilter')}</span><select aria-label={t('departmentView.facilityFilter')} value={filters.facility} onChange={(event) => setFilters((current) => ({ ...current, facility: event.target.value }))} className="input-field min-h-11"><option value="all">{t('departmentView.allFacilities')}</option>{fullView.facilities.map((facility) => <option key={facility} value={facility}>{facility}</option>)}</select></label><label className="text-xs font-medium text-text-secondary"><span className="mb-1.5 block">{t('departmentView.shiftFilter')}</span><select aria-label={t('departmentView.shiftFilter')} value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value as DepartmentScheduleFilters['category'] }))} className="input-field min-h-11"><option value="all">{t('departmentView.allShifts')}</option>{['day', 'late', 'night', 'onCallDay', 'onCallNight', 'ot'].map((category) => <option key={category} value={category}>{t(`departmentView.categories.${category}`)}</option>)}</select></label><div className="flex items-center justify-between gap-2"><Button type="button" variant="ghost" aria-label={t('employeeView.previous')} onClick={() => move(-1)} className="min-h-11 min-w-11 px-2"><ChevronLeft className="h-5 w-5 rtl:rotate-180" /></Button><span className="min-w-36 text-center text-sm font-semibold text-text-primary">{new Intl.DateTimeFormat(i18n.language, mode === 'month' ? { month: 'long', year: 'numeric' } : { month: 'short', day: 'numeric' }).format(start)}</span><Button type="button" variant="ghost" aria-label={t('employeeView.next')} onClick={() => move(1)} className="min-h-11 min-w-11 px-2"><ChevronRight className="h-5 w-5 rtl:rotate-180" /></Button></div></div></Card>{fullView.availability === 'missing' ? <Card className="py-10 text-center"><p className="font-medium text-text-primary">{t('departmentView.missing')}</p></Card> : view.occurrences.length === 0 ? <Card className="py-10 text-center"><p className="font-medium text-text-primary">{t('departmentView.noResults')}</p></Card> : <><DepartmentScheduleDesktop view={view} locale={i18n.language} selfEmployeeId={user?.scheduleEmployeeId} /><DepartmentScheduleMobile view={view} locale={i18n.language} selfEmployeeId={user?.scheduleEmployeeId} /></>}</div>;
}
