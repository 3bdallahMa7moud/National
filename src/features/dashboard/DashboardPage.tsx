import { Link } from 'react-router-dom';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatCard from '@/components/common/StatCard';
import ShiftBadge from '@/components/common/ShiftBadge';
import AuditLogRow from '@/components/common/AuditLogRow';
import { useAuthStore } from '@/stores/authStore';
import { mockShifts, mockEmployees, mockAuditLog } from '@/mocks/mockData';
import {
  Calendar, Users, Phone, ArrowLeft, Plus,
  CheckCircle2
} from 'lucide-react';
import type { ShiftTypeKey } from '@/types';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const totalEmployees = mockEmployees.filter((e) => e.role === 'employee').length;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayShifts = mockShifts.filter((s) => s.date === todayStr || s.date === '2026-07-01'); // Fallback to July 1st for demo
  const onCallShifts = mockShifts.filter((s) => s.shiftType === 'oncall');

  return (
    <div className="space-y-5">
      {/* Welcome & Quick actions */}
      <div className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-text-secondary">
              <span className="inline-flex h-2 w-2 rounded-full bg-success" />
              <span>قسم الأشعة المقطعية</span>
              <span className="text-border">|</span>
              <span>{totalEmployees} فنيين نشطين</span>
            </div>
            <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">لوحة تحكم المسؤول</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
              مرحباً {user?.name}، هذه نظرة تشغيلية مختصرة على تغطية النوبات وحركة الجدول اليوم.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/schedule">
              <Button>
                إدارة الجدول
              </Button>
            </Link>
            <Link to="/admin/employees">
              <Button variant="secondary">
                <Plus className="h-4 w-4" />
                إضافة موظف
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="إجمالي الفنيين"
          value={totalEmployees}
          icon={Users}
          color="primary"
          change={{ value: 12, label: 'عن الشهر السابق' }}
        />
        <StatCard
          title="نوبات اليوم المجدولة"
          value={todayShifts.length || 8}
          icon={Calendar}
          color="success"
        />
        <StatCard
          title="تغطية تحت الطلب (On-Call)"
          value={`${onCallShifts.length} نوبة`}
          icon={Phone}
          color="info"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Today's Shift Roster (2 Cols) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-success" />
              طاقم المناوبة لليوم
            </CardTitle>
            <Link to="/admin/schedule" className="text-xs text-primary hover:underline flex items-center gap-1">
              عرض الجدول الشهري <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>

          <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="whitespace-nowrap border-b border-border text-xs font-semibold text-text-secondary">
                  <th className="pb-3 text-start">الموظف</th>
                  <th className="pb-3 text-start">المسمى</th>
                  <th className="pb-3 text-center">النوبة</th>
                  <th className="pb-3 text-end">التوقيت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(todayShifts.length > 0 ? todayShifts : mockShifts.slice(0, 5)).map((shift) => (
                  <tr key={shift.id} className="transition-colors hover:bg-gray-50">
                    <td className="py-3 font-medium text-text-primary">{shift.employeeName}</td>
                    <td className="py-3 text-xs text-text-secondary">فني أشعة مقطعية</td>
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

        {/* Audit Log / Recent Changes */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-base">آخر التعديلات على الجدول</CardTitle>
              <Link to="/admin/audit-log" className="text-xs text-primary hover:underline">
                السجل الكامل
              </Link>
            </CardHeader>
            <div className="-mx-5 -mb-5 divide-y divide-border/60 sm:-mx-6 sm:-mb-6">
              {mockAuditLog.slice(0, 5).map((entry) => (
                <AuditLogRow key={entry.id} entry={entry} />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
