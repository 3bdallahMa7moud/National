// ============================================================
// EmployeeChip - LTR employee code chip with conflict/history hints
// ============================================================

import { memo, useState, useRef, type ReactNode } from 'react';
import { Bell, Clock3, Moon, SunMedium } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { getShiftChipStyle } from './getShiftChipClasses';
import { resolveAssignmentColorKey } from '@/lib/shiftColorOptions';
import type { Assignment, AuditEntry, ShiftColorKey } from '@/types/scheduleMatrix';

interface EmployeeChipProps {
  assignment: Assignment;
  /** Row default when assignment has no colorKey override */
  rowColorKey: ShiftColorKey;
  fullName?: string;
  shiftLabel: string;
  timeRange: string;
  facilityName: string;
  unitName: string;
  day: number;
  monthLabel: string;
  isHighlighted: boolean;
  colorblindMode?: boolean;
  historyEntries?: AuditEntry[];
  suppressPopover?: boolean;
  onClick?: () => void;
}

const markerIcons: Record<ShiftColorKey, ReactNode> = {
  morning: <SunMedium className="h-3 w-3" />,
  evening: <Clock3 className="h-3 w-3" />,
  night: <Moon className="h-3 w-3" />,
  onCall: <Bell className="h-3 w-3" />,
  onCallNight: <Moon className="h-3 w-3" />,
  overtime: <Bell className="h-3 w-3" />,
  vacation: <Clock3 className="h-3 w-3" />,
};

function EmployeeChip({
  assignment,
  rowColorKey,
  fullName,
  shiftLabel,
  timeRange,
  facilityName,
  unitName,
  day,
  monthLabel,
  isHighlighted,
  colorblindMode = false,
  historyEntries = [],
  suppressPopover = false,
  onClick,
}: EmployeeChipProps) {
  const { t } = useTranslation(['schedule', 'common']);
  const [showPopover, setShowPopover] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);

  const chipStyle = getShiftChipStyle(resolveAssignmentColorKey(assignment, rowColorKey));
  const isDraft = assignment.status === 'draft';
  const ariaLabel = `${fullName || assignment.employeeCode} - ${shiftLabel} - ${day} ${monthLabel} - ${facilityName} ${unitName}`;
  const lastHistory = historyEntries.slice(0, 3);

  return (
    <div className="relative inline-flex max-w-full">
      <button
        ref={chipRef}
        dir="ltr"
        data-employee-code={assignment.employeeCode}
        data-employee-id={assignment.employeeId}
        onClick={(event) => {
          event.stopPropagation();
          if (!suppressPopover) setShowPopover(!showPopover);
          onClick?.();
        }}
        onBlur={() => setTimeout(() => setShowPopover(false), 200)}
        className={cn(
          'inline-flex min-w-0 items-center justify-center font-bold leading-tight border border-black/10',
          'gap-1 rounded-[6px] px-1.5 py-[3px] text-[11px] shadow-sm',
          'transition-all duration-150 cursor-pointer select-none hover:opacity-90',
          'focus:outline-none focus:ring-2 focus:ring-signal-cyan',
          isHighlighted && 'ring-2 ring-signal-cyan ring-offset-1 scale-105 z-10',
          isDraft && 'outline outline-1 outline-dashed outline-primary-teal',
        )}
        style={{
          ...chipStyle,
          unicodeBidi: 'isolate',
          maxWidth: 'calc(var(--matrix-day-col) - 8px)',
        }}
        aria-label={ariaLabel}
      >
        {colorblindMode && (
          <span className="shrink-0" aria-hidden="true">
            {markerIcons[resolveAssignmentColorKey(assignment, rowColorKey)]}
          </span>
        )}
        <span className="truncate">{assignment.employeeCode}</span>
      </button>

      {showPopover && !suppressPopover && (
        <div
          className={cn(
            'absolute z-50 top-full mt-1 w-64 rounded-lg border shadow-dropdown p-3',
            'bg-surface border-border text-right',
          )}
          style={{ insetInlineStart: 0 }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink truncate">{fullName || assignment.employeeCode}</p>
              <div className="mt-1.5 space-y-1 text-[11px] text-text-secondary">
                <p>{shiftLabel} · {timeRange}</p>
                <p dir="ltr" style={{ unicodeBidi: 'isolate' }}>{facilityName} / {unitName}</p>
              </div>
            </div>
            {isDraft && (
              <span className="rounded-full bg-primary-teal/10 px-2 py-0.5 text-[10px] font-bold text-primary-teal">
                {t('schedule:employeeChip.draftBadge')}
              </span>
            )}
          </div>

          {lastHistory.length > 0 && (
            <div className="mt-3 border-t border-border pt-2">
              <p className="mb-1.5 text-[10px] font-bold text-text-secondary">{t('schedule:employeeChip.recentChanges')}</p>
              <div className="space-y-1">
                {lastHistory.map((entry) => (
                  <div key={entry.id} className="rounded-md bg-surface-muted px-2 py-1 text-[10px] text-text-secondary">
                    <span className="font-semibold text-ink">{entry.actorName}</span>
                    <span> · {entry.newValue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.stopPropagation();
              onClick?.();
              setShowPopover(false);
            }}
            className={cn(
              'mt-2.5 w-full rounded-md px-3 py-1.5 text-xs font-semibold',
              'bg-primary-teal text-white hover:bg-primary-teal/90',
              'transition-colors duration-150',
            )}
          >
            {t('schedule:employeeChip.editAssignment')}
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(EmployeeChip);
