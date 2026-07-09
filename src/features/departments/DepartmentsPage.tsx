import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { useMockData } from '@/hooks/useMockData';
import { useToast } from '@/components/ui/Toast';
import { Building2, Users, UserCheck, Plus, Edit2 } from 'lucide-react';
import type { Department } from '@/types';

export default function DepartmentsPage() {
  const { t } = useTranslation(['departments', 'common', 'forms']);
  const { departments, employees } = useMockData();
  const [editModal, setEditModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const { addToast } = useToast();

  const handleEdit = (dept: Department) => {
    setEditingDept(dept);
    setEditModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setEditModal(false);
    addToast({ type: 'success', title: t('common:toast.saved'), message: t('departments:updateSuccess') });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">{t('departments:title')}</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">{t('departments:subtitle')}</p>
        </div>
        <Button
          icon={<Plus className="w-4 h-4" />}
          onClick={() => { setEditingDept(null); setEditModal(true); }}
        >
          {t('departments:addDepartment')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {departments.map((dept) => {
          const manager = employees.find((e) => e.id === dept.managerId);
          const deptEmployees = employees.filter((e) => e.departmentId === dept.id);

          return (
            <Card key={dept.id} className="flex flex-col justify-between">
              <div>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-btn bg-primary-50 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <button
                    onClick={() => handleEdit(dept)}
                    className="p-1.5 rounded-lg hover:bg-hover text-text-secondary transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="mb-1 text-base font-semibold text-text-primary">{dept.name}</h3>
                <p className="mb-5 line-clamp-2 text-xs leading-5 text-text-secondary">{dept.description}</p>

                <div className="space-y-3 border-t border-border pt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-primary" />
                      {t('departments:departmentHead')}
                    </span>
                    <span className="font-medium text-text-primary">{manager?.name || t('common:labels.notSpecified')}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary flex items-center gap-2">
                      <Users className="w-4 h-4 text-success" />
                      {t('departments:employeeCount')}
                    </span>
                    <Badge variant="success">{t('departments:employeeCountBadge', { count: deptEmployees.length })}</Badge>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs text-text-secondary">
                <span>{t('common:labels.code')}: {dept.id.toUpperCase()}</span>
                <span className="text-primary font-medium cursor-pointer hover:underline">{t('departments:viewTeam')}</span>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        isOpen={editModal}
        onClose={() => setEditModal(false)}
        title={editingDept ? t('departments:editDepartment') : t('departments:addDepartment')}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input label={t('forms:labels.departmentName')} defaultValue={editingDept?.name} required placeholder={t('departments:namePlaceholder')} />
          <Input label={t('forms:labels.departmentDescription')} defaultValue={editingDept?.description} placeholder={t('departments:descriptionPlaceholder')} />
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">{t('forms:labels.departmentHead')}</label>
            <select className="input-field" defaultValue={editingDept?.managerId || ''}>
              <option value="">{t('forms:labels.selectSupervisor')}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.position})</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t border-border/50">
            <Button variant="secondary" type="button" onClick={() => setEditModal(false)}>{t('common:actions.cancel')}</Button>
            <Button type="submit">{t('forms:actions.saveChanges')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
