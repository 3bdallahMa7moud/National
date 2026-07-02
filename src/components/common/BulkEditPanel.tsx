import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import ShiftBadge from '@/components/common/ShiftBadge';
import { mockShiftTypes } from '@/mocks/mockData';
import type { ShiftTypeKey } from '@/types';

interface BulkEditPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onApply: (shiftTypeId: string, repeatWeekly: boolean) => void;
}

export default function BulkEditPanel({ isOpen, onClose, selectedCount, onApply }: BulkEditPanelProps) {
  const [selectedShift, setSelectedShift] = useState<string>('');
  const [repeatWeekly, setRepeatWeekly] = useState(false);

  const handleApply = () => {
    if (!selectedShift) return;
    onApply(selectedShift, repeatWeekly);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="تعديل جماعي" size="md">
      <div className="space-y-6">
        <div className="bg-info-50 text-info-600 rounded-btn px-4 py-3 text-sm">
          تم تحديد <strong>{selectedCount}</strong> خلية للتعديل
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-3">اختر نوع الشيفت</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {mockShiftTypes.map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedShift(st.id)}
                className={`flex items-center gap-2 p-3 rounded-btn border-2 transition-all ${
                  selectedShift === st.id
                    ? 'border-primary bg-primary-50'
                    : 'border-border hover:border-gray-300'
                }`}
              >
                <ShiftBadge type={st.key as ShiftTypeKey} size="sm" />
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={repeatWeekly}
            onChange={(e) => setRepeatWeekly(e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-sm text-text-primary">تكرار هذا النمط أسبوعياً</span>
        </label>

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleApply} disabled={!selectedShift}>
            تطبيق التعديل
          </Button>
        </div>
      </div>
    </Modal>
  );
}
