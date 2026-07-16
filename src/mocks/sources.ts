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
    employeeCount: 30,
  },
];

export const mockShiftTypesSource: MockShiftTypeSource[] = [
  { id: 'st-1', key: 'morning', label: { ar: 'الشفت النهاري', en: 'Day Shift' }, color: '#22C55E', startTime: '07:00', endTime: '15:00', hours: 8 },
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
    code: 'ISH',
    isActive: true,
    createdAt: '2023-01-15',
  },
  {
    id: 'ot-employee-s',
    scheduleEmployeeId: 'ot-employee-s',
    name: { ar: 'علي', en: 'Ali' },
    email: 'ali@hospital.sa',
    phone: '0501000001',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-002',
    code: 'S',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-1',
    scheduleEmployeeId: 'emp-m-1',
    name: { ar: 'أحمد', en: 'Ahmed' },
    email: 'ahmed@hospital.sa',
    phone: '0501000002',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-003',
    code: 'A',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-2',
    scheduleEmployeeId: 'emp-m-2',
    name: { ar: 'سليمان', en: 'Suliman' },
    email: 'suliman@hospital.sa',
    phone: '0501000003',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-004',
    code: 'L',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-3',
    scheduleEmployeeId: 'emp-m-3',
    name: { ar: 'حمد', en: 'Hamad' },
    email: 'hamad@hospital.sa',
    phone: '0501000004',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-005',
    code: 'U',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-4',
    scheduleEmployeeId: 'emp-m-4',
    name: { ar: 'ناصر', en: 'Nasser' },
    email: 'nasser@hospital.sa',
    phone: '0501000005',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-006',
    code: 'P',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-5',
    scheduleEmployeeId: 'emp-m-5',
    name: { ar: 'سلطانة', en: 'Sultana' },
    email: 'sultana@hospital.sa',
    phone: '0501000006',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-007',
    code: 'N',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-6',
    scheduleEmployeeId: 'emp-m-6',
    name: { ar: 'عمار', en: 'Ammar' },
    email: 'ammar@hospital.sa',
    phone: '0501000007',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-008',
    code: 'Z',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-7',
    scheduleEmployeeId: 'emp-m-7',
    name: { ar: 'منى', en: 'Mona' },
    email: 'mona@hospital.sa',
    phone: '0501000008',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-009',
    code: 'I',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-8',
    scheduleEmployeeId: 'emp-m-8',
    name: { ar: 'نسيبة', en: 'Nosiba' },
    email: 'nosiba@hospital.sa',
    phone: '0501000009',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-010',
    code: 'D',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-9',
    scheduleEmployeeId: 'emp-m-9',
    name: { ar: 'إشراق', en: 'Eshraq' },
    email: 'eshraq@hospital.sa',
    phone: '0501000010',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-011',
    code: 'Q',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-10',
    scheduleEmployeeId: 'emp-m-10',
    name: { ar: 'ملاك', en: 'Malak' },
    email: 'malak@hospital.sa',
    phone: '0501000011',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-012',
    code: 'MA',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-11',
    scheduleEmployeeId: 'emp-m-11',
    name: { ar: 'عبدالله', en: 'Abdualla' },
    email: 'abdualla@hospital.sa',
    phone: '0501000012',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-013',
    code: 'G',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-12',
    scheduleEmployeeId: 'emp-m-12',
    name: { ar: 'ياسر', en: 'Yasser' },
    email: 'yasser@hospital.sa',
    phone: '0501000013',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-014',
    code: 'YK',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-13',
    scheduleEmployeeId: 'emp-m-13',
    name: { ar: 'فهد', en: 'Fahad' },
    email: 'fahad@hospital.sa',
    phone: '0501000014',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-015',
    code: 'FA',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-14',
    scheduleEmployeeId: 'emp-m-14',
    name: { ar: 'راكان', en: 'Rakan' },
    email: 'rakan@hospital.sa',
    phone: '0501000015',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-016',
    code: 'RK',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-16',
    scheduleEmployeeId: 'emp-m-16',
    name: { ar: 'إبراهيم', en: 'Ebrahim' },
    email: 'ebrahim@hospital.sa',
    phone: '0501000016',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-017',
    code: 'EJ',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-17',
    scheduleEmployeeId: 'emp-m-17',
    name: { ar: 'ديمة', en: 'DEMA' },
    email: 'dema@hospital.sa',
    phone: '0501000017',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-018',
    code: 'O',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-18',
    scheduleEmployeeId: 'emp-m-18',
    name: { ar: 'سلطان', en: 'SULTAN' },
    email: 'sultan@hospital.sa',
    phone: '0501000018',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-019',
    code: 'Y',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-19',
    scheduleEmployeeId: 'emp-m-19',
    name: { ar: 'أبرار', en: 'ABRAR' },
    email: 'abrar@hospital.sa',
    phone: '0501000019',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-020',
    code: 'AO',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-20',
    scheduleEmployeeId: 'emp-m-20',
    name: { ar: 'نورة', en: 'NORAH' },
    email: 'norah@hospital.sa',
    phone: '0501000020',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-021',
    code: 'NQ',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-22',
    scheduleEmployeeId: 'emp-m-22',
    name: { ar: 'الجهيري', en: "A'JUHAYRI" },
    email: 'ajuhayri@hospital.sa',
    phone: '0501000021',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-022',
    code: 'J',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-23',
    scheduleEmployeeId: 'emp-m-23',
    name: { ar: 'نوف', en: 'NOUF' },
    email: 'nouf@hospital.sa',
    phone: '0501000022',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-023',
    code: 'NO',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-24',
    scheduleEmployeeId: 'emp-m-24',
    name: { ar: 'هديل', en: 'HADEEL' },
    email: 'hadeel@hospital.sa',
    phone: '0501000023',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-024',
    code: 'H',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-25',
    scheduleEmployeeId: 'emp-m-25',
    name: { ar: 'القريني', en: "A'Qraini" },
    email: 'aqraini@hospital.sa',
    phone: '0501000024',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-025',
    code: 'GR',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-26',
    scheduleEmployeeId: 'emp-m-26',
    name: { ar: 'تغريد', en: 'TAGREED' },
    email: 'tagreed@hospital.sa',
    phone: '0501000025',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-026',
    code: 'TG',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-27',
    scheduleEmployeeId: 'emp-m-27',
    name: { ar: 'الحارثي', en: "A'HARTHI" },
    email: 'aharthi@hospital.sa',
    phone: '0501000026',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-027',
    code: 'AH',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-28',
    scheduleEmployeeId: 'emp-m-28',
    name: { ar: 'العتيبي', en: "A'OTAIBI" },
    email: 'aotaibi@hospital.sa',
    phone: '0501000027',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-028',
    code: 'B',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-29',
    scheduleEmployeeId: 'emp-m-29',
    name: { ar: 'عبد العتيبي', en: "Abdu'Otaibi" },
    email: 'abduotaibi@hospital.sa',
    phone: '0501000028',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-029',
    code: 'C',
    isActive: true,
    createdAt: '2023-02-01',
  },
  {
    id: 'emp-m-30',
    scheduleEmployeeId: 'emp-m-30',
    name: { ar: 'عبدالرحمن', en: "Abdu'R" },
    email: 'abdur@hospital.sa',
    phone: '0501000029',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: deptCt,
    position: { ar: 'أخصائي أشعة مقطعية', en: 'CT Scan Technologist' },
    employeeNumber: 'EMP-030',
    code: 'F',
    isActive: true,
    createdAt: '2023-02-01',
  },
];

