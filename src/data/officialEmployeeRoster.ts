import type { LegendEmployee } from '@/types/scheduleMatrix';

export type OfficialEmployeeOrigin = 'schedule';

export interface OfficialEmployee extends LegendEmployee {
  origin: OfficialEmployeeOrigin;
}

export const OFFICIAL_EMPLOYEE_ROSTER: OfficialEmployee[] = [
  { employeeId: 'ot-employee-s', code: 'S', fullName: 'Ali', fullNameEn: 'Ali', origin: 'schedule' },
  { employeeId: 'emp-m-1', code: 'A', fullName: 'Ahmed', fullNameEn: 'Ahmed', origin: 'schedule' },
  { employeeId: 'emp-m-2', code: 'L', fullName: 'Suliman', fullNameEn: 'Suliman', origin: 'schedule' },
  { employeeId: 'emp-m-3', code: 'U', fullName: 'Hamad', fullNameEn: 'Hamad', origin: 'schedule' },
  { employeeId: 'emp-m-4', code: 'P', fullName: 'Nasser', fullNameEn: 'Nasser', origin: 'schedule' },
  { employeeId: 'emp-m-5', code: 'N', fullName: 'Sultana', fullNameEn: 'Sultana', origin: 'schedule' },
  { employeeId: 'emp-m-6', code: 'Z', fullName: 'Ammar', fullNameEn: 'Ammar', origin: 'schedule' },
  { employeeId: 'emp-m-7', code: 'I', fullName: 'Mona', fullNameEn: 'Mona', origin: 'schedule' },
  { employeeId: 'emp-m-8', code: 'D', fullName: 'Nosiba', fullNameEn: 'Nosiba', origin: 'schedule' },
  { employeeId: 'emp-m-9', code: 'Q', fullName: 'Eshraq', fullNameEn: 'Eshraq', origin: 'schedule' },
  { employeeId: 'emp-m-10', code: 'MA', fullName: 'Malak', fullNameEn: 'Malak', origin: 'schedule' },
  { employeeId: 'emp-m-11', code: 'G', fullName: 'Abdualla', fullNameEn: 'Abdualla', origin: 'schedule' },
  { employeeId: 'emp-m-12', code: 'YK', fullName: 'Yasser', fullNameEn: 'Yasser', origin: 'schedule' },
  { employeeId: 'emp-m-13', code: 'FA', fullName: 'Fahad', fullNameEn: 'Fahad', origin: 'schedule' },
  { employeeId: 'emp-m-14', code: 'RK', fullName: 'Rakan', fullNameEn: 'Rakan', origin: 'schedule' },
  { employeeId: 'emp-m-16', code: 'EJ', fullName: 'Ebrahim', fullNameEn: 'Ebrahim', origin: 'schedule' },
  { employeeId: 'emp-m-17', code: 'O', fullName: 'DEMA', fullNameEn: 'DEMA', origin: 'schedule' },
  { employeeId: 'emp-m-18', code: 'Y', fullName: 'SULTAN', fullNameEn: 'SULTAN', origin: 'schedule' },
  { employeeId: 'emp-m-19', code: 'AO', fullName: 'ABRAR', fullNameEn: 'ABRAR', origin: 'schedule' },
  { employeeId: 'emp-m-20', code: 'NQ', fullName: 'NORAH', fullNameEn: 'NORAH', origin: 'schedule' },
  { employeeId: 'emp-m-22', code: 'J', fullName: "A'JUHAYRI", fullNameEn: "A'JUHAYRI", origin: 'schedule' },
  { employeeId: 'emp-m-23', code: 'NO', fullName: 'NOUF', fullNameEn: 'NOUF', origin: 'schedule' },
  { employeeId: 'emp-m-24', code: 'H', fullName: 'HADEEL', fullNameEn: 'HADEEL', origin: 'schedule' },
  { employeeId: 'emp-m-25', code: 'GR', fullName: "A'Qraini", fullNameEn: "A'Qraini", origin: 'schedule' },
  { employeeId: 'emp-m-26', code: 'TG', fullName: 'TAGREED', fullNameEn: 'TAGREED', origin: 'schedule' },
  { employeeId: 'emp-m-27', code: 'AH', fullName: "A'HARTHI", fullNameEn: "A'HARTHI", origin: 'schedule' },
  { employeeId: 'emp-m-28', code: 'B', fullName: "A'OTAIBI", fullNameEn: "A'OTAIBI", origin: 'schedule' },
  { employeeId: 'emp-m-29', code: 'C', fullName: "Abdu'Otaibi", fullNameEn: "Abdu'Otaibi", origin: 'schedule' },
  { employeeId: 'emp-m-30', code: 'F', fullName: "Abdu'R", fullNameEn: "Abdu'R", origin: 'schedule' },
];
