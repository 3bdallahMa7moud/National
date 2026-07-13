// ============================================================
// MatrixStatsCards — Premium Human-Crafted Interactive KPI Bar
// ============================================================

import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Sun,
  Sunset,
  Moon,
  Palmtree,
  PhoneCall,
  Timer,
  TrendingUp,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { filterActiveScheduleRows } from '@/lib/scheduleMatrixArchive';
import { getShiftChipStyle } from '@/components/schedule/ScheduleMatrix/getShiftChipClasses';
import type { ScheduleMatrixData, ShiftColorKey } from '@/types/scheduleMatrix';

interface StatItem {
  id: string;
  filterKey?: ShiftColorKey | '';
  label: string;
  value: number;
  subLabel?: string;
  percent?: number;
  icon: React.ReactNode;
  accentBar: string;
  iconBox: string;
  activeRing: string;
  textColor: string;
  paletteKey?: ShiftColorKey;
}

interface StatCardProps {
  item: StatItem;
  isActive: boolean;
  isRtl: boolean;
  locale: string;
  onClick: () => void;
}

function StatCard({ item, isActive, isRtl, locale, onClick }: StatCardProps) {
  const paletteStyle = item.paletteKey ? getShiftChipStyle(item.paletteKey) : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-2xl text-start w-full',
        'border transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        'min-h-44 p-4 cursor-pointer select-none',
        isActive
          ? cn('bg-slate-50/95 dark:bg-slate-800/90 shadow-md', item.activeRing)
          : 'border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md hover:-translate-y-0.5 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700'
      )}
      style={isActive && paletteStyle ? { borderColor: paletteStyle.borderColor } : undefined}
      title={isRtl ? `اضغط لتصفية الجدول حسب: ${item.label}` : `Click to filter table by: ${item.label}`}
    >
      {/* Top delicate colored accent bar */}
      <div
        className={cn(
          'absolute top-0 inset-x-0 h-1 transition-opacity duration-300',
          isActive ? 'opacity-100 h-1.5' : 'opacity-85 group-hover:opacity-100',
          item.accentBar
        )}
        style={paletteStyle ? { backgroundColor: paletteStyle.backgroundColor } : undefined}
      />

      {/* Top Row: Icon badge & status badge */}
      <div className="flex items-center justify-between gap-2 mb-3 w-full">
        <div
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105',
            item.iconBox
          )}
          style={paletteStyle}
        >
          {item.icon}
        </div>

        <div className="flex items-center gap-1.5">
          {isActive ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-tight',
                'bg-primary text-white shadow-sm animate-pulse'
              )}
            >
              <CheckCircle2 className="h-3 w-3" />
              <span>{isRtl ? 'مفلتر بالجدول' : 'Filtered'}</span>
            </span>
          ) : item.percent !== undefined ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-tight',
                'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors'
              )}
            >
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span dir="ltr">{item.percent}%</span>
            </span>
          ) : null}
        </div>
      </div>

      {/* Center: Numeric Value & Primary Label */}
      <div className="space-y-1 my-0.5 w-full">
        <div className="flex items-baseline gap-1.5">
          <span className={cn('text-2xl font-black tracking-tight font-mono', item.textColor)} style={paletteStyle ? { color: paletteStyle.color } : undefined}>
            {new Intl.NumberFormat(locale).format(item.value)}
          </span>
        </div>
        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
          {item.label}
        </h4>
      </div>

      {/* Footer: Subtle secondary context sublabel */}
      {item.subLabel && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between w-full">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-300 truncate">
            {item.subLabel}
          </span>
          <Filter className={cn('h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity', isActive && 'opacity-100 text-primary')} />
        </div>
      )}
    </button>
  );
}

interface MatrixStatsCardsProps {
  data: ScheduleMatrixData;
  activeShiftFilter?: ShiftColorKey | '';
  onSelectFilter?: (filterKey: ShiftColorKey | '') => void;
}

