import type { OfficialEmployee } from '@/types/officialEmployee';
import { getOfficialEmployeeRoster } from '@/stores/employeeRosterStore';
import type { LegendEmployee } from '@/types/scheduleMatrix';
import type { OTRosterEmployee } from '@/types/lateSchedule';

export type UnifiedEmployee = OfficialEmployee;

export function buildUnifiedEmployeeRoster(
  scheduleEmployees: LegendEmployee[],
  otOnlyEmployees: Array<OTRosterEmployee & { origin?: 'ot-only' }>,
): UnifiedEmployee[] {
  void scheduleEmployees;
  void otOnlyEmployees;
  return [...getOfficialEmployeeRoster()];
}
