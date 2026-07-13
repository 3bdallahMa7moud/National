// ============================================================
// StatisticsCards — Animated KPI cards row
// ============================================================

import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Sun,
  Sunset,
  Moon,
  Palmtree,
  Phone,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScheduleStats } from '../types/schedule';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  bgColor: string;
  delay: number;
}

function StatCard({ icon, label, value, color, bgColor, delay }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn(
        'relative overflow-hidden rounded-xl border border-border bg-surface p-4',
        'shadow-soft hover:shadow-md transition-shadow duration-300',
        'dark:bg-slate-900 dark:border-slate-800'
      )}
    >
      {/* Decorative gradient blob */}
      <div
        className={cn('absolute -top-6 -right-6 h-20 w-20 rounded-full opacity-10 blur-2xl', bgColor)}
      />

      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg',
            bgColor
          )}
        >
          <span className={color}>{icon}</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-text-secondary dark:text-text-muted truncate">
            {label}
          </p>
          <p className={cn('text-xl font-bold tracking-tight', color)}>
            {value.toLocaleString()}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

interface StatisticsCardsProps {
  stats: ScheduleStats;
}

function StatisticsCards({ stats }: StatisticsCardsProps) {
  const cards = [
    {
      icon: <Users className="h-5 w-5" />,
      label: 'Total Employees',
      value: stats.totalEmployees,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      icon: <Sun className="h-5 w-5" />,
      label: 'Day Shifts',
      value: stats.morningShifts,
      color: 'text-sky-600 dark:text-sky-400',
      bgColor: 'bg-sky-100 dark:bg-sky-900/30',
    },
    {
      icon: <Sunset className="h-5 w-5" />,
      label: 'Evening Shifts',
      value: stats.eveningShifts,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    },
    {
      icon: <Moon className="h-5 w-5" />,
      label: 'Night Shifts',
      value: stats.nightShifts,
      color: 'text-violet-600 dark:text-violet-400',
      bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    },
    {
      icon: <Palmtree className="h-5 w-5" />,
      label: 'Vacations',
      value: stats.vacations,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    },
    {
      icon: <Phone className="h-5 w-5" />,
      label: 'On Call',
      value: stats.onCall,
      color: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-100 dark:bg-rose-900/30',
    },
    {
      icon: <Clock className="h-5 w-5" />,
      label: 'Pending Requests',
      value: stats.pendingRequests,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
      {cards.map((card, i) => (
        <StatCard key={card.label} {...card} delay={i * 0.05} />
      ))}
    </div>
  );
}

export default memo(StatisticsCards);
