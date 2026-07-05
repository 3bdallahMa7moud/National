import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatCard from '@/components/common/StatCard';
import ShiftBadge from '@/components/common/ShiftBadge';
import AuditLogRow from '@/components/common/AuditLogRow';
import { useAuthStore } from '@/stores/authStore';
import { useMockData } from '@/hooks/useMockData';
import {
  Calendar, Users, Phone, ArrowLeft, Plus,
  CheckCircle2
} from 'lucide-react';
import type { ShiftTypeKey } from '@/types';

export default function DashboardPage() {
  const { t } = useTranslation(['dashboard', 'common']);
  const user = useAuthStore((s) => s.user);
  const { employees, shifts, auditLog } = useMockData();

  const totalEmployees = employees.filter((e) => e.role === 'employee').length;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayShifts = shifts.filter((s) => s.date === todayStr || s.date === '2026-07-01');
  const onCallShifts = shifts.filter((s) => s.shiftType === 'oncall');

  return (
    <div className="space-y-5">
      <div className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-text-secondary">
              <span className="inline-flex h-2 w-2 rounded-full bg-success" />
              <span>{t('dashboard:department')}</span>
              <span className="text-border">|</span>
              <span>{t('dashboard:activeTechnicians', { count: totalEmployees })}</span>
            </div>
            <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">{t('dashboard:title')}</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
              {t('dashboard:welcome', { name: user?.name })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/schedule">
              <Button>{t('dashboard:actions.manageSchedule')}</Button>
            </Link>
            <Link to="/admin/employees">
              <Button variant="secondary">
                <Plus className="h-4 w-4" />
                {t('dashboard:actions.addEmployee')}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title={t('dashboard:stats.totalTechnicians')}
          value={totalEmployees}
          icon={Users}
          color="primary"
          change={{ value: 12, label: t('dashboard:stats.vsLastMonth') }}
        />
        <StatCard
          title={t('dashboard:stats.todayShifts')}
          value={todayShifts.length || 8}
          icon={Calendar}
          color="success"
        />
        <StatCard
          title={t('dashboard:stats.onCallCoverage')}
          value={t('dashboard:stats.onCallCount', { count: onCallShifts.length })}
          icon={Phone}
          color="info"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-success" />
              {t('dashboard:todayRoster.title')}
            </CardTitle>
            <Link to="/admin/schedule" className="text-xs text-primary hover:underline flex items-center gap-1">
              {t('dashboard:todayRoster.viewMonthly')} <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
            </Link>
          </CardHeader>

          <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="whitespace-nowrap border-b border-border text-xs font-semibold text-text-secondary">
                  <th className="pb-3 text-start">{t('dashboard:todayRoster.columns.employee')}</th>
                  <th className="pb-3 text-start">{t('dashboard:todayRoster.columns.position')}</th>
                  <th className="pb-3 text-center">{t('dashboard:todayRoster.columns.shift')}</th>
                  <th className="pb-3 text-end">{t('dashboard:todayRoster.columns.timing')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(todayShifts.length > 0 ? todayShifts : shifts.slice(0, 5)).map((shift) => (
                  <tr key={shift.id} className="transition-colors hover:bg-gray-50">
                    <td className="py-3 font-medium text-text-primary">{shift.employeeName}</td>
                    <td className="py-3 text-xs text-text-secondary">{t('dashboard:todayRoster.defaultPosition')}</td>
                    <td className="py-3 text-center">
                      <ShiftBadge type={shift.shiftType as ShiftTypeKey} size="sm" />
                    </td>
                    <td className="py-3 text-end font-mono text-xs text-text-secondary" dir="ltr">
                      {shift.startTime} - {shift.endTime}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-base">{t('dashboard:recentChanges.title')}</CardTitle>
              <Link to="/admin/audit-log" className="text-xs text-primary hover:underline">
                {t('dashboard:recentChanges.viewFull')}
              </Link>
            </CardHeader>
            <div className="-mx-5 -mb-5 divide-y divide-border/60 sm:-mx-6 sm:-mb-6">
              {auditLog.slice(0, 5).map((entry) => (
                <AuditLogRow key={entry.id} entry={entry} />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
