/**
 * mockPasswordStore — stores per-employee passwords in localStorage.
 * Default password for every employee is '123456'.
 * This mirrors what a real backend would manage.
 */

const STORAGE_KEY = 'ngh_mock_passwords';

function getStore(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveStore(store: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/** Returns the stored password for an employee, defaulting to '123456' */
export function getEmployeePassword(employeeId: string): string {
  return getStore()[employeeId] ?? '123456';
}

/** Saves a new password for an employee */
export function setEmployeePassword(employeeId: string, password: string): void {
  const store = getStore();
  store[employeeId] = password;
  saveStore(store);
}

/** Returns true if the given password matches the stored password */
export function verifyEmployeePassword(employeeId: string, password: string): boolean {
  return getEmployeePassword(employeeId) === password;
}