export const MOCK_EMPLOYEE_ACCOUNTS_STORAGE_KEY = 'ngh_employee_accounts_v2';

interface PersistedMockEmployeeAccounts {
  version: 2;
  employees: MockEmployeeSource[];
}

function isPersistedEmployee(value: unknown): value is MockEmployeeSource {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const employee = value as Partial<MockEmployeeSource>;
  return typeof employee.id === 'string'
    && typeof employee.employeeNumber === 'string'
    && typeof employee.departmentId === 'string'
    && typeof employee.code === 'string'
    && (employee.role === 'admin' || employee.role === 'employee')
    && typeof employee.isActive === 'boolean'
    && !!employee.name
    && typeof employee.name.ar === 'string'
    && typeof employee.name.en === 'string';
}

function hydratePersistedEmployeeAccounts(): void {
  try {
    if (typeof window === 'undefined') return;
    const parsed = JSON.parse(window.localStorage.getItem(MOCK_EMPLOYEE_ACCOUNTS_STORAGE_KEY) || 'null') as Partial<PersistedMockEmployeeAccounts> | null;
    if (parsed && parsed.version === 2 && Array.isArray(parsed.employees)) {
      const employees = parsed.employees.filter(isPersistedEmployee);
      if (employees.length > 0) {
        mockEmployeesSource.splice(0, mockEmployeesSource.length, ...employees);
      }
    }
  } catch {
    // Invalid legacy data never replaces the built-in accounts.
  }

  const defaultLinks: Record<string, { scheduleEmployeeId: string; email: string }> = {
    'emp-2': { scheduleEmployeeId: 'emp-m-1', email: 'employee@hospital.sa' },
    'emp-3': { scheduleEmployeeId: 'emp-m-2', email: 'fatima@hospital.sa' },
    'emp-4': { scheduleEmployeeId: 'emp-m-3', email: 'ahmed@hospital.sa' },
    'emp-5': { scheduleEmployeeId: 'emp-m-5', email: 'noura@hospital.sa' },
    'emp-6': { scheduleEmployeeId: 'emp-m-6', email: 'khaled@hospital.sa' },
    'emp-7': { scheduleEmployeeId: 'emp-m-7', email: 'sara@hospital.sa' },
  };
  for (const emp of mockEmployeesSource) {
    const link = defaultLinks[emp.id];
    if (link) {
      if (!emp.scheduleEmployeeId) emp.scheduleEmployeeId = link.scheduleEmployeeId;
      if (!emp.email) emp.email = link.email;
    }
  }
}

