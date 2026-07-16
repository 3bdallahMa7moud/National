// ============================================================
// SideDrawer — Shift details & actions drawer
// ============================================================
// Slides in from the right when a schedule cell is clicked.
// Shows employee info, shift details, and action buttons.

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  User,
  Building2,
  Clock,
  Calendar,
  FileText,
  ArrowRightLeft,
  Copy,
  Trash2,
  UserPlus,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SHIFT_THEMES } from '../utils/constants';
import type { DrawerState } from '../types/schedule';

interface SideDrawerProps {
  drawer: DrawerState;
  onClose: () => void;
}

function SideDrawer({ drawer, onClose }: SideDrawerProps) {
  const { isOpen, entry, employee } = drawer;

  return (
    <AnimatePresence>
      {isOpen && entry && employee && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className={cn(
              'fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto',
              'bg-surface border-l border-border shadow-2xl',
              'dark:bg-slate-900 dark:border-slate-800'
            )}
            role="dialog"
            aria-label="Shift details"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border dark:border-slate-800 bg-surface dark:bg-slate-900 px-6 py-4">
              <h2 className="text-base font-bold text-text-primary dark:text-white">
                Shift Details
              </h2>
              <button
                onClick={onClose}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg',
                  'text-text-secondary hover:bg-hover hover:text-text-primary',
                  'dark:text-text-muted dark:hover:bg-slate-800 dark:hover:text-white',
                  'transition-colors duration-150'
                )}
                aria-label="Close drawer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6 p-6">
              {/* Shift Badge */}
              {(() => {
                const theme = SHIFT_THEMES[entry.shiftCategory];
                return (
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold border',
                        theme.bg, theme.bgDark, theme.text, theme.textDark, theme.border
                      )}
                    >
                      {theme.label}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-text-primary dark:text-white">
                        {theme.fullLabel}
                      </p>
                      <p className="text-xs text-text-secondary dark:text-text-muted">
                        {entry.startTime} — {entry.endTime}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Employee Info */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-text-secondary dark:text-text-muted uppercase tracking-wider">
                  Employee Information
                </h3>
                <div className="rounded-xl border border-border dark:border-slate-800 bg-surface-muted/50 dark:bg-slate-800/50 p-4 space-y-3">
                  <InfoRow icon={<User className="h-4 w-4" />} label="Name" value={employee.name} />
                  <InfoRow icon={<Building2 className="h-4 w-4" />} label="Department" value={employee.departmentName} />
                  <InfoRow icon={<MapPin className="h-4 w-4" />} label="Room" value={employee.roomName} />
                  <InfoRow icon={<Calendar className="h-4 w-4" />} label="Date" value={entry.date} />
                  <InfoRow icon={<Clock className="h-4 w-4" />} label="Hours" value={`${entry.startTime} – ${entry.endTime}`} />
                  {entry.notes && (
                    <InfoRow icon={<FileText className="h-4 w-4" />} label="Notes" value={entry.notes} />
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-text-secondary dark:text-text-muted uppercase tracking-wider">
                  Actions
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <ActionButton
                    icon={<ArrowRightLeft className="h-4 w-4" />}
                    label="Swap Shift"
                    color="text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400"
                    onClick={() => {}}
                  />
                  <ActionButton
                    icon={<Copy className="h-4 w-4" />}
                    label="Duplicate"
                    color="text-violet-600 bg-violet-50 border-violet-200 hover:bg-violet-100 dark:bg-violet-950/30 dark:border-violet-800 dark:text-violet-400"
                    onClick={() => {}}
                  />
                  <ActionButton
                    icon={<UserPlus className="h-4 w-4" />}
                    label="Assign Other"
                    color="text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400"
                    onClick={() => {}}
                  />
                  <ActionButton
                    icon={<Trash2 className="h-4 w-4" />}
                    label="Delete Shift"
                    color="text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400"
                    onClick={() => {}}
                  />
                </div>
              </div>

              {/* Shift History Placeholder */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-text-secondary dark:text-text-muted uppercase tracking-wider">
                  Shift History
                </h3>
                <div className="rounded-xl border border-border dark:border-slate-800 bg-surface-muted/50 dark:bg-slate-800/50 p-4">
                  <div className="space-y-2">
                    <HistoryItem
                      action="Shift assigned"
                      by="Dr. Ishraq"
                      time="2 days ago"
                      color="text-emerald-600"
                    />
                    <HistoryItem
                      action="Changed from Day Shift to Evening"
                      by="System"
                      time="5 days ago"
                      color="text-amber-600"
                    />
                    <HistoryItem
                      action="Shift created"
                      by="Admin"
                      time="1 week ago"
                      color="text-blue-600"
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Helper Components ──

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-text-secondary dark:text-text-secondary">{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="text-[10px] text-text-secondary dark:text-text-secondary block">{label}</span>
        <span className="text-xs font-medium text-text-primary dark:text-white">{value}</span>
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium',
        'transition-colors duration-150',
        color
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function HistoryItem({
  action,
  by,
  time,
  color,
}: {
  action: string;
  by: string;
  time: string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className={cn('mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0', color.replace('text-', 'bg-'))} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-text-primary dark:text-slate-200">{action}</p>
        <p className="text-[10px] text-text-secondary dark:text-text-secondary">
          by {by} · {time}
        </p>
      </div>
    </div>
  );
}

export default memo(SideDrawer);