function MatrixStatsCards({
  data,
  activeShiftFilter = '',
  onSelectFilter,
}: MatrixStatsCardsProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const locale = isRtl ? 'ar-SA' : 'en-US';

  const stats = useMemo(() => {
    let morningShifts = 0;
    let eveningShifts = 0;
    let nightShifts = 0;
    let onCallDay = 0;
    let onCallNight = 0;
    let overtime = 0;

    data.facilities.forEach(fac => {
      const facilitySettings = data.settings.find((settings) => settings.facilityId === fac.id);
      fac.units.forEach(unit => {
        const unitDefinition = facilitySettings?.units.find((definition) => definition.id === unit.id);
        if (unit.archived || unitDefinition?.archived) return;

        filterActiveScheduleRows(data, fac.id, unit.rows).forEach(row => {
          Object.values(row.cellsByDay).forEach(assignments => {
            const count = assignments.length;
            if (row.colorKey === 'morning') morningShifts += count;
            else if (row.colorKey === 'evening') eveningShifts += count;
            else if (row.colorKey === 'night') nightShifts += count;
            else if (row.colorKey === 'onCall') onCallDay += count;
            else if (row.colorKey === 'onCallNight') onCallNight += count;
            else if (row.colorKey === 'overtime') overtime += count;
            else {
              const lower = (row.shiftLabel || row.unitLabel || '').toLowerCase();
              if (lower.includes('morning') || lower.includes('صباح')) morningShifts += count;
              else if (lower.includes('evening') || lower.includes('مساء')) eveningShifts += count;
              else if (lower.includes('night') || lower.includes('ليل')) nightShifts += count;
              else if (lower.includes('oncall') || lower.includes('طلب')) onCallDay += count;
              else morningShifts += count;
            }
          });
        });
      });
    });

    const totalEmployees = data.legend.length;
    let vacations = 0;
    if (data.vacations && data.vacations.length > 0) {
      data.vacations.forEach((vacation) => {
        vacations += vacation.daysOff.length;
      });
    }

    const totalShifts = morningShifts + eveningShifts + nightShifts + onCallDay + onCallNight + overtime;

    return {
      totalEmployees,
      morningShifts,
      eveningShifts,
      nightShifts,
      vacations,
      onCallDay,
      onCallNight,
      overtime,
      totalShifts: totalShifts > 0 ? totalShifts : 1,
    };
  }, [data]);

  const cards: StatItem[] = [
    {
      id: 'employees',
      filterKey: '',
      label: isRtl ? 'إجمالي الكادر الفني' : 'Total Employees',
      value: stats.totalEmployees,
      subLabel: isRtl ? 'عرض كل الصفوف' : 'Show all rows',
      icon: <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
      accentBar: 'bg-gradient-to-r from-blue-500 to-indigo-500',
      iconBox: 'bg-blue-50 border border-blue-100 dark:bg-blue-950/50 dark:border-blue-900/60',
      activeRing: 'border-blue-500 ring-2 ring-blue-500/30 dark:border-blue-400',
      textColor: 'text-slate-900 dark:text-white',
    },
    {
      id: 'morning',
      filterKey: 'morning',
      label: isRtl ? 'الشفت النهاري' : 'Day Shift',
      value: stats.morningShifts,
      percent: Math.round((stats.morningShifts / stats.totalShifts) * 100),
      subLabel: isRtl ? 'فلترة صفوف الشفت النهاري' : 'Filter day-shift rows',
      icon: <Sun className="h-4 w-4 text-amber-500 dark:text-amber-400" />,
      accentBar: 'bg-gradient-to-r from-amber-400 to-orange-500',
      iconBox: 'bg-amber-50 border border-amber-100 dark:bg-amber-950/50 dark:border-amber-900/60',
      activeRing: 'border-amber-500 ring-2 ring-amber-500/30 dark:border-amber-400',
      textColor: 'text-slate-900 dark:text-white',
      paletteKey: 'morning',
    },
    {
      id: 'evening',
      filterKey: 'evening',
      label: isRtl ? 'الشفت المتأخر' : 'Late Shift',
      value: stats.eveningShifts,
      percent: Math.round((stats.eveningShifts / stats.totalShifts) * 100),
      subLabel: isRtl ? 'فلترة صفوف الشفت المتأخر' : 'Filter late-shift rows',
      icon: <Sunset className="h-4 w-4 text-orange-500 dark:text-orange-400" />,
      accentBar: 'bg-gradient-to-r from-orange-500 to-rose-500',
      iconBox: 'bg-orange-50 border border-orange-100 dark:bg-orange-950/50 dark:border-orange-900/60',
      activeRing: 'border-orange-500 ring-2 ring-orange-500/30 dark:border-orange-400',
      textColor: 'text-slate-900 dark:text-white',
      paletteKey: 'evening',
    },
    {
      id: 'night',
      filterKey: 'night',
      label: isRtl ? 'الشفت الليلي' : 'Night Shift',
      value: stats.nightShifts,
      percent: Math.round((stats.nightShifts / stats.totalShifts) * 100),
      subLabel: isRtl ? 'فلترة النوبة الليلية' : 'Filter night rows',
      icon: <Moon className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />,
      accentBar: 'bg-gradient-to-r from-indigo-500 to-violet-600',
      iconBox: 'bg-indigo-50 border border-indigo-100 dark:bg-indigo-950/50 dark:border-indigo-900/60',
      activeRing: 'border-indigo-500 ring-2 ring-indigo-500/30 dark:border-indigo-400',
      textColor: 'text-slate-900 dark:text-white',
      paletteKey: 'night',
    },
    {
      id: 'oncall-day',
      filterKey: 'onCall',
      label: isRtl ? 'تحت الطلب نهاري' : 'On-call Day',
      value: stats.onCallDay,
      percent: Math.round((stats.onCallDay / stats.totalShifts) * 100),
      subLabel: isRtl ? 'فلترة صفوف تحت الطلب النهارية' : 'Filter day on-call rows',
      icon: <PhoneCall className="h-4 w-4 text-rose-500 dark:text-rose-400" />,
      accentBar: 'bg-gradient-to-r from-rose-500 to-pink-500',
      iconBox: 'bg-rose-50 border border-rose-100 dark:bg-rose-950/50 dark:border-rose-900/60',
      activeRing: 'border-rose-500 ring-2 ring-rose-500/30 dark:border-rose-400',
      textColor: 'text-slate-900 dark:text-white',
      paletteKey: 'onCall',
    },
    {
      id: 'oncall-night',
      filterKey: 'onCallNight',
      label: isRtl ? 'تحت الطلب ليلي' : 'On-call Night',
      value: stats.onCallNight,
      percent: Math.round((stats.onCallNight / stats.totalShifts) * 100),
      subLabel: isRtl ? 'فلترة صفوف تحت الطلب الليلية' : 'Filter night on-call rows',
      icon: <Moon className="h-4 w-4" />,
      accentBar: 'bg-gradient-to-r from-cyan-500 to-blue-500',
      iconBox: 'border',
      activeRing: 'ring-2 ring-cyan-500/30',
      textColor: 'text-slate-900 dark:text-white',
      paletteKey: 'onCallNight',
    },
    {
      id: 'overtime',
      filterKey: 'overtime',
      label: isRtl ? 'عمل إضافي' : 'Overtime',
      value: stats.overtime,
      percent: Math.round((stats.overtime / stats.totalShifts) * 100),
      subLabel: isRtl ? 'فلترة صفوف العمل الإضافي' : 'Filter overtime rows',
      icon: <Timer className="h-4 w-4" />,
      accentBar: 'bg-gradient-to-r from-pink-500 to-rose-500',
      iconBox: 'border',
      activeRing: 'ring-2 ring-pink-500/30',
      textColor: 'text-slate-900 dark:text-white',
      paletteKey: 'overtime',
    },
    {
      id: 'vacation',
      filterKey: 'vacation',
      label: isRtl ? 'الإجازات المعتمدة' : 'Scheduled Vacations',
      value: stats.vacations,
      subLabel: isRtl ? 'إجازات سنوية ومرضية' : 'Annual & sick leaves',
      icon: <Palmtree className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
      accentBar: 'bg-gradient-to-r from-emerald-500 to-teal-500',
      iconBox: 'bg-emerald-50 border border-emerald-100 dark:bg-emerald-950/50 dark:border-emerald-900/60',
      activeRing: 'border-emerald-500 ring-2 ring-emerald-500/30 dark:border-emerald-400',
      textColor: 'text-slate-900 dark:text-white',
      paletteKey: 'vacation',
    },
  ];

  return (
    <section aria-label={isRtl ? 'إحصائيات وتصفية الجدول' : 'Schedule Statistics & Filter'} className="mb-6">
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 xl:grid-cols-8">
        {cards.map((item) => {
          const isCardActive = item.filterKey !== undefined && activeShiftFilter === item.filterKey && activeShiftFilter !== '';
          return (
            <StatCard
              key={item.id}
              item={item}
              isActive={isCardActive}
              isRtl={isRtl}
              locale={locale}
              onClick={() => {
                if (!onSelectFilter || item.filterKey === undefined) return;
                if (item.filterKey === '' || activeShiftFilter === item.filterKey) {
                  onSelectFilter('');
                } else {
                  onSelectFilter(item.filterKey);
                }
              }}
            />
          );
        })}
      </div>
    </section>
  );
}

export default memo(MatrixStatsCards);
