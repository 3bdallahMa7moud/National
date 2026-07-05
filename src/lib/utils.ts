import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import i18n from '@/i18n';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getLocale(): string {
  return i18n.language === 'ar' ? 'ar-SA' : 'en-US';
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
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const isAr = i18n.language === 'ar';
  const period = h >= 12
    ? (isAr ? 'م' : 'PM')
    : (isAr ? 'ص' : 'AM');
  const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayHour}:${minutes} ${period}`;
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
