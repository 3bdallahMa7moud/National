import type { Language } from '@/i18n/constants';
import type { ScheduleMatrixData } from '@/types/scheduleMatrix';

export const ROW_LABEL_I18N: Record<string, { ar: string; en: string }> = {
  'فريق إضافي': { ar: 'فريق إضافي', en: 'Extra Team' },
  'احتياطي': { ar: 'احتياطي', en: 'Reserve' },
};

export function localizeRowLabel(label: string, lang: Language): string {
  const entry = ROW_LABEL_I18N[label];
  if (entry) return lang === 'ar' ? entry.ar : entry.en;
  return label;
}

export function resolveScheduleMatrixLocale(
  data: ScheduleMatrixData,
  lang: Language,
): ScheduleMatrixData {
  const legendById = new Map(data.legend.map((entry) => [entry.employeeId, entry]));

  return {
    ...data,
    legend: data.legend.map((entry) => ({
      ...entry,
      fullName: lang === 'ar' ? entry.fullName : (entry.fullNameEn || entry.fullName),
    })),
    vacations: data.vacations.map((vacation) => {
      const legendEntry = legendById.get(vacation.employeeId);
      const englishName = legendEntry?.fullNameEn || vacation.fullName;
      return {
        ...vacation,
        fullName: lang === 'ar' ? vacation.fullName : englishName,
      };
    }),
    facilities: data.facilities.map((facility) => ({
      ...facility,
      units: facility.units.map((unit) => ({
        ...unit,
        rows: unit.rows.map((row) => ({
          ...row,
          rowLabel: localizeRowLabel(row.rowLabel, lang),
        })),
      })),
    })),
    auditLog: data.auditLog.map((entry) => ({
      ...entry,
      actorName: lang === 'ar' ? entry.actorName : localizeAuditActor(entry.actorName),
      oldValue: entry.oldValue ? localizeAuditValue(entry.oldValue, lang) : entry.oldValue,
      newValue: entry.newValue ? localizeAuditValue(entry.newValue, lang) : entry.newValue,
    })),
  };
}

function localizeAuditActor(name: string): string {
  if (name === 'مشرف الجدولة') return 'Schedule Supervisor';
  return name;
}

function localizeAuditValue(value: string, lang: Language): string {
  if (lang === 'ar') return value;

  const replacements: Array<[RegExp, string]> = [
    [/^فارغ$/, 'Empty'],
    [/^إضافة إجازة$/, 'Add vacation'],
    [/^إلغاء إجازة$/, 'Remove vacation'],
    [/^الأسبوع السابق$/, 'Previous week'],
    [/^آخر تعديل محلي$/, 'Last local edit'],
    [/^تم التراجع قبل النشر$/, 'Reverted before publish'],
    [/^نسخ (\d+) خلية للأمام كمسودة$/, 'Copied $1 cells forward as draft'],
    [/^(.+) من يوم (\d+) إلى (\d+)$/, '$1 from day $2 to $3'],
    [/^إجازة (\w+) من (\d+) إلى (\d+)$/, 'Vacation $1 from $2 to $3'],
    [/^إجازة (\w+) لأيام: (.+)$/, 'Vacation $1 for days: $2'],
    [/^إضافة شيفت (.+)$/, 'Added shift $1'],
    [/^تعديل شيفت (.+)$/, 'Updated shift $1'],
    [/^إضافة وحدة (.+)$/, 'Added unit $1'],
    [/^إعادة تسمية وحدة (.+)$/, 'Renamed unit $1'],
    [/^أرشفة وحدة (.+)$/, 'Archived unit $1'],
  ];

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(value)) return value.replace(pattern, replacement);
  }

  return value;
}

export function getMatrixStoreText(lang: Language, key: string): string {
  const texts: Record<string, { ar: string; en: string }> = {
    empty: { ar: 'فارغ', en: 'Empty' },
    scheduleSupervisor: { ar: 'مشرف الجدولة', en: 'Schedule Supervisor' },
    addVacation: { ar: 'إضافة إجازة', en: 'Add vacation' },
    removeVacation: { ar: 'إلغاء إجازة', en: 'Remove vacation' },
    previousWeek: { ar: 'الأسبوع السابق', en: 'Previous week' },
    lastLocalEdit: { ar: 'آخر تعديل محلي', en: 'Last local edit' },
    revertedBeforePublish: { ar: 'تم التراجع قبل النشر', en: 'Reverted before publish' },
    noUnpublished: { ar: 'لا توجد تعديلات غير منشورة', en: 'No unpublished changes' },
    resolveConflicts: { ar: 'راجع التعارضات الظاهرة قبل نشر التحديثات', en: 'Resolve visible conflicts before publishing' },
    publishedBatch: { ar: 'تم نشر التحديثات وإرسالها كدفعة واحدة', en: 'Updates published and sent as one batch' },
  };

  const entry = texts[key];
  if (!entry) return key;
  return lang === 'ar' ? entry.ar : entry.en;
}

export function formatCopiedCellsMessage(lang: Language, count: number): string {
  return lang === 'ar'
    ? `نسخ ${count} خلية للأمام كمسودة`
    : `Copied ${count} cells forward as draft`;
}

export function formatRangeCopyMessage(
  lang: Language,
  assignments: string,
  from: number,
  to: number,
): string {
  return lang === 'ar'
    ? `${assignments} من يوم ${from} إلى ${to}`
    : `${assignments} from day ${from} to ${to}`;
}

export function formatVacationRangeMessage(
  lang: Language,
  type: string,
  from: number,
  to: number,
): string {
  return lang === 'ar'
    ? `إجازة ${type} من ${from} إلى ${to}`
    : `Vacation ${type} from ${from} to ${to}`;
}

export function formatVacationDaysMessage(
  lang: Language,
  type: string,
  days: string,
): string {
  return lang === 'ar'
    ? `إجازة ${type} لأيام: ${days}`
    : `Vacation ${type} for days: ${days}`;
}

export function formatSettingsMessage(
  lang: Language,
  action: 'addShift' | 'updateShift' | 'addUnit' | 'renameUnit' | 'archiveUnit',
  value: string,
): string {
  const map = {
    addShift: { ar: `إضافة شيفت ${value}`, en: `Added shift ${value}` },
    updateShift: { ar: `تعديل شيفت ${value}`, en: `Updated shift ${value}` },
    addUnit: { ar: `إضافة وحدة ${value}`, en: `Added unit ${value}` },
    renameUnit: { ar: `إعادة تسمية وحدة ${value}`, en: `Renamed unit ${value}` },
    archiveUnit: { ar: `أرشفة وحدة ${value}`, en: `Archived unit ${value}` },
  };
  const entry = map[action];
  return lang === 'ar' ? entry.ar : entry.en;
}
