// ============================================================
// ContextMenu — Right-click quick actions
// ============================================================

import { memo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy,
  ClipboardPaste,
  ArrowRightLeft,
  Trash2,
  CalendarPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContextMenuState, ShiftCategory } from '../types/schedule';

interface ContextMenuProps {
  contextMenu: ContextMenuState | null;
  onClose: () => void;
  clipboardCategory: ShiftCategory | undefined;
  onCopy: (categoryId: ShiftCategory) => void;
  onPaste: () => void;
  onDelete: () => void;
}

function ContextMenu({
  contextMenu,
  onClose,
  clipboardCategory,
  onCopy,
  onPaste,
  onDelete,
}: ContextMenuProps) {
  useEffect(() => {
    function handleClick() {
      if (contextMenu) onClose();
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu, onClose]);

  return (
    <AnimatePresence>
      {contextMenu && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className={cn(
            'fixed z-[100] w-48 rounded-xl border border-border bg-surface p-1.5 shadow-dropdown',
            'dark:bg-slate-900 dark:border-slate-800'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.entry ? (
            <>
              <button
                onClick={() => {
                  onCopy(contextMenu.entry!.shiftCategory);
                  onClose();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-text-primary hover:bg-hover dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Copy className="h-4 w-4 text-blue-500" />
                Copy Shift
              </button>
              <button
                onClick={() => {
                  // Swap logic
                  onClose();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-text-primary hover:bg-hover dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ArrowRightLeft className="h-4 w-4 text-amber-500" />
                Swap Shift
              </button>
              <div className="my-1 border-t border-border dark:border-slate-700" />
              <button
                onClick={() => {
                  onDelete();
                  onClose();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/30"
              >
                <Trash2 className="h-4 w-4" />
                Delete Shift
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  // Assign logic
                  onClose();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-text-primary hover:bg-hover dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <CalendarPlus className="h-4 w-4 text-emerald-500" />
                Assign Shift
              </button>
              <button
                onClick={() => {
                  onPaste();
                  onClose();
                }}
                disabled={!clipboardCategory}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium',
                  clipboardCategory
                    ? 'text-text-primary hover:bg-hover dark:text-slate-200 dark:hover:bg-slate-800'
                    : 'text-text-secondary opacity-50 cursor-not-allowed dark:text-text-secondary'
                )}
              >
                <ClipboardPaste className="h-4 w-4 text-primary" />
                Paste
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(ContextMenu);
