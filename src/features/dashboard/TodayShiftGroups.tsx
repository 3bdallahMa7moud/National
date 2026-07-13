import { AlertTriangle, ArrowUpRight, CheckCircle2, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import type { CoverageCategory, DailyShiftGroup } from '@/types/operationalDashboard';

interface TodayShiftGroupsProps { groups: DailyShiftGroup[]; selectedCategory: CoverageCategory | null }

export default function TodayShiftGroups({ groups, selectedCategory }: TodayShiftGroupsProps) {
  const { t } = useTranslation('dashboard');
  const visibleGroups = groups.filter((group) => (selectedCategory === null || group.category === selectedCategory) && group.items.length > 0);
  return (
    <section aria-labelledby="today-shifts-title" className="space-y-3">
      <div>
        <h2 id="today-shifts-title" className="text-base font-semibold text-text-primary sm:text-lg">{t('shiftGroups.title')}</h2>
        <p className="mt-1 text-sm text-text-secondary">{t('shiftGroups.description')}</p>
      </div>
      {visibleGroups.length === 0 ? (
        <Card className="py-8 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-success" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium text-text-primary">{t('shiftGroups.empty')}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          {visibleGroups.map((group) => {
            const label = t(`coverage.categories.${group.category}`);
            return (
              <Card key={group.category} padding={false} className="overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                  <div>
                    <h3 className="font-semibold text-text-primary">{label}</h3>
                    <p className="mt-0.5 text-xs text-text-secondary">{t('shiftGroups.summary', { assignments: group.assignmentCount, issues: group.issueCount })}</p>
                  </div>
                  <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary">{group.items.length}</span>
                </div>
                <div className="divide-y divide-border/60">
                  {group.items.map((item) => (
                    <div key={item.id} className="flex min-h-[72px] items-center gap-3 px-5 py-3">
                      <span className={item.uncovered ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger' : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary'}>
                        {item.uncovered ? <AlertTriangle className="h-4 w-4" aria-hidden="true" /> : <UserRound className="h-4 w-4" aria-hidden="true" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text-primary">{item.uncovered ? t('shiftGroups.uncoveredSlot') : item.employeeName || item.employeeCode}</p>
                        <p className="mt-0.5 truncate text-xs text-text-secondary">{item.facility} · {item.unit} · <span dir="ltr">{item.timeRange}</span></p>
                        {(item.hasConflict || item.isOnApprovedVacation || item.unresolvedEmployee) && (
                          <p className="mt-1 text-xs font-medium text-danger">
                            {item.hasConflict ? t('shiftGroups.conflict') : item.isOnApprovedVacation ? t('shiftGroups.approvedAbsence') : t('shiftGroups.unresolvedEmployee')}
                          </p>
                        )}
                      </div>
                      <Link
                        to={item.href}
                        aria-label={item.uncovered ? t('shiftGroups.resolveGap', { shift: label }) : t('shiftGroups.openAssignment', { employee: item.employeeName || item.employeeCode })}
                        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-btn text-primary hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
                      </Link>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
