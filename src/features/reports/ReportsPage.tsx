import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend
} from 'recharts';
import { useMockData } from '@/hooks/useMockData';
import { mockShifts } from '@/mocks/sources';
import { getShiftLabel } from '@/i18n/helpers';
import { Calendar, TrendingUp, Clock, Phone } from 'lucide-react';

export default function ReportsPage() {
  const { t } = useTranslation(['reports', 'common']);
  const [month, setMonth] = useState('2026-07');

  const { employees, shiftTypes } = useMockData();

  const shiftDistribution = shiftTypes.map((st) => ({
    name: getShiftLabel(t, st.key),
    value: mockShifts.filter((s) => s.shiftType === st.key).length,
    color: st.color,
  })).filter((item) => item.value > 0);
  const totalShiftDistribution = shiftDistribution.reduce((sum, item) => sum + item.value, 0);

  const workloadData = employees.filter((e) => e.role === 'employee').map((emp) => {
    const empShifts = mockShifts.filter((s) => s.employeeId === emp.id);
    return {
      name: emp.name.split(' ')[0],
      fullName: emp.name,
      morning: empShifts.filter((s) => s.shiftType === 'morning').length,
      evening: empShifts.filter((s) => s.shiftType === 'evening').length,
      night: empShifts.filter((s) => s.shiftType === 'night').length,
      oncall: empShifts.filter((s) => s.shiftType === 'oncall').length,
      total: empShifts.filter((s) => ['morning', 'evening', 'night'].includes(s.shiftType || '')).length,
    };
  });

  const totalShifts = mockShifts.length;
  const totalOnCall = mockShifts.filter((s) => s.shiftType === 'oncall').length;
  const totalOvertime = mockShifts.filter((s) => s.shiftType === 'overtime').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">{t('reports:title')}</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">{t('reports:subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 rounded-btn border border-border bg-surface px-3 py-1.5">
            <Calendar className="w-4 h-4 text-text-secondary" />
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="bg-transparent text-sm font-medium focus:outline-none"
            >
              <option value="2026-07">{t('reports:months.2026-07')}</option>
              <option value="2026-06">{t('reports:months.2026-06')}</option>
              <option value="2026-05">{t('reports:months.2026-05')}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="flex items-center gap-4 border-s-4 border-primary">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-btn bg-primary-50 text-primary">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-text-secondary">{t('reports:stats.totalScheduled')}</p>
            <p className="mt-1 text-2xl font-semibold leading-none text-text-primary">{t('reports:stats.totalScheduledValue', { count: totalShifts })}</p>
            <p className="text-xs text-success mt-1">{t('reports:stats.fullCoverage')}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 border-s-4 border-info">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-btn bg-info-50 text-info">
            <Phone className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-text-secondary">{t('reports:stats.onCall')}</p>
            <p className="mt-1 text-2xl font-semibold leading-none text-text-primary">{t('reports:stats.onCallValue', { count: totalOnCall })}</p>
            <p className="text-xs text-text-secondary mt-1">{t('reports:stats.onCallAverage')}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 border-s-4 border-warning">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-btn bg-warning-50 text-warning">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-text-secondary">{t('reports:stats.overtimeHours')}</p>
            <p className="mt-1 text-2xl font-semibold leading-none text-text-primary">{t('reports:stats.overtimeValue', { count: totalOvertime * 4 })}</p>
            <p className="text-xs text-warning-600 mt-1">{t('reports:stats.overtimeWithinLimit')}</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h3 className="mb-4 text-base font-semibold text-text-primary">{t('reports:charts.workloadByEmployee')}</h3>
          <div className="h-64 sm:h-80 w-full min-h-[250px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workloadData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748B" fontSize={12} />
                <YAxis stroke="#64748B" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0' }} />
                <Legend />
                <Bar dataKey="morning" name={t('common:shifts.morning')} stackId="a" fill="#22C55E" />
                <Bar dataKey="evening" name={t('common:shifts.evening')} stackId="a" fill="#F59E0B" />
                <Bar dataKey="night" name={t('common:shifts.night')} stackId="a" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="oncall" name={t('common:shifts.oncall')} fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-base font-semibold text-text-primary">{t('reports:charts.shiftTypeDistribution')}</h3>
          <div className="space-y-4">
            {shiftDistribution.map((item) => {
              const percentage = Math.round((item.value / totalShiftDistribution) * 100);
              return (
                <div key={item.name} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-medium text-text-primary">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                      <span>{t('reports:charts.shiftCount', { count: item.value })}</span>
                      <span className="font-semibold text-text-primary">{percentage}%</span>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-pill bg-surface-muted">
                    <div className="h-full rounded-pill" style={{ width: `${percentage}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
