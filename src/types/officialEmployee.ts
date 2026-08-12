import type { LegendEmployee } from './scheduleMatrix';

export type OfficialEmployeeOrigin = 'schedule' | 'directory';

export interface OfficialEmployee extends LegendEmployee {
  origin: OfficialEmployeeOrigin;
  /** Badge/employee number shown in administrative reports. */
  employeeNumber?: string;
}
