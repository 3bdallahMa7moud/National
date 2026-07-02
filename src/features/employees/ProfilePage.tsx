import Card from '@/components/ui/Card';
import { useAuthStore } from '@/stores/authStore';
import { User, Mail, Phone, Building2, Hash, Calendar } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { mockEmployees } from '@/mocks/mockData';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const employee = mockEmployees.find((e) => e.id === user?.id);

  const fields = [
    { icon: User, label: 'الاسم', value: employee?.name || user?.name },
    { icon: Mail, label: 'البريد الإلكتروني', value: employee?.email || user?.email, dir: 'ltr' as const },
    { icon: Phone, label: 'الهاتف', value: employee?.phone || '-', dir: 'ltr' as const },
    { icon: Building2, label: 'القسم', value: user?.departmentName },
    { icon: Hash, label: 'الرقم الوظيفي', value: employee?.employeeNumber },
    { icon: Calendar, label: 'تاريخ الانضمام', value: employee?.createdAt ? new Date(employee.createdAt).toLocaleDateString('ar-SA') : '-' },
  ];

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">ملفي الشخصي</h1>

      <Card>
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-card bg-primary-50">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{user?.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={user?.role === 'admin' ? 'info' : 'default'}>
                {user?.role === 'admin' ? 'مسؤول' : 'موظف'}
              </Badge>
              <span className="text-sm text-text-secondary">{employee?.position}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {fields.map((field) => {
            const Icon = field.icon;
            return (
              <div key={field.label} className="flex items-center gap-3 border-b border-border py-2 last:border-0">
                <Icon className="w-4 h-4 text-text-secondary flex-shrink-0" />
                <span className="text-sm text-text-secondary w-32">{field.label}</span>
                <span className="text-sm font-medium text-text-primary" dir={field.dir}>{field.value}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
