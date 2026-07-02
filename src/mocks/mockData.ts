import type { Employee, Department, ShiftType, Shift, AppNotification, AuditLogEntry } from '@/types';

// ==================== الأقسام ====================
export const mockDepartments: Department[] = [
  {
    id: 'dept-1',
    name: 'قسم الأشعة المقطعية',
    description: 'قسم التصوير بالأشعة المقطعية المحوسبة (CT Scan)',
    managerId: 'emp-1',
    employeeCount: 8,
  },
];

// ==================== أنواع الشيفتات ====================
export const mockShiftTypes: ShiftType[] = [
  { id: 'st-1', key: 'morning', name: 'Morning', nameAr: 'صباحي', color: '#22C55E', startTime: '07:00', endTime: '15:00', hours: 8 },
  { id: 'st-2', key: 'evening', name: 'Evening', nameAr: 'مسائي', color: '#F59E0B', startTime: '15:00', endTime: '23:00', hours: 8 },
  { id: 'st-3', key: 'night', name: 'Night', nameAr: 'ليلي', color: '#8B5CF6', startTime: '23:00', endTime: '07:00', hours: 8 },
  { id: 'st-4', key: 'oncall', name: 'On-Call', nameAr: 'تحت الطلب', color: '#2563EB', startTime: '00:00', endTime: '23:59', hours: 24 },
  { id: 'st-5', key: 'overtime', name: 'Overtime', nameAr: 'عمل إضافي', color: '#F97316', startTime: '15:00', endTime: '19:00', hours: 4 },
  { id: 'st-6', key: 'vacation', name: 'Vacation', nameAr: 'إجازة', color: '#94A3B8', startTime: '00:00', endTime: '23:59', hours: 0 },
  { id: 'st-7', key: 'sick', name: 'Sick Leave', nameAr: 'إجازة مرضية', color: '#EF4444', startTime: '00:00', endTime: '23:59', hours: 0 },
  { id: 'st-8', key: 'training', name: 'Training', nameAr: 'تدريب', color: '#06B6D4', startTime: '08:00', endTime: '16:00', hours: 8 },
];

// ==================== الموظفون ====================
export const mockEmployees: Employee[] = [
  { id: 'emp-1', name: 'د. اشراق', email: 'admin@hospital.sa', phone: '0501234567', role: 'admin', departmentId: 'dept-1', departmentName: 'قسم الأشعة المقطعية', position: 'رئيس القسم', employeeNumber: 'EMP-001', isActive: true, createdAt: '2023-01-15' },
  { id: 'emp-2', name: 'محمد السعيد', email: 'employee@hospital.sa', phone: '0507654321', role: 'employee', departmentId: 'dept-1', departmentName: 'قسم الأشعة المقطعية', position: 'فني أشعة مقطعية', employeeNumber: 'EMP-002', isActive: true, createdAt: '2023-03-20' },
  { id: 'emp-3', name: 'فاطمة الزهراني', email: 'fatima@hospital.sa', phone: '0509876543', role: 'employee', departmentId: 'dept-1', departmentName: 'قسم الأشعة المقطعية', position: 'فنية أشعة مقطعية', employeeNumber: 'EMP-003', isActive: true, createdAt: '2023-05-10' },
  { id: 'emp-4', name: 'أحمد العتيبي', email: 'ahmed@hospital.sa', phone: '0503456789', role: 'employee', departmentId: 'dept-1', departmentName: 'قسم الأشعة المقطعية', position: 'فني أشعة مقطعية', employeeNumber: 'EMP-004', isActive: true, createdAt: '2023-06-01' },
  { id: 'emp-5', name: 'نورة القحطاني', email: 'noura@hospital.sa', phone: '0502345678', role: 'employee', departmentId: 'dept-1', departmentName: 'قسم الأشعة المقطعية', position: 'فنية أشعة مقطعية أولى', employeeNumber: 'EMP-005', isActive: true, createdAt: '2023-07-15' },
  { id: 'emp-6', name: 'خالد الشمري', email: 'khaled@hospital.sa', phone: '0508765432', role: 'employee', departmentId: 'dept-1', departmentName: 'قسم الأشعة المقطعية', position: 'فني أشعة مقطعية', employeeNumber: 'EMP-006', isActive: true, createdAt: '2023-09-01' },
  { id: 'emp-7', name: 'سارة المالكي', email: 'sara@hospital.sa', phone: '0504567890', role: 'employee', departmentId: 'dept-1', departmentName: 'قسم الأشعة المقطعية', position: 'فنية أشعة مقطعية', employeeNumber: 'EMP-007', isActive: true, createdAt: '2024-01-10' },
  { id: 'emp-8', name: 'عمر الدوسري', email: 'omar@hospital.sa', phone: '0506789012', role: 'admin', departmentId: 'dept-1', departmentName: 'قسم الأشعة المقطعية', position: 'مشرف القسم', employeeNumber: 'EMP-008', isActive: true, createdAt: '2024-02-01' },
];

