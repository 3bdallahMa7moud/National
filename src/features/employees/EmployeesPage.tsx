import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import DataTable from '@/components/common/DataTable';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Badge from '@/components/ui/Badge';
import { useMockData } from '@/hooks/useMockData';
import { useToast } from '@/components/ui/Toast';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import type { Employee } from '@/types';

export default function EmployeesPage() {
  const { t } = useTranslation(['employees', 'common', 'forms']);
  const { employees: allEmployees } = useMockData();
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const { addToast } = useToast();

  const employees = useMemo(
    () => allEmployees.filter((e) => !deletedIds.includes(e.id)),
    [allEmployees, deletedIds],
  );

  const filtered = employees.filter(e =>
    e.name.includes(search) || e.email.includes(search) || e.employeeNumber.includes(search)
  );

  const handleEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setEditModal(true);
  };

  const handleDelete = (id: string) => {
    setDeletedIds((prev) => [...prev, id]);
    setDeleteDialog(null);
    addToast({ type: 'success', title: t('common:toast.deleted'), message: t('employees:management.deleteSuccess') });
  };

  const columns = [
    { key: 'employeeNumber', header: t('employees:management.columns.number'), className: 'w-20' },
    {
      key: 'name',
      header: t('employees:management.columns.employee'),
      render: (emp: Employee) => (
        <div>
          <p className="font-medium">{emp.name}</p>
          <p className="text-xs text-text-secondary">{emp.position}</p>
        </div>
      ),
    },
    { key: 'email', header: t('employees:management.columns.email'), render: (emp: Employee) => <span dir="ltr" className="text-text-secondary">{emp.email}</span> },
    { key: 'phone', header: t('employees:management.columns.phone'), render: (emp: Employee) => <span dir="ltr" className="text-text-secondary">{emp.phone}</span> },
    {
      key: 'role',
      header: t('employees:management.columns.role'),
      render: (emp: Employee) => (
        <Badge variant={emp.role === 'admin' ? 'info' : 'default'}>
          {emp.role === 'admin' ? t('common:role.admin') : t('common:role.employee')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24',
      render: (emp: Employee) => (
        <div className="flex gap-1">
          <button onClick={() => handleEdit(emp)} className="p-1.5 rounded hover:bg-gray-100 text-text-secondary">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={() => setDeleteDialog(emp.id)} className="p-1.5 rounded hover:bg-danger-50 text-danger">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">{t('employees:management.title')}</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">{t('employees:management.countInDepartment', { count: employees.length })}</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setEditingEmployee(null); setEditModal(true); }}>
          {t('employees:management.addEmployee')}
        </Button>
      </div>

      <Card>
        <div className="relative mb-4">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            placeholder={t('employees:management.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field ps-10"
          />
        </div>
        <DataTable columns={columns} data={filtered} keyExtractor={(e) => e.id} />
      </Card>

      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title={editingEmployee ? t('employees:management.editEmployee') : t('employees:management.addEmployee')}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setEditModal(false); addToast({ type: 'success', title: t('common:toast.saved') }); }}>
          <Input label={t('forms:labels.fullName')} defaultValue={editingEmployee?.name} required />
          <Input label={t('common:labels.email')} type="email" dir="ltr" defaultValue={editingEmployee?.email} required />
          <Input label={t('forms:labels.phoneNumber')} dir="ltr" defaultValue={editingEmployee?.phone} />
          <Input label={t('forms:labels.jobTitle')} defaultValue={editingEmployee?.position} />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setEditModal(false)}>{t('common:actions.cancel')}</Button>
            <Button type="submit">{t('common:actions.save')}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteDialog}
        onClose={() => setDeleteDialog(null)}
        onConfirm={() => deleteDialog && handleDelete(deleteDialog)}
        title={t('employees:management.deleteTitle')}
        message={t('employees:management.deleteMessage')}
      />
    </div>
  );
}
