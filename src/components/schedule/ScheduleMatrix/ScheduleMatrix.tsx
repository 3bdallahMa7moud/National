// ============================================================
// ScheduleMatrix — Root grid component
// ============================================================
// Presentation-only. No fetch, no socket. Props + callbacks.
// dir="rtl" shell with CSS Grid, frozen columns, scroll container.

import { memo, useRef, useCallback, useMemo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import DayHeaderRow from './DayHeaderRow';
import FacilityBand from './FacilityBand';
import UnitShiftLabel from './UnitShiftLabel';
import ShiftRowCells from './ShiftRowCells';
import LegendPanel from './LegendPanel';
import VacationBand from './VacationBand';
import RowEditPopover, { type RowEditTarget } from './RowEditPopover';
import MobileWeeklySchedule from './MobileWeeklySchedule';
import type { CellInteractionMeta } from './ShiftRowCells';
import type {
  ScheduleMatrixData,
  MatrixCellRef,
  Assignment,
  MatrixAdminMode,
  ShiftRow,
} from '@/types/scheduleMatrix';

export interface ScheduleMatrixProps {
  data: ScheduleMatrixData;
  editable?: boolean;
  adminMode?: MatrixAdminMode;
  highlightedEmployeeId?: string | null;
  selectedCells?: MatrixCellRef[];
  brushEmployeeCodes?: string[];
  colorblindMode?: boolean;
  isExpanded?: boolean;
  zoomLevel?: number;
  onCellClick?: (ref: MatrixCellRef, meta?: CellInteractionMeta) => void;
  onChipClick?: (ref: MatrixCellRef, assignment: Assignment, meta?: CellInteractionMeta) => void;
  onCellContextMenu?: (ref: MatrixCellRef, position: { x: number; y: number }) => void;
  onRangeSelect?: (start: MatrixCellRef, end: MatrixCellRef) => void;
  onDragFill?: (source: MatrixCellRef, target: MatrixCellRef) => void;
  onVacationToggle?: (employeeId: string, day: number) => void;
  onLegendEmployeeClick?: (employeeId: string) => void;
  onUpdateRow?: (
    rowId: string,
    updates: Partial<Pick<ShiftRow, 'rowLabel' | 'shiftLabel' | 'timeRange' | 'colorKey' | 'weekendOnly'>>,
  ) => void;
}

function ScheduleMatrix({
  data,
  editable = false,
  adminMode = 'view',
  highlightedEmployeeId = null,
  selectedCells = [],
  brushEmployeeCodes = [],
  colorblindMode = false,
  isExpanded = false,
  zoomLevel = 1,
  onCellClick,
  onChipClick,
  onCellContextMenu,
  onRangeSelect,
  onDragFill,
  onVacationToggle,
  onLegendEmployeeClick,
  onUpdateRow,
}: ScheduleMatrixProps) {
  const { t } = useTranslation(['schedule', 'common']);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [rowEditTarget, setRowEditTarget] = useState<RowEditTarget | null>(null);
  const daysInMonth = useMemo(() => {
    return new Date(data.year, data.month + 1, 0).getDate();
  }, [data.year, data.month]);

  // Track scroll state for edge-fade
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      // In RTL, scrollLeft is negative in some browsers
      const scrollPos = Math.abs(el.scrollLeft);
      setIsScrolled(scrollPos > 10);
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, []);

  // Build code → id map for legend
  const codeToId = useMemo(() => {
    const map = new Map<string, string>();
    for (const employee of data.legend) {
      map.set(employee.code, employee.employeeId);
    }
    for (const f of data.facilities) {
      for (const u of f.units) {
        for (const r of u.rows) {
          for (const day of Object.keys(r.cellsByDay)) {
            for (const a of r.cellsByDay[Number(day)]) {
              map.set(a.employeeCode, a.employeeId);
            }
          }
        }
      }
    }
    return map;
  }, [data]);

  // Count total rows per facility (for FacilityBand rowspan)
  const facilityRowCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of data.facilities) {
      let count = 0;
      for (const u of f.units) {
        count += u.rows.length;
      }
      counts.set(f.id, count);
    }
    return counts;
  }, [data]);

  const handleCellClick = useCallback(
    (ref: MatrixCellRef, meta?: CellInteractionMeta) => onCellClick?.(ref, meta),
    [onCellClick],
  );

  const handleChipClick = useCallback(
    (ref: MatrixCellRef, assignment: Assignment, meta?: CellInteractionMeta) => onChipClick?.(ref, assignment, meta),
    [onChipClick],
  );

  const handleVacationToggle = useCallback(
    (employeeId: string, day: number) => onVacationToggle?.(employeeId, day),
    [onVacationToggle],
  );

  const handleLegendClick = useCallback(
    (employeeId: string) => onLegendEmployeeClick?.(employeeId),
    [onLegendEmployeeClick],
  );

  const isEditable = editable || adminMode === 'edit';
  const canEditRows = isEditable && !!onUpdateRow;
  const isBrushMode = adminMode === 'brush';
  const isVacationMode = adminMode === 'vacations';
  let rowIndex = 0;

  return (
    <>
      <div className="md:hidden">
        <MobileWeeklySchedule data={data} onCellClick={handleCellClick} />
      </div>
      <div
        className="hidden gap-3 items-start md:flex"
        data-testid="desktop-schedule-matrix"
      >
      {/* ── Main Grid ── */}
      <div className="flex-1 min-w-0 overflow-hidden rounded-lg border border-border bg-surface shadow-soft">
        {/* Scroll container */}
        <div
          ref={scrollRef}
          className={cn(
            'matrix-scroll-container overflow-auto',
            isScrolled && 'is-scrolled',
          )}
          style={{ maxHeight: isExpanded ? 'calc(100vh - 160px)' : 'calc(100vh - 260px)' }}
          role="grid"
          aria-label={t('schedule:matrix.gridAriaLabel')}
        >
          {/* Inner sizing wrapper */}
          <div style={{ minWidth: `calc(var(--matrix-facility-col) + var(--matrix-label-col) + var(--matrix-day-col) * ${daysInMonth})`, zoom: zoomLevel }}>
            {/* ── Sticky Header Row ── */}
            <div
              className="flex sticky top-0 z-20"
              role="row"
            >
              {/* Corner: facility col placeholder */}
              <div
                className="shrink-0 sticky z-30 bg-surface-muted border-b border-e border-border"
                style={{
                  width: 'var(--matrix-facility-col)',
                  minWidth: 'var(--matrix-facility-col)',
                  height: 'var(--matrix-header-height)',
                  insetInlineStart: 0,
                }}
              />
              {/* Corner: label col placeholder */}
              <div
                className="shrink-0 sticky z-30 bg-surface-muted border-b border-e border-border flex items-center px-2"
                style={{
                  width: 'var(--matrix-label-col)',
                  minWidth: 'var(--matrix-label-col)',
                  height: 'var(--matrix-header-height)',
                  insetInlineStart: 'var(--matrix-facility-col)',
                }}
              >
                <span className="text-[10px] font-semibold text-text-secondary">
                  {t('schedule:matrix.unitShiftLabel')}
                </span>
              </div>
              {/* Day numbers */}
              <DayHeaderRow
                daysInMonth={daysInMonth}
                year={data.year}
                month={data.month}
                holidays={data.holidays}
              />
            </div>

            {/* ── Facility Rows ── */}
            {data.facilities.map((facility) => {
              const rowCount = facilityRowCounts.get(facility.id) || 1;
              return (
                <div key={facility.id} className="flex">
                  {/* Frozen col 1: facility band */}
                  <div
                    className="shrink-0 sticky z-10"
                    style={{ insetInlineStart: 0 }}
                  >
                    <FacilityBand
                      name={facility.name}
                      accentColorToken={facility.accentColorToken}
                      rowCount={rowCount}
                    />
                  </div>

                  {/* Rows within facility */}
                  <div className="flex flex-col">
                    {facility.units.length === 0 && (
                      <div className="flex">
                        <div
                          className="shrink-0 sticky z-10"
                          style={{ insetInlineStart: 'var(--matrix-facility-col)' }}
                        >
                          <div
                            className="flex items-center px-3 text-xs font-bold text-primary-teal bg-surface-muted border-b border-e border-border"
                            style={{
                              width: 'var(--matrix-label-col)',
                              minWidth: 'var(--matrix-label-col)',
                              height: 'var(--matrix-row-height)',
                            }}
                          >
                            {t('schedule:matrix.addFirstUnit')}
                          </div>
                        </div>
                        <div
                          className="flex items-center px-4 text-xs text-text-secondary bg-surface border-b border-e border-border"
                          style={{
                            width: `calc(var(--matrix-day-col) * ${daysInMonth})`,
                            height: 'var(--matrix-row-height)',
                          }}
                        >
                          {t('schedule:matrix.noUnits')}
                        </div>
                      </div>
                    )}
                    {facility.units.map((unit) => (
                      <div
                        key={unit.id}
                        data-testid={`unit-group-${unit.id}`}
                        className="flex flex-col"
                      >
                      {unit.rows.map((row, rowPosition) => {
                        const currentRowIndex = rowIndex;
                        rowIndex += 1;
                        return (
                        <div key={row.id} className="flex">
                          {/* Frozen col 2: unit/shift label */}
                          <div
                            className="shrink-0 sticky z-10"
                            style={{ insetInlineStart: 'var(--matrix-facility-col)' }}
                          >
                            <UnitShiftLabel
                              unitName={unit.name}
                              rowLabel={row.rowLabel}
                              shiftLabel={row.shiftLabel}
                              timeRange={row.timeRange}
                              isOverflowRow={row.isOverflowRow}
                              weekendOnly={row.weekendOnly}
                              isEditable={canEditRows}
                              showUnitName={rowPosition === 0}
                              onEditRow={
                                canEditRows
                                  ? (anchorRect) =>
                                      setRowEditTarget({ row, unitName: unit.name, anchorRect })
                                  : undefined
                              }
                            />
                          </div>

                          {/* Day cells */}
                          <ShiftRowCells
                            row={row}
                            rowIndex={currentRowIndex}
                            facilityId={facility.id}
                            facilityName={facility.name}
                            unitId={unit.id}
                            unitName={unit.name}
                            daysInMonth={daysInMonth}
                            year={data.year}
                            month={data.month}
                            legend={data.legend}
                            auditLog={data.auditLog}
                            highlightedEmployeeId={highlightedEmployeeId}
                            selectedCells={selectedCells}
                            isEditable={isEditable}
                            isVacationMode={isVacationMode}
                            isBrushMode={isBrushMode}
                            brushEmployeeCodes={brushEmployeeCodes}
                            colorblindMode={colorblindMode}
                            holidays={data.holidays}
                            onCellClick={handleCellClick}
                            onChipClick={handleChipClick}
                            onCellContextMenu={onCellContextMenu}
                            onRangeSelect={onRangeSelect}
                            onDragFill={onDragFill}
                          />
                        </div>
                        );
                      })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* ── Vacation Band ── */}
            {data.vacations.length > 0 && (
              <VacationBand
                vacations={data.vacations}
                daysInMonth={daysInMonth}
                year={data.year}
                month={data.month}
                adminMode={adminMode}
                onVacationToggle={handleVacationToggle}
                holidays={data.holidays}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Legend Panel (trailing side = left in RTL) ── */}
      <LegendPanel
        legend={data.legend}
        month={data.month}
        year={data.year}
        highlightedEmployeeId={highlightedEmployeeId}
        brushEmployeeCodes={brushEmployeeCodes}
        onEmployeeClick={handleLegendClick}
        codeToId={codeToId}
      />

      <RowEditPopover
        target={rowEditTarget}
        onClose={() => setRowEditTarget(null)}
        onSave={(rowId, updates) => onUpdateRow?.(rowId, updates)}
      />
      </div>
    </>
  );
}

export default memo(ScheduleMatrix);
