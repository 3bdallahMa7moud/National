export type AnalysisGranularity = 'day' | 'week' | 'month' | 'year';

export interface AnalysisPeriod {
  granularity: AnalysisGranularity;
  startDate: string;
  endDate: string;
  label: string;
}

export interface AnalysisCoverage {
  availableMonthKeys: string[];
  missingMonthKeys: string[];
  requiredMonthKeys: string[];
  availableMonths: number;
  requiredMonths: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid ISO date: ${value}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function gregorianLocale(locale: string): string {
  return locale.startsWith('ar') ? 'ar-SA-u-ca-gregory' : locale;
}

function formatPeriodLabel(
  granularity: AnalysisGranularity,
  start: Date,
  end: Date,
  locale: string,
): string {
  const resolvedLocale = gregorianLocale(locale);
  if (granularity === 'year') {
    return new Intl.DateTimeFormat(resolvedLocale, {
      year: 'numeric',
      timeZone: 'UTC',
    }).format(start);
  }
  if (granularity === 'month') {
    return new Intl.DateTimeFormat(resolvedLocale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(start);
  }
  if (granularity === 'day') {
    return new Intl.DateTimeFormat(resolvedLocale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(start);
  }
  const formatter = new Intl.DateTimeFormat(resolvedLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

export function createAnalysisPeriod(
  granularity: AnalysisGranularity,
  anchorDate: string,
  locale = 'en-US',
): AnalysisPeriod {
  const anchor = parseIsoDate(anchorDate);
  let start = anchor;
  let end = anchor;

  if (granularity === 'week') {
    start = addUtcDays(anchor, -anchor.getUTCDay());
    end = addUtcDays(start, 6);
  } else if (granularity === 'month') {
    start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
  } else if (granularity === 'year') {
    start = new Date(Date.UTC(anchor.getUTCFullYear(), 0, 1));
    end = new Date(Date.UTC(anchor.getUTCFullYear(), 11, 31));
  }

  return {
    granularity,
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
    label: formatPeriodLabel(granularity, start, end, locale),
  };
}

export function getMonthKeysForPeriod(period: AnalysisPeriod): string[] {
  const start = parseIsoDate(period.startDate);
  const end = parseIsoDate(period.endDate);
  const keys: string[] = [];
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();
  const endYear = end.getUTCFullYear();
  const endMonth = end.getUTCMonth();

  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push(`${year}-${String(month + 1).padStart(2, '0')}`);
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
  }
  return keys;
}

export function getAnalysisCoverage(
  period: AnalysisPeriod,
  scheduleMonths: Record<string, unknown>,
  otMonths: Record<string, unknown>,
): AnalysisCoverage {
  const requiredMonthKeys = getMonthKeysForPeriod(period);
  const availableMonthKeys = requiredMonthKeys.filter(
    (key) => Object.prototype.hasOwnProperty.call(scheduleMonths, key)
      || Object.prototype.hasOwnProperty.call(otMonths, key),
  );
  const available = new Set(availableMonthKeys);
  const missingMonthKeys = requiredMonthKeys.filter((key) => !available.has(key));

  return {
    availableMonthKeys,
    missingMonthKeys,
    requiredMonthKeys,
    availableMonths: availableMonthKeys.length,
    requiredMonths: requiredMonthKeys.length,
  };
}

export function isIsoDateWithinPeriod(date: string, period: AnalysisPeriod): boolean {
  return date >= period.startDate && date <= period.endDate;
}
