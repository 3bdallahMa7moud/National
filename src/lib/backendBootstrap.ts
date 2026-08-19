import type { OperationalAuditEntry } from '@/types/operationalAudit';
import type { AppNotification } from '@/types/notification';
import type { ShiftRequest } from '@/types/shiftRequest';
import api from './axios';
import {
  type ApiBootstrapPayload,
  type ApiViewer,
  mapApiDepartmentToRecord,
  mapApiEmployeeToDirectoryRecord,
} from './backendAdapters';
import type { ScheduleMatrixData } from '@/types/scheduleMatrix';
import { useDepartmentStore } from '@/stores/departmentStore';
import { useEmployeeDirectoryStore } from '@/stores/employeeDirectoryStore';
import { useTargetedNotificationStore } from '@/stores/targetedNotificationStore';
import { useOperationalAuditStore } from '@/stores/operationalAuditStore';
import {
  normalizeScheduleMatrixData,
  useScheduleMatrixStore,
} from '@/stores/scheduleMatrixStore';
import { useLateScheduleStore } from '@/stores/lateScheduleStore';
import { useShiftRequestStore } from '@/stores/shiftRequestStore';
import { setBackendStateUpdatedAt, suppressBackendSync } from './backendStateSync';

export async function fetchSessionViewer() {
  const response = await api.get<{ user: ApiViewer }>('/auth/session');
  return response.data.user;
}

export async function fetchAndHydrateBootstrap() {
  const response = await api.get<ApiBootstrapPayload>('/bootstrap');
  hydrateBackendState(response.data);
  return response.data;
}

function normalizeScheduleMonthMap(source: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(source).map(([monthKey, value]) => [
      monthKey,
      normalizeScheduleMatrixData(structuredClone(value) as ScheduleMatrixData),
    ]),
  );
}

function normalizeScheduleVersionMap(source: Record<string, unknown[]>) {
  return Object.fromEntries(
    Object.entries(source).map(([monthKey, versions]) => [
      monthKey,
      versions.map((version) => {
        if (!version || typeof version !== 'object' || !('data' in version)) return structuredClone(version);
        const cloned = structuredClone(version) as { data?: ScheduleMatrixData };
        if (cloned.data) cloned.data = normalizeScheduleMatrixData(cloned.data);
        return cloned;
      }),
    ]),
  );
}

export function hydrateBackendState(payload: ApiBootstrapPayload) {
  suppressBackendSync(() => {
    setBackendStateUpdatedAt(payload);
    useDepartmentStore.getState().setRecords(payload.departments.map(mapApiDepartmentToRecord));

    useEmployeeDirectoryStore.getState().replaceRecords(
      payload.employees.map((employee) => mapApiEmployeeToDirectoryRecord(
        employee,
        payload.accessProfiles[employee.id],
      )),
      ['backend-bootstrap'],
    );

    useTargetedNotificationStore.getState().replaceNotifications(
      payload.notifications as AppNotification[],
    );

    useOperationalAuditStore.setState((state) => ({
      ...state,
      entries: payload.auditEntries as OperationalAuditEntry[],
      storageError: null,
    }));

    useShiftRequestStore.setState((state) => ({
      ...state,
      requests: payload.shiftRequests as ShiftRequest[],
      storageError: null,
    }));

    const scheduleDraftsByMonth = normalizeScheduleMonthMap(payload.schedule.draftsByMonth);
    const scheduleMatricesByMonth = normalizeScheduleMonthMap(payload.schedule.matricesByMonth);
    const scheduleVersionsByMonth = normalizeScheduleVersionMap(payload.schedule.versionsByMonth);

    useScheduleMatrixStore.setState((state) => {
      const monthKey = `${state.year}-${String(state.month + 1).padStart(2, '0')}`;
      const draft = scheduleDraftsByMonth[monthKey];
      const stored = scheduleMatricesByMonth[monthKey];
      const isDeleted = payload.schedule.deletedMonths.includes(monthKey);
      const currentData = (!isDeleted && draft) ? draft : (stored ?? state.data);

      return {
        ...state,
        data: currentData as typeof state.data,
        matricesByMonth: scheduleMatricesByMonth as typeof state.matricesByMonth,
        draftsByMonth: scheduleDraftsByMonth as typeof state.draftsByMonth,
        versionsByMonth: scheduleVersionsByMonth as typeof state.versionsByMonth,
        monthStatuses: payload.schedule.monthStatuses as typeof state.monthStatuses,
        deletedMonths: payload.schedule.deletedMonths,
        snapshot: JSON.stringify(stored ?? currentData ?? null),
        draftCellKeys: draft && !isDeleted ? [`restored-draft|${monthKey}`] : [],
        storageError: null,
      };
    });

    useLateScheduleStore.setState((state) => {
      const monthKey = `${state.year}-${String(state.month + 1).padStart(2, '0')}`;
      const rows = payload.overtime.rowsByMonth[monthKey] ?? state.rows;
      const units = payload.overtime.unitsByMonth[monthKey] ?? state.units;

      return {
        ...state,
        rows: rows as typeof state.rows,
        units: units as typeof state.units,
        rowsByMonth: payload.overtime.rowsByMonth as typeof state.rowsByMonth,
        unitsByMonth: payload.overtime.unitsByMonth as typeof state.unitsByMonth,
        publishedRowsByMonth: payload.overtime.publishedRowsByMonth as typeof state.publishedRowsByMonth,
        publishedUnitsByMonth: payload.overtime.publishedUnitsByMonth as typeof state.publishedUnitsByMonth,
        departmentIdsByMonth: payload.overtime.departmentIdsByMonth,
        versionsByMonth: payload.overtime.versionsByMonth as typeof state.versionsByMonth,
        monthStatuses: payload.overtime.monthStatuses as typeof state.monthStatuses,
        deletedMonths: payload.overtime.deletedMonths,
        notice: payload.overtime.notice,
        storageError: null,
      };
    });
  });

}
