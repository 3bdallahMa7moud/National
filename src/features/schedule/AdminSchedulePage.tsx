import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ScheduleCalendar from './ScheduleCalendar';
import BulkEditPanel from '@/components/common/BulkEditPanel';
import CellEditModal from './CellEditModal';
import { useSchedule } from '@/hooks/useSchedule';
import { useUIStore } from '@/stores/uiStore';
import { mockEmployees } from '@/mocks/mockData';
import { useToast } from '@/components/ui/Toast';
import { Edit3, CheckSquare, Info } from 'lucide-react';
import type { Employee } from '@/types';

export default function AdminSchedulePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [editMode, setEditMode] = useState(false);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [activeCell, setActiveCell] = useState<{ employee: Employee; dateStr: string } | null>(null);

  const { shifts, bulkUpdateShifts } = useSchedule(undefined, month, year);
  const { selectedCells, toggleCellSelection, clearSelection, bulkEditOpen, setBulkEditOpen } = useUIStore();
  const { addToast } = useToast();
  const employees = mockEmployees.filter((e) => e.role === 'employee');

  const handlePrevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };

  const handleNextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const handleBulkApply = (shiftTypeId: string, repeatWeekly: boolean) => {
    bulkUpdateShifts(selectedCells, shiftTypeId, repeatWeekly);
    addToast({
      type: 'success',
      title: 'تم التعديل الجماعي بنجاح',
      message: `تم تطبيق التعديل على ${selectedCells.length} خلية`,
    });
    clearSelection();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">إدارة الجدول الشهري</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            إدارة وتوزيع جدول شيفتات موظفين قسم الأشعة المقطعية
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editMode && (
            <Button
              variant={bulkSelectMode ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => {
                setBulkSelectMode(!bulkSelectMode);
                if (bulkSelectMode) clearSelection();
              }}
              icon={<CheckSquare className="w-4 h-4" />}
            >
              {bulkSelectMode ? '✓ وضع التحديد الجماعي مفعل' : 'تفعيل التحديد الجماعي'}
            </Button>
          )}
          {editMode && bulkSelectMode && selectedCells.length > 0 && (
            <Button variant="primary" className="bg-success hover:bg-success/90 text-white border-0" size="sm" onClick={() => setBulkEditOpen(true)}>
              تعديل الخلايا المحددة ({selectedCells.length})
            </Button>
          )}
          <Button
            variant={editMode ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              setEditMode(!editMode);
              if (editMode) {
                clearSelection();
                setBulkSelectMode(false);
              }
            }}
            icon={<Edit3 className="w-4 h-4" />}
          >
            {editMode ? 'إنهاء وضع التعديل' : 'وضع التعديل وإدارة النوبات'}
          </Button>
        </div>
      </div>

      {editMode && (
        <div className="flex items-start gap-2.5 rounded-card border border-primary/20 bg-primary-50/70 p-3.5 text-xs text-text-primary">
          <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-primary block">كيفية التعديل على الجدول:</span>
            {!bulkSelectMode ? (
              <p className="text-text-secondary leading-relaxed">
                انقر على **أي خلية في الجدول** لفتح نافذة إدارة النوبات وإضافة شيفت (صباحي، مسائي، ليلي، إجازة) أو إضافة نوبة إضافية لنفس اليوم. لتحديد عدة خلايا دفعة واحدة، اضغط على زر "تفعيل التحديد الجماعي" بالأعلى.
              </p>
            ) : (
              <p className="text-text-secondary leading-relaxed">
                انقر على الخلايا التي تريد تحديدها، ثم اضغط على زر **"تعديل الخلايا المحددة"** بالأعلى لتطبيق نوبة موحدة عليها جميعاً دفعة واحدة.
              </p>
            )}
          </div>
        </div>
      )}

      <Card padding={false} className="overflow-hidden p-3 sm:p-4">
        <ScheduleCalendar
          shifts={shifts}
          employees={employees}
          mode="matrix"
          editable={editMode}
          year={year}
          month={month}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          selectedCells={selectedCells}
          onCellClick={toggleCellSelection}
          bulkSelectMode={bulkSelectMode}
          onCellManage={(emp, dateStr) => setActiveCell({ employee: emp, dateStr })}
        />
      </Card>

      <BulkEditPanel
        isOpen={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        selectedCount={selectedCells.length}
        onApply={handleBulkApply}
      />

      <CellEditModal
        isOpen={!!activeCell}
        onClose={() => setActiveCell(null)}
        employee={activeCell?.employee || null}
        dateStr={activeCell?.dateStr || null}
      />
    </div>
  );
}
