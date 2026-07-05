import type { LocalizedText } from '@/types/localized';
import type { Shift } from '@/types';
import type {
  MockDepartmentSource,
  MockShiftTypeSource,
  MockEmployeeSource,
  MockNotificationSource,
  MockAuditLogSource,
} from './types';

const deptCt: LocalizedText = {
  ar: 'قسم الأشعة المقطعية',
  en: 'CT Scan Department',
};

const deptCtDesc: LocalizedText = {
  ar: 'قسم التصوير بالأشعة المقطعية المحوسبة (CT Scan)',
  en: 'Computerized Tomography (CT Scan) imaging department',
};

export const mockDepartmentsSource: MockDepartmentSource[] = [
  {
    id: 'dept-1',
    name: deptCt,
    description: deptCtDesc,
    managerId: 'emp-1',
    employeeCount: 8,
  },
];

export const mockShiftTypesSource: MockShiftTypeSource[] = [
  { id: 'st-1', key: 'morning', label: { ar: 'صباحي', en: 'Morning' }, color: '#22C55E', startTime: '07:00', endTime: '15:00', hours: 8 },
  { id: 'st-2', key: 'evening', label: { ar: 'مسائي', en: 'Evening' }, color: '#F59E0B', startTime: '15:00', endTime: '23:00', hours: 8 },
  { id: 'st-3', key: 'night', label: { ar: 'ليلي', en: 'Night' }, color: '#8B5CF6', startTime: '23:00', endTime: '07:00', hours: 8 },
  { id: 'st-4', key: 'oncall', label: { ar: 'تحت الطلب', en: 'On-Call' }, color: '#2563EB', startTime: '00:00', endTime: '23:59', hours: 24 },
  { id: 'st-5', key: 'overtime', label: { ar: 'عمل إضافي', en: 'Overtime' }, color: '#F97316', startTime: '15:00', endTime: '19:00', hours: 4 },
  { id: 'st-6', key: 'vacation', label: { ar: 'إجازة', en: 'Vacation' }, color: '#94A3B8', startTime: '00:00', endTime: '23:59', hours: 0 },
  { id: 'st-7', key: 'sick', label: { ar: 'إجازة مرضية', en: 'Sick Leave' }, color: '#EF4444', startTime: '00:00', endTime: '23:59', hours: 0 },
  { id: 'st-8', key: 'training', label: { ar: 'تدريب', en: 'Training' }, color: '#06B6D4', startTime: '08:00', endTime: '16:00', hours: 8 },
];

export const mockEmployeesSource: MockEmployeeSource[] = [
  {
    id: 'emp-1',
    name: { ar: 'د. اشراق', en: 'Dr. Ishraq' },
    email: 'admin@hospital.sa',
    phone: '0501234567',
    role: 'admin',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'رئيس القسم', en: 'Department Head' },
    employeeNumber: 'EMP-001',
    isActive: true,
    createdAt: '2023-01-15',
  },
  {
    id: 'emp-2',
    name: { ar: 'محمد السعيد', en: 'Mohammed Al-Saeed' },
    email: 'employee@hospital.sa',
    phone: '0507654321',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'فني أشعة مقطعية', en: 'CT Scan Technician' },
    employeeNumber: 'EMP-002',
    isActive: true,
    createdAt: '2023-03-20',
  },
  {
    id: 'emp-3',
    name: { ar: 'فاطمة الزهراني', en: 'Fatima Al-Zahrani' },
    email: 'fatima@hospital.sa',
    phone: '0509876543',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'فنية أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-003',
    isActive: true,
    createdAt: '2023-05-10',
  },
  {
    id: 'emp-4',
    name: { ar: 'أحمد العتيبي', en: 'Ahmed Al-Otaibi' },
    email: 'ahmed@hospital.sa',
    phone: '0503456789',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'فني أشعة مقطعية', en: 'CT Scan Technician' },
    employeeNumber: 'EMP-004',
    isActive: true,
    createdAt: '2023-06-01',
  },
  {
    id: 'emp-5',
    name: { ar: 'نورة القحطاني', en: 'Noura Al-Qahtani' },
    email: 'noura@hospital.sa',
    phone: '0502345678',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'فنية أشعة مقطعية أولى', en: 'Senior CT Scan Technologist' },
    employeeNumber: 'EMP-005',
    isActive: true,
    createdAt: '2023-07-15',
  },
  {
    id: 'emp-6',
    name: { ar: 'خالد الشمري', en: 'Khaled Al-Shammari' },
    email: 'khaled@hospital.sa',
    phone: '0508765432',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'فني أشعة مقطعية', en: 'CT Scan Technician' },
    employeeNumber: 'EMP-006',
    isActive: true,
    createdAt: '2023-09-01',
  },
  {
    id: 'emp-7',
    name: { ar: 'سارة المالكي', en: 'Sara Al-Malki' },
    email: 'sara@hospital.sa',
    phone: '0504567890',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'فنية أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-007',
    isActive: true,
    createdAt: '2024-01-10',
  },
  {
    id: 'emp-8',
    name: { ar: 'عمر الدوسري', en: 'Omar Al-Dossari' },
    email: 'omar@hospital.sa',
    phone: '0506789012',
    role: 'admin',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'مشرف القسم', en: 'Department Supervisor' },
    employeeNumber: 'EMP-008',
    isActive: true,
    createdAt: '2024-02-01',
  },
];

