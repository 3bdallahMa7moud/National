import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import i18n from '@/i18n';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getLocale(): string {
  return i18n.language === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-US';
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString(getLocale(), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateShort(date: string): string {
  return new Date(date).toLocaleDateString(getLocale(), {
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  if (hours === undefined || minutes === undefined) return time;
  const h = parseInt(hours, 10);
  if (isNaN(h)) return time;
  return `${String(h).padStart(2, '0')}:${minutes.padStart(2, '0')}`;
}

export function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

export function getDayName(date: Date): string {
  return date.toLocaleDateString(getLocale(), { weekday: 'short' });
}

export function getMonthName(month: number): string {
  const date = new Date(2024, month, 1);
  return date.toLocaleDateString(getLocale(), { month: 'long' });
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}
