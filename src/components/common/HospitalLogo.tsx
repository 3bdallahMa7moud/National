import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export interface HospitalLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'white' | 'colored';
  showText?: boolean;
  subtitle?: string;
  className?: string;
}

export default function HospitalLogo({
  size = 'md',
  variant = 'default',
  showText = true,
  subtitle,
  className,
}: HospitalLogoProps) {
  const { t } = useTranslation(['common']);
  const displaySubtitle = subtitle ?? t('common:hospital.subtitleDefault');

  const sizeMap = {
    sm: { icon: 'w-8 h-8', title: 'text-xs font-bold', sub: 'text-[10px]' },
    md: { icon: 'w-10 h-10', title: 'text-sm font-bold', sub: 'text-xs' },
    lg: { icon: 'w-12 h-12', title: 'text-base font-bold', sub: 'text-xs' },
    xl: { icon: 'w-16 h-16', title: 'text-xl font-extrabold', sub: 'text-sm' },
  };

  const { icon: iconClass, title: titleClass, sub: subClass } = sizeMap[size];
  const isWhite = variant === 'white';

  return (
    <div className={cn('flex items-center gap-3.5 select-none', className)}>
      <div
        className={cn(
          'relative flex-shrink-0 flex items-center justify-center rounded-2xl p-1.5 shadow-md transition-transform hover:scale-105 duration-300',
          iconClass,
          isWhite
            ? 'bg-white/10 ring-1 ring-white/20 backdrop-blur-md shadow-inner'
            : 'bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 ring-1 ring-primary/20 shadow-primary/25'
        )}
      >
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-accent/30 via-secondary/20 to-transparent opacity-70 blur-[2px]" />

        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full relative z-10 drop-shadow-sm"
        >
          <defs>
            <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isWhite ? '#FFFFFF' : '#3B82F6'} stopOpacity="0.9" />
              <stop offset="50%" stopColor={isWhite ? '#E0F2FE' : '#2563EB'} stopOpacity="1" />
              <stop offset="100%" stopColor={isWhite ? '#BAE6FD' : '#1D4ED8'} stopOpacity="0.95" />
            </linearGradient>
            <linearGradient id="crossGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isWhite ? '#2563EB' : '#FFFFFF'} />
              <stop offset="100%" stopColor={isWhite ? '#1D4ED8' : '#F0F9FF'} />
            </linearGradient>
            <linearGradient id="emeraldGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#34D399" />
            </linearGradient>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#FBBF24" />
            </linearGradient>
          </defs>

          <path
            d="M50 8 C28 8, 15 16, 15 35 C15 65, 38 85, 50 92 C62 85, 85 65, 85 35 C85 16, 72 8, 50 8 Z"
            fill="url(#shieldGrad)"
            stroke={isWhite ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)'}
            strokeWidth="2.5"
          />
          <circle cx="50" cy="46" r="28" stroke="url(#emeraldGrad)" strokeWidth="1.8" strokeDasharray="4 3" strokeLinecap="round" opacity="0.85" />
          <circle cx="50" cy="46" r="22" stroke={isWhite ? '#0EA5E9' : '#60A5FA'} strokeWidth="1.2" opacity="0.6" />
          <path d="M44 32 H56 V40 H64 V52 H56 V60 H44 V52 H36 V40 H44 V32 Z" fill="url(#crossGrad)" rx="2" className="drop-shadow" />
          <path d="M40 46 L45 46 L48 41 L52 51 L55 46 L60 46" stroke={isWhite ? '#2563EB' : '#10B981'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M40 76 C45 73, 50 71, 50 71 C50 71, 55 73, 60 76 C55 78, 50 80, 50 80 C50 80, 45 78, 40 76 Z" fill="url(#goldGrad)" opacity="0.9" />
          <circle cx="50" cy="67" r="2.5" fill="url(#goldGrad)" />
        </svg>

        <span className="absolute -bottom-0.5 -start-0.5 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-accent border-2 border-surface"></span>
        </span>
      </div>

      {showText && (
        <div className="flex flex-col justify-center min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'tracking-tight leading-none truncate',
                titleClass,
                isWhite ? 'text-white font-black' : 'text-text-primary'
              )}
            >
              {t('common:hospital.name')}
            </span>
          </div>
          <p
            className={cn(
              'mt-1 font-medium tracking-wide truncate transition-colors',
              subClass,
              isWhite ? 'text-white/78 drop-shadow-sm' : 'text-primary-600 font-semibold'
            )}
          >
            {displaySubtitle}
          </p>
        </div>
      )}
    </div>
  );
}
