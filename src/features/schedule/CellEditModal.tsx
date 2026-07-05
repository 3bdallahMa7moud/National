import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import ShiftBadge from '@/components/common/ShiftBadge';
import { useSchedule } from '@/hooks/useSchedule';
import { useToast } from '@/components/ui/Toast';
import { mockShiftTypesSource } from '@/mocks/sources';
import { getShiftLabel } from '@/i18n/helpers';
import { Trash2, Plus, Calendar, User, AlertCircle } from 'lucide-react';
import type { Employee, ShiftTypeKey, Shift } from '@/types';
import { useLanguage } from '@/hooks/useLanguage';

interface CellEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  dateStr: string | null;
}

export default function CellEditModal({ isOpen, onClose, employee, dateStr }: CellEditModalProps) {
  const { t } = useTranslation(['schedule', 'common']);
  const { dateLocale } = useLanguage();
  const { allShifts, deleteShift, addShiftToCell } = useSchedule();
  const { addToast } = useToast();
  const [addAsExtra, setAddAsExtra] = useState(false);

  if (!isOpen || !employee || !dateStr) return null;

  const currentShifts = allShifts.filter(
    (s) => s.employeeId === employee.id && s.date === dateStr
  );

  const formattedDate = new Date(dateStr).toLocaleDateString(dateLocale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handleDeleteShift = (shift: Shift) => {
    deleteShift(shift.id);
    addToast({
      type: 'info',
      title: t('schedule:cellEdit.shiftDeleted'),
      message: t('schedule:cellEdit.shiftDeletedMessage', {
        shiftType: getShiftLabel(t, shift.shiftType || ''),
        employeeName: employee.name,
      }),
    });
  };

  const handleAddShift = (shiftTypeKey: string) => {
    const isUrgentOrExtra = shiftTypeKey === 'oncall' || shiftTypeKey === 'overtime';
    const replaceRegular = !addAsExtra && !isUrgentOrExtra;

    addShiftToCell(employee.id, employee.name, dateStr, shiftTypeKey, replaceRegular);

    addToast({
      type: 'success',
      title: t('schedule:cellEdit.shiftAdded'),
      message: t('schedule:cellEdit.shiftAddedMessage', {
        shiftName: getShiftLabel(t, shiftTypeKey),
        employeeName: employee.name,
      }),
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('schedule:cellEdit.title')} size="md">
      <div className="space-y-6">
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

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3">
            {t('schedule:cellEdit.currentShifts')}
          </h4>
          {currentShifts.length === 0 ? (
            <div className="bg-gray-50 border border-dashed border-border rounded-btn p-4 text-center text-sm text-text-secondary">
              {t('schedule:cellEdit.noShifts')}
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
                    title={t('schedule:cellEdit.deleteShift')}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{t('common:actions.delete')}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              {t('schedule:cellEdit.addOrModify')}
            </h4>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-primary bg-primary-50 px-2.5 py-1 rounded-btn">
              <input
                type="checkbox"
                checked={addAsExtra}
                onChange={(e) => setAddAsExtra(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-primary text-primary focus:ring-primary"
              />
              <span>{t('schedule:cellEdit.addAsExtra')}</span>
            </label>
          </div>

          <p className="text-xs text-text-secondary mb-3">{t('schedule:cellEdit.clickToAdd')}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {mockShiftTypesSource.map((st) => (
              <button
                key={st.id}
                onClick={() => handleAddShift(st.key)}
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
          <span>{t('schedule:cellEdit.note')}</span>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" onClick={onClose}>
            {t('common:actions.closeAndSave')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
