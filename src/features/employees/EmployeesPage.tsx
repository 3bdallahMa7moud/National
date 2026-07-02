import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import DataTable from '@/components/common/DataTable';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Badge from '@/components/ui/Badge';
import { mockEmployees } from '@/mocks/mockData';
import { useToast } from '@/components/ui/Toast';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import type { Employee } from '@/types';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState(mockEmployees);
  const [search, setSearch] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const { addToast } = useToast();

  const filtered = employees.filter(e =>
    e.name.includes(search) || e.email.includes(search) || e.employeeNumber.includes(search)
  );

  const handleEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setEditModal(true);
  };

  const handleDelete = (id: string) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
    setDeleteDialog(null);
    addToast({ type: 'success', title: 'تم الحذف', message: 'تم حذف الموظف بنجاح' });
  };

  const columns = [
    { key: 'employeeNumber', header: 'الرقم', className: 'w-20' },
    {
      key: 'name',
      header: 'الموظف',
      render: (emp: Employee) => (
        <div>
          <p className="font-medium">{emp.name}</p>
          <p className="text-xs text-text-secondary">{emp.position}</p>
        </div>
      ),
    },
    { key: 'email', header: 'البريد', render: (emp: Employee) => <span dir="ltr" className="text-text-secondary">{emp.email}</span> },
    { key: 'phone', header: 'الهاتف', render: (emp: Employee) => <span dir="ltr" className="text-text-secondary">{emp.phone}</span> },
    {
      key: 'role',
      header: 'الدور',
      render: (emp: Employee) => (
        <Badge variant={emp.role === 'admin' ? 'info' : 'default'}>
          {emp.role === 'admin' ? 'مسؤول' : 'موظف'}
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
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">إدارة الموظفين</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">{employees.length} موظف في القسم</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setEditingEmployee(null); setEditModal(true); }}>
          إضافة موظف
        </Button>
      </div>

      <Card>
        <div className="relative mb-4">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            placeholder="بحث بالاسم أو البريد أو الرقم..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field ps-10"
          />
        </div>
        <DataTable columns={columns} data={filtered} keyExtractor={(e) => e.id} />
      </Card>

      {/* Edit/Add Modal */}
      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title={editingEmployee ? 'تعديل موظف' : 'إضافة موظف'}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setEditModal(false); addToast({ type: 'success', title: 'تم الحفظ' }); }}>
          <Input label="الاسم الكامل" defaultValue={editingEmployee?.name} required />
          <Input label="البريد الإلكتروني" type="email" dir="ltr" defaultValue={editingEmployee?.email} required />
          <Input label="رقم الهاتف" dir="ltr" defaultValue={editingEmployee?.phone} />
          <Input label="المسمى الوظيفي" defaultValue={editingEmployee?.position} />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setEditModal(false)}>إلغاء</Button>
            <Button type="submit">حفظ</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteDialog}
        onClose={() => setDeleteDialog(null)}
        onConfirm={() => deleteDialog && handleDelete(deleteDialog)}
        title="حذف الموظف"
        message="هل أنت متأكد من حذف هذا الموظف؟ لا يمكن التراجع عن هذا الإجراء."
      />
    </div>
  );
}
