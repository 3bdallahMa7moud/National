/* ==========================================================================
 * Employee Justification Report — Types & Presets
 * ========================================================================== */

/** A single row in the OT employee table */
export interface JustificationEmployeeRow {
  id: string;
  /** Badge Number */
  bn: string;
  name: string;
  branch: string;
  totalShifts: number;
  claimedHours: number;
}

/** Logo state — either a Data URL (uploaded) or null */
export type LogoState = string | null;

/** Column header labels (user-editable) */
export interface JustificationTableHeaders {
  no: string;
  bn: string;
  name: string;
  totalShifts: string;
  claimedHours: string;
}

/** The full editable state of the report */
export interface JustificationReportState {
  /* === Document Header === */
  kingdomLabel: string;
  ministryName: string;
  departmentName: string;
  reportTitle: string;

  /* === Filter Fields === */
  section: string;
  month: string;
  year: string;
  numberOfStaff: string;

  /* === Logos === */
  leftLogo: LogoState;
  rightLogo: LogoState;

  /* === Table === */
  headers: JustificationTableHeaders;
  rows: JustificationEmployeeRow[];

  /* === Page 2 === */
  confirmationParagraph: string;
  supervisorLabel: string;

  /* === Footer / Notes === */
  footerText: string;
  notes: string;
}

/** Zoom options for the live preview */
export type ZoomLevel = 0.5 | 0.75 | 1 | 'fit';

/** Data source indicator for the generated table */
export type DataSourceKind = 'published' | 'draft' | 'manual' | 'none';

/** Preset hospital profile keys */
export type TemplatePresetKey = 'KAMC_CT' | 'KAMC_RAD' | 'KASCH_RAD' | 'WHH_RAD' | 'CUSTOM';

/** Default state — official English letterhead format exactly matching standard hospital overtime report */
export const DEFAULT_JUSTIFICATION_STATE: JustificationReportState = {
  kingdomLabel: 'KINGDOM OF SAUDI ARABIA',
  ministryName: 'MINISTRY OF NATIONAL GUARD HEALTH AFFAIRS',
  departmentName: 'MEDICAL IMAGING DEPARTMENT',
  reportTitle: 'CONFIRMATION OF STAFF AVAILABILITY DURING OVERTIME HOURS',
  section: 'CT Scan',
  month: '',
  year: '',
  numberOfStaff: '0',
  leftLogo: '/mngha-logo.png',
  rightLogo: '/ct-logo.png',
  headers: {
    no: '#',
    bn: 'BN',
    name: 'NAME',
    totalShifts: '# OF STAFF WHO WORKED AFTERHOURS',
    claimedHours: '# OF CLAIMED HOURS',
  },
  rows: [],
  confirmationParagraph:
    'The above listed staff have been assigned to cover the overtime hours during the specified month and have been confirmed available on duty according to their claimed overtime hours.',
  supervisorLabel: "SUPERVISOR'S SIGNATURE/ DATE",
  footerText: '',
  notes: '',
};

/** Pre-configured templates for quick one-click setup */
export const TEMPLATE_PRESETS: Record<Exclude<TemplatePresetKey, 'CUSTOM'>, Partial<JustificationReportState>> = {
  KAMC_CT: {
    kingdomLabel: 'المملكة العربية السعودية',
    ministryName: 'وزارة الحرس الوطني – الشؤون الصحية',
    departmentName: 'قسم الأشعة التشخيصية',
    reportTitle: 'تقرير مبرر العمل الإضافي الشهري',
    section: 'قسم الأشعة المقطعية (CT Scan)',
    supervisorLabel: 'مشرف قسم الأشعة المقطعية',
    footerText: 'تم إنشاء هذا التقرير بواسطة نظام جدولة قسم الأشعة المقطعية.',
  },
  KAMC_RAD: {
    kingdomLabel: 'المملكة العربية السعودية',
    ministryName: 'وزارة الحرس الوطني – الشؤون الصحية',
    departmentName: 'قسم الأشعة التشخيصية',
    reportTitle: 'تقرير مبرر العمل الإضافي الشهري',
    section: 'الأشعة العامة (General Radiology)',
    supervisorLabel: 'مشرف قسم الأشعة العامة',
    footerText: 'تم إنشاء هذا التقرير بواسطة نظام جدولة قسم الأشعة العامة.',
  },
  KASCH_RAD: {
    kingdomLabel: 'المملكة العربية السعودية',
    ministryName: 'وزارة الحرس الوطني – الشؤون الصحية',
    departmentName: 'قسم التصوير الطبي للأطفال',
    reportTitle: 'تقرير مبرر العمل الإضافي الشهري',
    section: 'التصوير الطبي للأطفال',
    supervisorLabel: 'مشرف قسم التصوير الطبي للأطفال',
    footerText: 'تم إنشاء هذا التقرير بواسطة نظام جدولة مستشفى الأطفال.',
  },
  WHH_RAD: {
    kingdomLabel: 'المملكة العربية السعودية',
    ministryName: 'وزارة الحرس الوطني – الشؤون الصحية',
    departmentName: 'قسم التصوير الطبي والتداخلية',
    reportTitle: 'تقرير مبرر العمل الإضافي الشهري',
    section: 'تصوير صحة المرأة',
    supervisorLabel: 'مشرف قسم الأشعة والتصوير الطبي',
    footerText: 'تم إنشاء هذا التقرير بواسطة نظام جدولة مستشفى صحة المرأة.',
  },
};

/** Input data derived from OT store for a given month */
export interface OTMonthSummaryRow {
  employeeId: string;
  employeeName: string;
  bn: string;
  branch: string;
  shiftCount: number;
  totalHours: number;
}

