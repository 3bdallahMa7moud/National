import Card from '@/components/ui/Card';
import ScheduleMatrix from '@/components/schedule/ScheduleMatrix/ScheduleMatrix';
import LateScheduleDesktopGrid from '@/features/late-schedule/LateScheduleDesktopGrid';
import LateScheduleMobileWeek from '@/features/late-schedule/LateScheduleMobileWeek';
import type { UnifiedEmployee } from '@/lib/unifiedEmployeeRoster';
import type { OTShiftRow, OTUnit } from '@/types/lateSchedule';
import type { Assignment, MatrixCellRef, ScheduleMatrixData } from '@/types/scheduleMatrix';

export type PublishedScheduleTab = 'schedule' | 'ot';

interface PublishedScheduleSurfaceProps {
  tab: PublishedScheduleTab;
  year: number;
  month: number;
  matrix: ScheduleMatrixData | null;
  otTable: { rows: OTShiftRow[]; units: OTUnit[] } | null;
  roster: UnifiedEmployee[];
  highlightedEmployeeId?: string;
  emptyScheduleText: string;
  emptyOTText: string;
  onScheduleAssignmentClick?: (ref: MatrixCellRef, assignment: Assignment) => void;
  onOTAssignmentClick?: (rowId: string, day: number, employeeId: string) => void;
}

export default function PublishedScheduleSurface({
  tab,
  year,
  month,
  matrix,
  otTable,
  roster,
  highlightedEmployeeId,
  emptyScheduleText,
  emptyOTText,
  onScheduleAssignmentClick,
  onOTAssignmentClick,
}: PublishedScheduleSurfaceProps) {
  if (tab === 'schedule') {
    if (!matrix) {
      return <Card className="py-10 text-center"><p className="font-medium text-text-primary">{emptyScheduleText}</p></Card>;
    }
    return (
      <div data-testid="employee-published-schedule" data-read-only="true">
        <ScheduleMatrix
          data={matrix}
          readOnly
          editable={false}
          adminMode="view"
          highlightedEmployeeId={highlightedEmployeeId || null}
          onChipClick={onScheduleAssignmentClick}
        />
      </div>
    );
  }

  if (!otTable) {
    return <Card className="py-10 text-center"><p className="font-medium text-text-primary">{emptyOTText}</p></Card>;
  }

  return (
    <div data-testid="employee-published-ot" data-read-only="true">
      <LateScheduleDesktopGrid
        year={year}
        month={month}
        rows={otTable.rows}
        units={otTable.units}
        roster={roster}
        onAssignmentClick={onOTAssignmentClick}
      />
      <LateScheduleMobileWeek
        year={year}
        month={month}
        rows={otTable.rows}
        units={otTable.units}
        roster={roster}
        onAssignmentClick={onOTAssignmentClick}
      />
    </div>
  );
}