export function persistMockEmployeesSource(): { ok: true } | { ok: false; message: string } {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MOCK_EMPLOYEE_ACCOUNTS_STORAGE_KEY, JSON.stringify({
        version: 1,
        employees: mockEmployeesSource,
      } satisfies PersistedMockEmployeeAccounts));
    }
    return { ok: true };
  } catch {
    return { ok: false, message: 'Unable to save employee accounts. Browser storage may be full.' };
  }
}

hydratePersistedEmployeeAccounts();

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
    message: { ar: 'تم تغيير شيفتك من مسائي إلى الشفت النهاري يوم الأحد', en: 'Your shift was changed from evening to Day Shift on Sunday' },
    oldShiftTypeKey: 'evening',
    newShiftTypeKey: 'morning',
    isRead: false,
    isUrgent: false,
    actionUrl: '/schedule',
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
    actionUrl: '/schedule',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: 'notif-4',
    type: 'schedule_published',
    title: { ar: 'نشر الجدول', en: 'Schedule Published' },
    message: { ar: 'تم نشر جدول شهر يوليو 2026', en: 'The July 2026 schedule has been published' },
    isRead: true,
    isUrgent: false,
    actionUrl: '/schedule',
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
    actionUrl: '/schedule',
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
    oldValue: { ar: 'الشفت النهاري - 7:00 ص', en: 'Day Shift - 7:00 AM' },
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
    newValue: { ar: 'الشفت النهاري للجميع', en: 'Day Shift for all' },
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