// ==================== توليد الشيفتات ====================
function generateShifts(): Shift[] {
  const shifts: Shift[] = [];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const shiftPatterns = ['st-1', 'st-2', 'st-3', 'st-1', 'st-2', 'st-1', 'st-6'];
  const employees = mockEmployees.filter(e => e.role === 'employee');
  
  let id = 1;
  employees.forEach((emp, empIndex) => {
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const patternIndex = (day + empIndex) % shiftPatterns.length;
      const shiftTypeId = shiftPatterns[patternIndex];
      const shiftType = mockShiftTypes.find(s => s.id === shiftTypeId)!;
      
      shifts.push({
        id: `shift-${id++}`,
        employeeId: emp.id,
        employeeName: emp.name,
        shiftTypeId,
        shiftType: shiftType.key,
        date,
        startTime: shiftType.startTime,
        endTime: shiftType.endTime,
        status: day < now.getDate() ? 'completed' : 'scheduled',
      });

      // Add oncall for some days
      if (day % 7 === (empIndex % 3) && shiftTypeId !== 'st-6') {
        shifts.push({
          id: `shift-${id++}`,
          employeeId: emp.id,
          employeeName: emp.name,
          shiftTypeId: 'st-4',
          shiftType: 'oncall',
          date,
          startTime: '00:00',
          endTime: '23:59',
          status: 'scheduled',
        });
      }

      // Add overtime occasionally
      if (day % 10 === empIndex % 4) {
        shifts.push({
          id: `shift-${id++}`,
          employeeId: emp.id,
          employeeName: emp.name,
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

// ==================== الإشعارات ====================
export const mockNotifications: AppNotification[] = [
  { id: 'notif-1', type: 'oncall_assignment', title: 'تكليف تحت الطلب', message: 'تم تكليفك بنوبة تحت الطلب يوم الخميس القادم', oldShiftType: 'صباحي', newShiftType: 'تحت الطلب', isRead: false, isUrgent: true, createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
  { id: 'notif-2', type: 'shift_change', title: 'تعديل الشيفت', message: 'تم تغيير شيفتك من مسائي إلى صباحي يوم الأحد', oldShiftType: 'مسائي', newShiftType: 'صباحي', isRead: false, isUrgent: false, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
  { id: 'notif-3', type: 'overtime_assignment', title: 'عمل إضافي', message: 'تم تكليفك بعمل إضافي يوم السبت من 3:00 م إلى 7:00 م', newShiftType: 'عمل إضافي', isRead: false, isUrgent: true, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
  { id: 'notif-4', type: 'schedule_published', title: 'نشر الجدول', message: 'تم نشر جدول شهر يوليو 2026', isRead: true, isUrgent: false, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
  { id: 'notif-5', type: 'shift_change', title: 'تعديل الشيفت', message: 'تم تغيير شيفتك من ليلي إلى مسائي يوم الثلاثاء', oldShiftType: 'ليلي', newShiftType: 'مسائي', isRead: true, isUrgent: false, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() },
  { id: 'notif-6', type: 'general', title: 'تحديث النظام', message: 'تم تحديث نظام الجدولة. يرجى مراجعة جدولك الجديد', isRead: true, isUrgent: false, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString() },
];

// ==================== سجل التغييرات ====================
export const mockAuditLog: AuditLogEntry[] = [
  { id: 'audit-1', userId: 'emp-1', userName: 'د. عبدالله الحربي', action: 'update', entityType: 'shift', entityId: 'shift-15', description: 'تعديل شيفت محمد السعيد', oldValue: 'صباحي - 7:00 ص', newValue: 'مسائي - 3:00 م', timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
  { id: 'audit-2', userId: 'emp-1', userName: 'د. عبدالله الحربي', action: 'create', entityType: 'shift', entityId: 'shift-200', description: 'إضافة نوبة تحت الطلب لفاطمة الزهراني', newValue: 'تحت الطلب - الخميس', timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString() },
  { id: 'audit-3', userId: 'emp-8', userName: 'عمر الدوسري', action: 'bulk_update', entityType: 'schedule', entityId: 'bulk-1', description: 'تعديل جماعي على 5 شيفتات', oldValue: 'شيفتات متنوعة', newValue: 'صباحي للجميع', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() },
  { id: 'audit-4', userId: 'emp-1', userName: 'د. عبدالله الحربي', action: 'update', entityType: 'employee', entityId: 'emp-7', description: 'تحديث بيانات سارة المالكي', oldValue: 'فنية أشعة', newValue: 'فنية أشعة مقطعية', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
  { id: 'audit-5', userId: 'emp-1', userName: 'د. عبدالله الحربي', action: 'delete', entityType: 'shift', entityId: 'shift-50', description: 'حذف شيفت إجازة خالد الشمري', oldValue: 'إجازة - الأربعاء', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() },
];

// ==================== مساعدات للمصادقة الوهمية ====================
export function mockLogin(email: string, password: string) {
  if (password !== '123456') return null;
  const employee = mockEmployees.find(e => e.email === email);
  if (!employee) return null;
  return {
    user: {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      role: employee.role,
      departmentId: employee.departmentId,
      departmentName: employee.departmentName || 'قسم الأشعة المقطعية',
    },
    token: 'mock-jwt-token-' + employee.id,
  };
}

export function getShiftsForEmployee(employeeId: string): Shift[] {
  return mockShifts.filter(s => s.employeeId === employeeId);
}

export function getShiftsForDate(date: string): Shift[] {
  return mockShifts.filter(s => s.date === date);
}

export function getShiftTypeById(id: string): ShiftType | undefined {
  return mockShiftTypes.find(s => s.id === id);
}
