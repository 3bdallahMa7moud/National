// ============================================================
// ScheduleToolbar — Top navigation & actions bar
// ============================================================

import { memo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Search,
  Download,
  Printer,
  FileSpreadsheet,
  FileText,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ScheduleToolbarProps {
  year: number;
  month: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

function ScheduleToolbar({
  year,
  month,
  onPrevMonth,
  onNextMonth,
  onToday,
  searchQuery,
  onSearchChange,
}: ScheduleToolbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const monthLabel = format(new Date(year, month, 1), 'MMMM yyyy');

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [searchOpen]);

  // Close export menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const navBtnClasses = cn(
    'flex h-9 w-9 items-center justify-center rounded-lg border border-border',
    'bg-surface text-text-secondary hover:bg-gray-50 hover:text-text-primary',
    'dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400',
    'dark:hover:bg-slate-800 dark:hover:text-slate-200',
    'transition-all duration-150 active:scale-95'
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border',
        'bg-surface px-4 py-3 shadow-soft',
        'dark:bg-slate-900 dark:border-slate-800'
      )}
    >
      {/* Left: Title & Month Navigation */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-lg font-bold text-text-primary dark:text-white tracking-tight">
            Schedule Management
          </h1>
          <p className="text-xs text-text-secondary dark:text-slate-400">
            Hospital Employee Scheduling
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 ml-4">
          <button
            onClick={onPrevMonth}
            className={navBtnClasses}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div
            className={cn(
              'flex items-center gap-2 rounded-lg border border-border px-4 py-1.5',
              'bg-white dark:bg-slate-800 dark:border-slate-700',
              'min-w-[160px] justify-center'
            )}
          >
            <CalendarDays className="h-4 w-4 text-primary dark:text-primary-400" />
            <span className="text-sm font-semibold text-text-primary dark:text-white">
              {monthLabel}
            </span>
          </div>

          <button
            onClick={onNextMonth}
            className={navBtnClasses}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <button
            onClick={onToday}
            className={cn(
              'ml-1 rounded-lg border border-primary/30 bg-primary-50 px-3 py-1.5',
              'text-xs font-semibold text-primary',
              'hover:bg-primary-100 transition-colors duration-150',
              'dark:bg-primary/10 dark:border-primary/20 dark:text-primary-400',
              'dark:hover:bg-primary/20'
            )}
          >
            Today
          </button>
        </div>
      </div>

      {/* Right: Search & Export */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <AnimatePresence>
          {searchOpen ? (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-secondary" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search employee..."
                  className={cn(
                    'h-9 w-full rounded-lg border border-border bg-white pl-8 pr-8 text-xs',
                    'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                    'dark:bg-slate-800 dark:border-slate-700 dark:text-white',
                    'placeholder:text-text-secondary'
                  )}
                  aria-label="Search employees"
                />
                <button
                  onClick={() => {
                    onSearchChange('');
                    setSearchOpen(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className={navBtnClasses}
              aria-label="Search employees"
            >
              <Search className="h-4 w-4" />
            </button>
          )}
        </AnimatePresence>

        {/* Export Menu */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen(!exportOpen)}
            className={cn(navBtnClasses, exportOpen && 'ring-2 ring-primary/20 border-primary')}
            aria-label="Export schedule"
          >
            <Download className="h-4 w-4" />
          </button>

          <AnimatePresence>
            {exportOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  'absolute right-0 top-full mt-2 z-50 w-52 rounded-xl border border-border',
                  'bg-surface shadow-dropdown p-1.5',
                  'dark:bg-slate-900 dark:border-slate-700'
                )}
              >
                <button
                  onClick={() => setExportOpen(false)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium',
                    'text-text-primary hover:bg-gray-50 transition-colors',
                    'dark:text-slate-200 dark:hover:bg-slate-800'
                  )}
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                  Export as Excel (.xlsx)
                </button>
                <button
                  onClick={() => setExportOpen(false)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium',
                    'text-text-primary hover:bg-gray-50 transition-colors',
                    'dark:text-slate-200 dark:hover:bg-slate-800'
                  )}
                >
                  <FileText className="h-4 w-4 text-red-500" />
                  Export as PDF
                </button>
                <div className="my-1 border-t border-border dark:border-slate-700" />
                <button
                  onClick={() => {
                    setExportOpen(false);
                    window.print();
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium',
                    'text-text-primary hover:bg-gray-50 transition-colors',
                    'dark:text-slate-200 dark:hover:bg-slate-800'
                  )}
                >
                  <Printer className="h-4 w-4 text-blue-500" />
                  Print Schedule
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile Month Nav */}
      <div className="flex sm:hidden items-center gap-1.5 w-full">
        <button onClick={onPrevMonth} className={navBtnClasses}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-3 py-1.5',
            'bg-white dark:bg-slate-800 dark:border-slate-700'
          )}
        >
          <CalendarDays className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-text-primary dark:text-white">
            {monthLabel}
          </span>
        </div>
        <button onClick={onNextMonth} className={navBtnClasses}>
          <ChevronRight className="h-4 w-4" />
        </button>
        <button onClick={onToday} className={cn(navBtnClasses, 'text-primary border-primary/30 bg-primary-50')}>
          <CalendarDays className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

export default memo(ScheduleToolbar);
