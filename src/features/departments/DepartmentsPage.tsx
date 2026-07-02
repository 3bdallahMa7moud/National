import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { mockDepartments, mockEmployees } from '@/mocks/mockData';
import { useToast } from '@/components/ui/Toast';
import { Building2, Users, UserCheck, Plus, Edit2 } from 'lucide-react';
import type { Department } from '@/types';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>(mockDepartments);
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
    addToast({ type: 'success', title: 'تم الحفظ', message: 'تم تحديث بيانات القسم بنجاح' });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">إدارة الأقسام</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">عرض وتعديل الهيكل التنظيمي لأقسام الأشعة</p>
        </div>
        <Button
          icon={<Plus className="w-4 h-4" />}
          onClick={() => { setEditingDept(null); setEditModal(true); }}
        >
          إضافة قسم جديد
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {departments.map((dept) => {
          const manager = mockEmployees.find((e) => e.id === dept.managerId);
          const deptEmployees = mockEmployees.filter((e) => e.departmentId === dept.id);

          return (
            <Card key={dept.id} className="flex flex-col justify-between">
              <div>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-btn bg-primary-50 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <button
                    onClick={() => handleEdit(dept)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-text-secondary transition-colors"
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
                      رئيس القسم
                    </span>
                    <span className="font-medium text-text-primary">{manager?.name || 'غير محدد'}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary flex items-center gap-2">
                      <Users className="w-4 h-4 text-success" />
                      عدد الموظفين
                    </span>
                    <Badge variant="success">{deptEmployees.length} موظفين</Badge>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs text-text-secondary">
                <span>الكود: {dept.id.toUpperCase()}</span>
                <span className="text-primary font-medium cursor-pointer hover:underline">عرض الطاقم ←</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Edit/Add Modal */}
      <Modal
        isOpen={editModal}
        onClose={() => setEditModal(false)}
        title={editingDept ? 'تعديل بيانات القسم' : 'إضافة قسم جديد'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="اسم القسم" defaultValue={editingDept?.name} required placeholder="مثال: قسم الأشعة المقطعية" />
          <Input label="وصف القسم" defaultValue={editingDept?.description} placeholder="وصف مهام وتخصص القسم..." />
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">رئيس القسم / المشرف</label>
            <select className="input-field" defaultValue={editingDept?.managerId || ''}>
              <option value="">اختر مشرفاً...</option>
              {mockEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.position})</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t border-border/50">
            <Button variant="secondary" type="button" onClick={() => setEditModal(false)}>إلغاء</Button>
            <Button type="submit">حفظ التغييرات</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
