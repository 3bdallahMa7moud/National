// ============================================================
// CellContextMenu - Spreadsheet-style right-click actions
// ============================================================

import { memo, useEffect } from 'react';
import { CalendarOff, Copy, History, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface CellContextMenuProps {
  position: { x: number; y: number };
  hasAssignments: boolean;
  onClose: () => void;
  onAssign: () => void;
  onRemove: () => void;
  onMarkVacation: () => void;
  onHistory: () => void;
  onDuplicateNextDay: () => void;
}

function CellContextMenu({
  position,
  hasAssignments,
  onClose,
  onAssign,
  onRemove,
  onMarkVacation,
  onHistory,
  onDuplicateNextDay,
}: CellContextMenuProps) {
  const { t } = useTranslation(['schedule', 'common']);
  useEffect(() => {
    const close = () => onClose();
    document.addEventListener('click', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', close);
    };
  }, [onClose]);

  const top = Math.min(position.y, window.innerHeight - 240);
  const left = Math.min(position.x, window.innerWidth - 230);

  const itemClass = 'flex w-full items-center gap-2 px-3 py-2 text-start text-xs font-semibold transition-colors hover:bg-hover';

  return (
    <div
      className="fixed z-[240] w-56 overflow-hidden rounded-lg border border-border bg-surface py-1.5 text-ink shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      style={{ top, left }}
      role="menu"
    >
      <button className={itemClass} onClick={onAssign} role="menuitem">
        <Pencil className="h-4 w-4 text-primary-teal shrink-0" />
        <span>{t('schedule:matrix.assignOrEdit')}</span>
      </button>
      <button
        className={cn(itemClass, !hasAssignments && 'opacity-40 cursor-not-allowed')}
        onClick={hasAssignments ? onRemove : undefined}
        role="menuitem"
      >
        <Trash2 className="h-4 w-4 text-alert-coral shrink-0" />
        <span>{t('schedule:matrix.clearCell')}</span>
      </button>
      <button
        className={cn(itemClass, !hasAssignments && 'opacity-40 cursor-not-allowed')}
        onClick={hasAssignments ? onMarkVacation : undefined}
        role="menuitem"
      >
        <CalendarOff className="h-4 w-4 text-text-secondary shrink-0" />
        <span>{t('schedule:matrix.convertToVacation')}</span>
      </button>
      <button className={itemClass} onClick={onHistory} role="menuitem">
        <History className="h-4 w-4 text-text-secondary shrink-0" />
        <span>{t('schedule:matrix.auditLog')}</span>
      </button>
      <button
        className={cn(itemClass, !hasAssignments && 'opacity-40 cursor-not-allowed')}
        onClick={hasAssignments ? onDuplicateNextDay : undefined}
        role="menuitem"
      >
        <Copy className="h-4 w-4 text-primary-teal shrink-0" />
        <span>{t('schedule:matrix.copyToNextDay')}</span>
      </button>
    </div>
  );
}

export default memo(CellContextMenu);
