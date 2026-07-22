// ============================================================
// EmployeeChip - LTR employee code chip with conflict/history hints
// ============================================================

import { memo, useState, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Clock3, Moon, SunMedium } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { getShiftChipStyle } from './getShiftChipClasses';
import { resolveAssignmentColorKey } from '@/lib/shiftColorOptions';
import type { Assignment, AuditEntry, ShiftColorKey } from '@/types/scheduleMatrix';

const markerIcons: Partial<Record<ShiftColorKey, ReactNode>> = {
  morning:     <SunMedium className="h-3 w-3" />,
  evening:     <Clock3   className="h-3 w-3" />,
  night:       <Moon     className="h-3 w-3" />,
  onCall:      <Bell     className="h-3 w-3" />,
  onCallNight: <Moon     className="h-3 w-3" />,
  overtime:    <Bell     className="h-3 w-3" />,
};

interface EmployeeChipProps {
  assignment: Assignment;
  /** Row default when assignment has no colorKey override */
  rowColorKey: ShiftColorKey;
  rowBackgroundColor?: string;
  rowTextColor?: string;
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
  /** Employee-facing mode: keep shift details, but never expose audit or edit actions. */
  readOnly?: boolean;
  suppressPopover?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

function EmployeeChip({
  assignment,
  rowColorKey,
  rowBackgroundColor,
  rowTextColor,
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
  readOnly = false,
  suppressPopover = false,
  compact = false,
  onClick,
}: EmployeeChipProps) {
  const { t } = useTranslation(['schedule', 'common']);
  const [showPopover, setShowPopover] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);

  const chipStyle = getShiftChipStyle(
    resolveAssignmentColorKey(assignment, rowColorKey),
    rowBackgroundColor,
    rowTextColor,
  );
  const isDraft = assignment.status === 'draft';
  const ariaLabel = `${fullName || assignment.employeeCode} - ${shiftLabel} - ${day} ${monthLabel} - ${facilityName} ${unitName}`;
  const lastHistory = historyEntries.slice(0, 3);

  const rect = chipRef.current?.getBoundingClientRect();
  const popoverTop = (rect?.bottom || 0) + 4;
  const popoverLeft = Math.min(rect?.left || 0, (typeof window !== 'undefined' ? window.innerWidth : 1000) - 272);

  return (
    <div className="relative inline-flex max-w-full">
      <button
        ref={chipRef}
        dir="ltr"
        data-employee-code={assignment.employeeCode}
        data-employee-id={assignment.employeeId}
        onClick={(event) => {
          event.stopPropagation();
          if (onClick) {
            onClick();
            return;
          }
          if (readOnly) {
            return;
          }
          if (!suppressPopover) setShowPopover(!showPopover);
        }}
        onBlur={() => setTimeout(() => setShowPopover(false), 200)}
        className={cn(
          'inline-flex min-w-0 items-center justify-center font-bold leading-none border',
          compact ? 'w-full rounded-[3px] px-1 py-[1px] text-[10px] shadow-none border-black/5' : 'gap-1 rounded-[6px] px-1.5 py-[3px] text-[11px] shadow-sm border-black/10',
          'transition-all duration-150 cursor-pointer select-none hover:opacity-90',
          'focus:outline-none focus:ring-2 focus:ring-signal-cyan',
          isHighlighted && 'ring-2 ring-signal-cyan ring-offset-1 scale-105 z-10',
          isDraft && 'outline outline-1 outline-dashed outline-primary-teal',
        )}
        style={{
          ...chipStyle,
          unicodeBidi: 'isolate',
          maxWidth: compact ? '100%' : 'calc(var(--matrix-day-col) - 8px)',
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

      {showPopover && !suppressPopover && typeof document !== 'undefined' && createPortal(
        <div
          className={cn(
            'fixed z-[9999] w-64 rounded-lg border shadow-dropdown p-3 animate-in fade-in duration-150',
            'bg-surface border-border text-right',
          )}
          style={{ top: `${popoverTop}px`, left: `${popoverLeft}px` }}
          onClick={(e) => e.stopPropagation()}
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

          {!readOnly && lastHistory.length > 0 && (
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

          {!readOnly && (
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
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

export default memo(EmployeeChip);