function generateShifts(): Shift[] {
  const shifts: Shift[] = [];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const shiftPatterns = ['st-1', 'st-2', 'st-3', 'st-1', 'st-2', 'st-1', 'st-6'];
  const employees = mockEmployeesSource.filter((e) => e.role === 'employee');

  let id = 1;
  employees.forEach((emp, empIndex) => {
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const patternIndex = (day + empIndex) % shiftPatterns.length;
      const shiftTypeId = shiftPatterns[patternIndex];
      const shiftType = mockShiftTypesSource.find((s) => s.id === shiftTypeId)!;

      shifts.push({
        id: `shift-${id++}`,
        employeeId: emp.id,
        shiftTypeId,
        shiftType: shiftType.key,
        date,
        startTime: shiftType.startTime,
        endTime: shiftType.endTime,
        status: day < now.getDate() ? 'completed' : 'scheduled',
      });

      if (day % 7 === empIndex % 3 && shiftTypeId !== 'st-6') {
        shifts.push({
          id: `shift-${id++}`,
          employeeId: emp.id,
          shiftTypeId: 'st-4',
          shiftType: 'oncall',
          date,
          startTime: '00:00',
          endTime: '23:59',
          status: 'scheduled',
        });
      }

      if (day % 10 === empIndex % 4) {
        shifts.push({
          id: `shift-${id++}`,
          employeeId: emp.id,
          shiftTypeId: 'st-5',
          shiftType: 'overtime',
          date,
          startTime: '15:00',
          endTime: '19:00',
          status: 'scheduled',
        });
      }
    }
  });

  return shifts;
}

export const mockShifts: Shift[] = generateShifts();

