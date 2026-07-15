import { useMemo, useState } from 'react';
import { ListOrdered } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ManualTableOrder from '@/components/common/ManualTableOrder';
import { getShiftChipStyle } from '@/components/schedule/ScheduleMatrix/getShiftChipClasses';
import type { MatrixReorderCommand, MatrixReorderResult, ScheduleMatrixData } from '@/types/scheduleMatrix';

interface ScheduleOrderPanelProps {
  data: ScheduleMatrixData;
  onReorder(command: MatrixReorderCommand): MatrixReorderResult;
}

export default function ScheduleOrderPanel({ data, onReorder }: ScheduleOrderPanelProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const activeFacilities = data.facilities.filter((facility) => facility.units.some((unit) => !unit.archived));
  const [selectedFacilityId, setSelectedFacilityId] = useState(activeFacilities[0]?.id || '');
  const facility = activeFacilities.find((item) => item.id === selectedFacilityId) || activeFacilities[0];
  const units = useMemo(() => facility?.units
    .filter((unit) => !unit.archived)
    .map((unit) => ({
      id: unit.id,
      label: unit.name,
      rows: unit.rows.filter((row) => !row.archived).map((row) => ({
        id: row.id,
        label: row.rowLabel || row.shiftLabel,
        meta: `${row.shiftLabel} · ${row.timeRange}`,
        color: getShiftChipStyle(row.colorKey, row.backgroundColor, row.textColor).backgroundColor,
      })),
    })) || [], [facility]);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-extrabold text-text-primary">{isRtl ? 'ترتيب الجدول' : 'Table order'}</h2>
          </div>
          <p className="mt-1 text-xs text-text-secondary">{isRtl ? 'اسحب الوحدات والشفتات، استخدم الأسهم، أو انقل الشفت إلى وحدة أخرى. يتم الحفظ تلقائيًا.' : 'Drag units and shifts, use the arrows, or move a shift to another unit. Changes save automatically.'}</p>
        </div>
        {activeFacilities.length > 1 && (
          <select className="input-field min-h-10 sm:w-56" value={facility?.id || ''} onChange={(event) => setSelectedFacilityId(event.target.value)}>
            {activeFacilities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        )}
      </div>
      <div className="mt-4">
        <ManualTableOrder
          units={units}
          onReorderUnit={(sourceUnitId, targetUnitId, position) => {
            if (!facility) return;
            onReorder({ kind: 'unit', facilityId: facility.id, sourceUnitId, targetUnitId, position });
          }}
          onReorderRow={(sourceRowId, sourceUnitId, targetUnitId, targetRowId, position = 'after') => {
            if (!facility) return;
            onReorder({
              kind: 'row',
              facilityId: facility.id,
              sourceUnitId,
              sourceRowId,
              targetUnitId,
              targetRowId,
              position,
            });
          }}
        />
      </div>
    </section>
  );
}
