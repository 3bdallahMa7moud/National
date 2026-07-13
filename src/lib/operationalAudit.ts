import type { AuditEntry } from '@/types/scheduleMatrix';
import type {
  AuditFilters,
  OperationalAuditAction,
  OperationalAuditEntry,
  OperationalAuditModule,
} from '@/types/operationalAudit';

function scheduleAction(action: AuditEntry['action']): OperationalAuditAction {
  switch (action) {
    case 'remove': return 'clear';
    case 'assign': return 'assign';
    case 'vacation': return 'vacation';
    case 'publish': return 'publish';
    case 'discard': return 'discard';
    case 'settings': return 'settings';
    case 'undo': return 'undo';
    case 'archive': return 'archive';
    case 'restore': return 'restore';
  }
}

function scheduleModule(action: AuditEntry['action']): OperationalAuditModule {
  return action === 'settings' || action === 'archive' || action === 'restore'
    ? 'settings'
    : 'schedule';
}

function normalizeScheduleEntry(entry: AuditEntry): OperationalAuditEntry {
  const entityId = entry.rowId || entry.unitId || entry.facilityId || 'schedule';
  return {
    id: entry.id,
    actorName: entry.actorName,
    action: scheduleAction(entry.action),
    module: scheduleModule(entry.action),
    entityId,
    entityLabel: entry.newValue || entry.oldValue || entityId,
    timestamp: entry.timestamp,
    before: entry.oldValue,
    after: entry.newValue,
    context: {
      facilityId: entry.facilityId,
      unitId: entry.unitId,
      rowId: entry.rowId,
      day: entry.day,
      route: '/admin/schedule',
    },
  };
}

export function buildUnifiedOperationalAudit(
  scheduleEntries: AuditEntry[],
  persistedEntries: OperationalAuditEntry[],
): OperationalAuditEntry[] {
  const byId = new Map<string, OperationalAuditEntry>();
  for (const entry of scheduleEntries) {
    if (!byId.has(entry.id)) byId.set(entry.id, normalizeScheduleEntry(entry));
  }
  for (const entry of persistedEntries) {
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  }
  return [...byId.values()].sort((left, right) => (
    right.timestamp.localeCompare(left.timestamp) || right.id.localeCompare(left.id)
  ));
}

export function filterAuditEntries(
  filters: AuditFilters,
  entries: OperationalAuditEntry[],
): OperationalAuditEntry[] {
  const actor = filters.actor.trim().toLocaleLowerCase();
  const search = filters.search.trim().toLocaleLowerCase();
  return entries.filter((entry) => {
    const date = entry.timestamp.slice(0, 10);
    if (filters.startDate && date < filters.startDate) return false;
    if (filters.endDate && date > filters.endDate) return false;
    if (actor && entry.actorName.toLocaleLowerCase() !== actor) return false;
    if (filters.action !== 'all' && entry.action !== filters.action) return false;
    if (filters.module !== 'all' && entry.module !== filters.module) return false;
    if (!search) return true;
    const haystack = [
      entry.actorName,
      entry.action,
      entry.module,
      entry.entityId,
      entry.entityLabel,
      entry.before,
      entry.after,
      entry.context.facilityId,
      entry.context.unitId,
      entry.context.rowId,
    ].filter(Boolean).join(' ').toLocaleLowerCase();
    return haystack.includes(search);
  });
}
