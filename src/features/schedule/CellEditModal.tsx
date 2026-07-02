import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import ShiftBadge from '@/components/common/ShiftBadge';
import { useSchedule } from '@/hooks/useSchedule';
import { useToast } from '@/components/ui/Toast';
import { mockShiftTypes } from '@/mocks/mockData';
import { Trash2, Plus, Calendar, User, AlertCircle } from 'lucide-react';
import type { Employee, ShiftTypeKey, Shift } from '@/types';

interface CellEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  dateStr: string | null;
}

export default function CellEditModal({ isOpen, onClose, employee, dateStr }: CellEditModalProps) {
  const { allShifts, deleteShift, addShiftToCell } = useSchedule();
  const { addToast } = useToast();
  const [addAsExtra, setAddAsExtra] = useState(false);

  if (!isOpen || !employee || !dateStr) return null;

  // Live shifts for this employee on this date
  const currentShifts = allShifts.filter(
    (s) => s.employeeId === employee.id && s.date === dateStr
  );

  const formattedDate = new Date(dateStr).toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handleDeleteShift = (shift: Shift) => {
    deleteShift(shift.id);
    addToast({
      type: 'info',
      title: 'تم حذف النوبة',
      message: `تم حذف نوبة (${shift.shiftType}) للموظف ${employee.name}`,
    });
  };

  const handleAddShift = (shiftTypeKey: string, shiftNameAr: string) => {
    const isUrgentOrExtra = shiftTypeKey === 'oncall' || shiftTypeKey === 'overtime';
    const replaceRegular = !addAsExtra && !isUrgentOrExtra;

    addShiftToCell(employee.id, employee.name, dateStr, shiftTypeKey, replaceRegular);

    addToast({
      type: 'success',
      title: 'تمت إضافة النوبة',
      message: `تمت إضافة نوبة (${shiftNameAr}) للموظف ${employee.name}`,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إدارة نوبات الموظف في هذا اليوم" size="md">
      <div className="space-y-6">
        {/* Info Header */}
        <div className="bg-primary-50/50 rounded-card p-4 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-text-primary text-sm">{employee.name}</h4>
              <p className="text-xs text-text-secondary">{employee.position}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-white px-3 py-1.5 rounded-btn border border-primary/20 w-fit">
            <Calendar className="w-4 h-4" />
            <span>{formattedDate}</span>
          </div>
        </div>

        {/* Current Shifts Section */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3">
            النوبات المسجلة حالياً في هذا اليوم
          </h4>
          {currentShifts.length === 0 ? (
            <div className="bg-gray-50 border border-dashed border-border rounded-btn p-4 text-center text-sm text-text-secondary">
              لا توجد أي نوبة مسجلة لهذا الموظف في هذا اليوم (إجازة / غير مجدول)
            </div>
          ) : (
            <div className="space-y-2">
              {currentShifts.map((shift) => (
                <div
                  key={shift.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-btn bg-surface border border-border shadow-soft"
                >
                  <div className="flex items-center gap-3">
                    <ShiftBadge type={shift.shiftType as ShiftTypeKey} />
                    <span className="font-mono text-xs text-text-secondary" dir="ltr">
                      {shift.startTime} - {shift.endTime}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteShift(shift)}
                    className="p-1.5 rounded-lg text-danger hover:bg-danger-50 transition-colors flex items-center gap-1 text-xs font-medium"
                    title="حذف هذه النوبة"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>حذف</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add / Modify Shift Section */}
        <div className="pt-2 border-t border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              إضافة نوبة جديدة / تعديل النوبة
            </h4>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-primary bg-primary-50 px-2.5 py-1 rounded-btn">
              <input
                type="checkbox"
                checked={addAsExtra}
                onChange={(e) => setAddAsExtra(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-primary text-primary focus:ring-primary"
              />
              <span>إضافة كنوبة إضافية (بدون استبدال الحالية)</span>
            </label>
          </div>

          <p className="text-xs text-text-secondary mb-3">
            انقر على أي نوبة أدناه لإضافتها فوراً لجدول الموظف في هذا اليوم:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {mockShiftTypes.map((st) => (
              <button
                key={st.id}
                onClick={() => handleAddShift(st.key, st.nameAr)}
                className="flex items-center justify-center gap-1.5 p-2.5 rounded-btn border border-border hover:border-primary hover:bg-primary-50/50 transition-all text-xs font-medium bg-surface shadow-sm group"
              >
                <Plus className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                <ShiftBadge type={st.key as ShiftTypeKey} size="sm" />
              </button>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 text-blue-700 p-3 rounded-btn text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            ملاحظة: النوبات العادية (صباحي، مسائي، ليلي) تستبدل النوبة الحالية تلقائياً ما لم تقم بتفعيل خيار "إضافة كنوبة إضافية". نوبات (تحت الطلب والعمل الإضافي) تُضاف دائماً كنوبات إضافية.
          </span>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end pt-2">
          <Button variant="primary" onClick={onClose}>
            إغلاق وحفظ
          </Button>
        </div>
      </div>
    </Modal>
  );
}
