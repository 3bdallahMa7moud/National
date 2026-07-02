import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend
} from 'recharts';
import { mockShifts, mockShiftTypes, mockEmployees } from '@/mocks/mockData';
import { Download, Calendar, TrendingUp, Clock, Phone } from 'lucide-react';

export default function ReportsPage() {
  const [month, setMonth] = useState('2026-07');

  // Shift type distribution for Pie Chart
  const shiftDistribution = mockShiftTypes.map((st) => ({
    name: st.nameAr,
    value: mockShifts.filter((s) => s.shiftType === st.key).length,
    color: st.color,
  })).filter((item) => item.value > 0);
  const totalShiftDistribution = shiftDistribution.reduce((sum, item) => sum + item.value, 0);

  // Employee workload (hours & overtime) for Bar Chart
  const workloadData = mockEmployees.filter((e) => e.role === 'employee').map((emp) => {
    const empShifts = mockShifts.filter((s) => s.employeeId === emp.id);
    const morning = empShifts.filter((s) => s.shiftType === 'morning').length;
    const evening = empShifts.filter((s) => s.shiftType === 'evening').length;
    const night = empShifts.filter((s) => s.shiftType === 'night').length;
    const oncall = empShifts.filter((s) => s.shiftType === 'oncall').length;
    return {
      name: emp.name.split(' ')[0], // First name for short label
      fullName: emp.name,
      صباحي: morning,
      مسائي: evening,
      ليلي: night,
      'تحت الطلب': oncall,
      total: morning + evening + night,
    };
  });

  // Summary stats
  const totalShifts = mockShifts.length;
  const totalOnCall = mockShifts.filter((s) => s.shiftType === 'oncall').length;
  const totalOvertime = mockShifts.filter((s) => s.shiftType === 'overtime').length;

  const handleExport = () => {
    window.print();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">التقارير والإحصائيات</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">تحليل أداء وتوزيع النوبات في قسم الأشعة المقطعية</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 rounded-btn border border-border bg-surface px-3 py-1.5">
            <Calendar className="w-4 h-4 text-text-secondary" />
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="bg-transparent text-sm font-medium focus:outline-none"
            >
              <option value="2026-07">يوليو 2026</option>
              <option value="2026-06">يونيو 2026</option>
              <option value="2026-05">مايو 2026</option>
            </select>
          </div>
          <Button variant="outline" icon={<Download className="w-4 h-4" />} onClick={handleExport}>
            تصدير التقرير
          </Button>
        </div>
      </div>

      {/* KPI Banner */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="flex items-center gap-4 border-s-4 border-primary">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-btn bg-primary-50 text-primary">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-text-secondary">إجمالي النوبات المجدولة</p>
            <p className="mt-1 text-2xl font-semibold leading-none text-text-primary">{totalShifts} نوبة</p>
            <p className="text-xs text-success mt-1">↑ تغطية كاملة للقسم 100%</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 border-s-4 border-info">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-btn bg-info-50 text-info">
            <Phone className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-text-secondary">نوبات تحت الطلب (On-Call)</p>
            <p className="mt-1 text-2xl font-semibold leading-none text-text-primary">{totalOnCall} نوبة</p>
            <p className="text-xs text-text-secondary mt-1">متوسط 3.5 نوبة / موظف</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 border-s-4 border-warning">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-btn bg-warning-50 text-warning">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-text-secondary">ساعات العمل الإضافي</p>
            <p className="mt-1 text-2xl font-semibold leading-none text-text-primary">{totalOvertime * 4} ساعة</p>
            <p className="text-xs text-warning-600 mt-1">ضمن النطاق المسموح به</p>
          </div>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Workload Bar Chart */}
        <Card className="lg:col-span-2">
          <h3 className="mb-4 text-base font-semibold text-text-primary">توزيع النوبات حسب الموظف</h3>
          <div className="h-64 sm:h-80 w-full min-h-[250px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workloadData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748B" fontSize={12} />
                <YAxis stroke="#64748B" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0', direction: 'rtl', textAlign: 'right' }}
                />
                <Legend wrapperStyle={{ direction: 'rtl', paddingTop: '10px' }} />
                <Bar dataKey="صباحي" stackId="a" fill="#22C55E" radius={[0, 0, 0, 0]} />
                <Bar dataKey="مسائي" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} />
                <Bar dataKey="ليلي" stackId="a" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="تحت الطلب" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Shift Types Pie Chart */}
        <Card>
          <h3 className="mb-4 text-base font-semibold text-text-primary">نسبة أنواع النوبات</h3>
          <div className="space-y-4">
            {shiftDistribution.map((item) => {
              const percentage = Math.round((item.value / totalShiftDistribution) * 100);
              return (
                <div key={item.name} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-medium text-text-primary">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                      <span>{item.value} نوبة</span>
                      <span className="font-semibold text-text-primary">{percentage}%</span>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-pill bg-gray-100">
                    <div
                      className="h-full rounded-pill"
                      style={{ width: `${percentage}%`, backgroundColor: item.color }}
                    />
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
