export type AuditAction = 'create' | 'update' | 'delete' | 'bulk_update';
export type AuditEntityType = 'shift' | 'employee' | 'department' | 'schedule';

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  description: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
}
