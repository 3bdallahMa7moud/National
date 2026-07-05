// ============================================================
// Legend — Shift type color legend
// ============================================================

import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { SHIFT_THEMES } from '../utils/constants';
import type { ShiftCategory } from '../types/schedule';

const LEGEND_ITEMS: ShiftCategory[] = [
  'morning', 'evening', 'night', 'vacation', 'off',
  'oncall', 'training', 'pending', 'weekend', 'holiday', 'sick', 'overtime',
];

function Legend() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border',
        'bg-surface px-4 py-3 shadow-soft',
        'dark:bg-slate-900 dark:border-slate-800'
      )}
    >
      <span className="text-xs font-semibold text-text-secondary dark:text-slate-400 mr-1">
        Legend:
      </span>
      {LEGEND_ITEMS.map((category) => {
        const theme = SHIFT_THEMES[category];
        return (
          <div key={category} className="flex items-center gap-1.5">
            <span
              className={cn(
                'inline-flex h-5 min-w-[28px] items-center justify-center rounded-md px-1.5',
                'text-[10px] font-bold border',
                theme.bg, theme.bgDark, theme.text, theme.textDark, theme.border
              )}
            >
              {theme.label}
            </span>
            <span className="text-[11px] text-text-secondary dark:text-slate-400">
              {theme.fullLabel}
            </span>
          </div>
        );
      })}
    </motion.div>
  );
}

export default memo(Legend);