export const mockNotificationsSource: MockNotificationSource[] = [
  {
    id: 'notif-1',
    type: 'oncall_assignment',
    title: { ar: 'تكليف تحت الطلب', en: 'On-Call Assignment' },
    message: { ar: 'تم تكليفك بنوبة تحت الطلب يوم الخميس القادم', en: 'You have been assigned an on-call shift next Thursday' },
    oldShiftTypeKey: 'morning',
    newShiftTypeKey: 'oncall',
    isRead: false,
    isUrgent: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'notif-2',
    type: 'shift_change',
    title: { ar: 'تعديل الشيفت', en: 'Shift Change' },
    message: { ar: 'تم تغيير شيفتك من مسائي إلى صباحي يوم الأحد', en: 'Your shift was changed from evening to morning on Sunday' },
    oldShiftTypeKey: 'evening',
    newShiftTypeKey: 'morning',
    isRead: false,
    isUrgent: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 'notif-3',
    type: 'overtime_assignment',
    title: { ar: 'عمل إضافي', en: 'Overtime' },
    message: { ar: 'تم تكليفك بعمل إضافي يوم السبت من 3:00 م إلى 7:00 م', en: 'You have been assigned overtime on Saturday from 3:00 PM to 7:00 PM' },
    newShiftTypeKey: 'overtime',
    isRead: false,
    isUrgent: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: 'notif-4',
    type: 'schedule_published',
    title: { ar: 'نشر الجدول', en: 'Schedule Published' },
    message: { ar: 'تم نشر جدول شهر يوليو 2026', en: 'The July 2026 schedule has been published' },
    isRead: true,
    isUrgent: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: 'notif-5',
    type: 'shift_change',
    title: { ar: 'تعديل الشيفت', en: 'Shift Change' },
    message: { ar: 'تم تغيير شيفتك من ليلي إلى مسائي يوم الثلاثاء', en: 'Your shift was changed from night to evening on Tuesday' },
    oldShiftTypeKey: 'night',
    newShiftTypeKey: 'evening',
    isRead: true,
    isUrgent: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
  {
    id: 'notif-6',
    type: 'general',
    title: { ar: 'تحديث النظام', en: 'System Update' },
    message: { ar: 'تم تحديث نظام الجدولة. يرجى مراجعة جدولك الجديد', en: 'The scheduling system has been updated. Please review your new schedule' },
    isRead: true,
    isUrgent: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
];

export const mockAuditLogSource: MockAuditLogSource[] = [
  {
    id: 'audit-1',
    userId: 'emp-1',
    userName: { ar: 'د. عبدالله الحربي', en: 'Dr. Abdullah Al-Harbi' },
    action: 'update',
    entityType: 'shift',
    entityId: 'shift-15',
    description: { ar: 'تعديل شيفت محمد السعيد', en: 'Updated Mohammed Al-Saeed shift' },
    oldValue: { ar: 'صباحي - 7:00 ص', en: 'Morning - 7:00 AM' },
    newValue: { ar: 'مسائي - 3:00 م', en: 'Evening - 3:00 PM' },
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'audit-2',
    userId: 'emp-1',
    userName: { ar: 'د. عبدالله الحربي', en: 'Dr. Abdullah Al-Harbi' },
    action: 'create',
    entityType: 'shift',
    entityId: 'shift-200',
    description: { ar: 'إضافة نوبة تحت الطلب لفاطمة الزهراني', en: 'Added on-call shift for Fatima Al-Zahrani' },
    newValue: { ar: 'تحت الطلب - الخميس', en: 'On-Call - Thursday' },
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: 'audit-3',
    userId: 'emp-8',
    userName: { ar: 'عمر الدوسري', en: 'Omar Al-Dossari' },
    action: 'bulk_update',
    entityType: 'schedule',
    entityId: 'bulk-1',
    description: { ar: 'تعديل جماعي على 5 شيفتات', en: 'Bulk update on 5 shifts' },
    oldValue: { ar: 'شيفتات متنوعة', en: 'Various shifts' },
    newValue: { ar: 'صباحي للجميع', en: 'Morning for all' },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: 'audit-4',
    userId: 'emp-1',
    userName: { ar: 'د. عبدالله الحربي', en: 'Dr. Abdullah Al-Harbi' },
    action: 'update',
    entityType: 'employee',
    entityId: 'emp-7',
    description: { ar: 'تحديث بيانات سارة المالكي', en: 'Updated Sara Al-Malki profile' },
    oldValue: { ar: 'فنية أشعة', en: 'Radiology Technologist' },
    newValue: { ar: 'فنية أشعة مقطعية', en: 'CT Scan Technologist' },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: 'audit-5',
    userId: 'emp-1',
    userName: { ar: 'د. عبدالله الحربي', en: 'Dr. Abdullah Al-Harbi' },
    action: 'delete',
    entityType: 'shift',
    entityId: 'shift-50',
    description: { ar: 'حذف شيفت إجازة خالد الشمري', en: 'Deleted vacation shift for Khaled Al-Shammari' },
    oldValue: { ar: 'إجازة - الأربعاء', en: 'Vacation - Wednesday' },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
];
