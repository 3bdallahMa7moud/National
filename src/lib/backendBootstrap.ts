import type { OperationalAuditEntry } from '@/types/operationalAudit';
import type { AppNotification } from '@/types/notification';
import type { ShiftRequest } from '@/types/shiftRequest';
import api from './axios';
import {
  type ApiBootstrapPayload,
  type ApiViewer,
  mapApiDepartmentToMockSource,
  mapApiEmployeeToDirectoryRecord,
} from './backendAdapters';
import { useDepartmentStore } from '@/stores/departmentStore';
import { useEmployeeDirectoryStore } from '@/stores/employeeDirectoryStore';
import { useEmployeeAccessStore } from '@/stores/employeeAccessStore';
import { useTargetedNotificationStore } from '@/stores/targetedNotificationStore';
import { useOperationalAuditStore } from '@/stores/operationalAuditStore';
import { useScheduleMatrixStore } from '@/stores/scheduleMatrixStore';
import { useLateScheduleStore } from '@/stores/lateScheduleStore';
import { useShiftRequestStore } from '@/stores/shiftRequestStore';
import { triggerMockDataChange } from '@/hooks/useMockData';
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

export function hydrateBackendState(payload: ApiBootstrapPayload) {
  suppressBackendSync(() => {
    setBackendStateUpdatedAt(payload);
    useDepartmentStore.getState().setRecords(payload.departments.map(mapApiDepartmentToMockSource));

    useEmployeeDirectoryStore.setState((state) => ({
      ...state,
      records: payload.employees.map(mapApiEmployeeToDirectoryRecord),
      storageError: null,
    }));

    useEmployeeAccessStore.setState((state) => ({
      ...state,
      profiles: payload.accessProfiles,
      storageError: null,
    }));

    useTargetedNotificationStore.setState((state) => ({
      ...state,
      notifications: payload.notifications as AppNotification[],
      storageError: null,
    }));

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

    useScheduleMatrixStore.setState((state) => {
      const monthKey = `${state.year}-${String(state.month + 1).padStart(2, '0')}`;
      const currentData = payload.schedule.draftsByMonth[monthKey]
        ?? payload.schedule.matricesByMonth[monthKey]
        ?? state.data;

      return {
        ...state,
        data: currentData as typeof state.data,
        matricesByMonth: payload.schedule.matricesByMonth as typeof state.matricesByMonth,
        draftsByMonth: payload.schedule.draftsByMonth as typeof state.draftsByMonth,
        versionsByMonth: payload.schedule.versionsByMonth as typeof state.versionsByMonth,
        monthStatuses: payload.schedule.monthStatuses as typeof state.monthStatuses,
        deletedMonths: payload.schedule.deletedMonths,
        snapshot: JSON.stringify(currentData ?? null),
        draftCellKeys: [],
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

  triggerMockDataChange();
}
