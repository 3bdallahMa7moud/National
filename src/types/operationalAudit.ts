export type OperationalAuditModule = 'schedule' | 'ot' | 'employees' | 'profile' | 'settings';

export type OperationalAuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'assign'
  | 'clear'
  | 'archive'
  | 'restore'
  | 'publish'
  | 'discard'
  | 'vacation'
  | 'settings'
  | 'undo';

export type OperationalAuditRoute =
  | '/admin/schedule'
  | '/admin/late-schedule'
  | '/admin/employees'
  | '/profile';

export interface OperationalAuditContext {
  year?: number;
  month?: number;
  facilityId?: string;
  unitId?: string;
  rowId?: string;
  day?: number;
  route: OperationalAuditRoute;
}

export interface OperationalAuditEntry {
  id: string;
  actorName: string;
  action: OperationalAuditAction;
  module: OperationalAuditModule;
  entityId: string;
  entityLabel: string;
  timestamp: string;
  before?: string;
  after?: string;
  context: OperationalAuditContext;
}

export type OperationalAuditDraft = Omit<OperationalAuditEntry, 'id' | 'timestamp'>;

export interface AuditFilters {
  startDate?: string;
  endDate?: string;
  actor: string;
  action: OperationalAuditAction | 'all';
  module: OperationalAuditModule | 'all';
  search: string;
}
