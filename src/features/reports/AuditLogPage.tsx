import { useMemo, useState } from 'react';
import { Archive, Eye, FilePlus2, RefreshCw, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AuditEntryDetailsDrawer from './AuditEntryDetailsDrawer';
import AuditLogFilters from './AuditLogFilters';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import Card from '@/components/ui/Card';
import { buildUnifiedOperationalAudit, filterAuditEntries, operationalAuditEntityKey } from '@/lib/operationalAudit';
import { cn } from '@/lib/utils';
import { useOperationalAuditStore } from '@/stores/operationalAuditStore';
import { useScheduleMatrixStore } from '@/stores/scheduleMatrixStore';
import type { AuditFilters, OperationalAuditEntry } from '@/types/operationalAudit';

const emptyFilters: AuditFilters = { actor: '', action: 'all', module: 'all', search: '' };

const actionTone: Record<OperationalAuditEntry['action'], string> = {
  create: 'bg-success/10 text-success', update: 'bg-info/10 text-info', delete: 'bg-danger/10 text-danger',
  assign: 'bg-primary-50 text-primary', clear: 'bg-warning/10 text-warning', archive: 'bg-danger/10 text-danger',
  restore: 'bg-success/10 text-success', publish: 'bg-primary-50 text-primary', discard: 'bg-warning/10 text-warning',
  vacation: 'bg-info/10 text-info', settings: 'bg-surface-muted text-text-secondary', undo: 'bg-warning/10 text-warning',
  request: 'bg-info/10 text-info', approve: 'bg-success/10 text-success', reject: 'bg-danger/10 text-danger',
  cancel: 'bg-warning/10 text-warning', expire: 'bg-surface-muted text-text-secondary',
};

export default function AuditLogPage() {
  const { t, i18n } = useTranslation('reports');
  const [filters, setFilters] = useState<AuditFilters>(emptyFilters);
  const [selectedEntry, setSelectedEntry] = useState<OperationalAuditEntry | null>(null);
  const matricesByMonth = useScheduleMatrixStore((state) => state.matricesByMonth);
  const currentMatrix = useScheduleMatrixStore((state) => state.data);
  const persistedEntries = useOperationalAuditStore((state) => state.entries);

  const allEntries = useMemo(() => {
    const scheduleEntries = [currentMatrix, ...Object.values(matricesByMonth)]
      .filter((matrix): matrix is NonNullable<typeof matrix> => !!matrix)
      .flatMap((matrix) => matrix.auditLog);
    return buildUnifiedOperationalAudit(scheduleEntries, persistedEntries);
  }, [currentMatrix, matricesByMonth, persistedEntries]);
  const filteredEntries = useMemo(() => filterAuditEntries(filters, allEntries), [allEntries, filters]);
  const actors = useMemo(() => [...new Set(allEntries.map((entry) => entry.actorName))].sort(), [allEntries]);
  const activeFilterCount = [filters.startDate, filters.endDate, filters.actor, filters.search, filters.action !== 'all', filters.module !== 'all'].filter(Boolean).length;
  const summaries = [
    { label: t('audit.summary.created', { count: filteredEntries.filter((entry) => entry.action === 'create').length }), value: filteredEntries.filter((entry) => entry.action === 'create').length, icon: FilePlus2, tone: 'text-success' },
    { label: t('audit.summary.updated', { count: filteredEntries.filter((entry) => entry.action === 'update' || entry.action === 'assign' || entry.action === 'settings').length }), value: filteredEntries.filter((entry) => entry.action === 'update' || entry.action === 'assign' || entry.action === 'settings').length, icon: RefreshCw, tone: 'text-info' },
    { label: t('audit.summary.archived', { count: filteredEntries.filter((entry) => entry.action === 'archive' || entry.action === 'delete').length }), value: filteredEntries.filter((entry) => entry.action === 'archive' || entry.action === 'delete').length, icon: Archive, tone: 'text-danger' },
    { label: t('audit.summary.restored', { count: filteredEntries.filter((entry) => entry.action === 'restore').length }), value: filteredEntries.filter((entry) => entry.action === 'restore').length, icon: RotateCcw, tone: 'text-success' },
  ];
  const entityLabel = (entry: OperationalAuditEntry) => {
    const key = operationalAuditEntityKey(entry);
    return key ? t(key) : entry.entityLabel;
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">{t('audit.title')}</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">{t('audit.subtitle')}</p>
        </div>
        <p aria-live="polite" className="text-sm font-semibold text-primary">{t('audit.matching', { count: filteredEntries.length })}</p>
      </header>

      <AuditLogFilters filters={filters} actors={actors} activeCount={activeFilterCount} onChange={setFilters} onReset={() => setFilters(emptyFilters)} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaries.map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="p-4 sm:p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xl font-semibold text-text-primary">{value}</p><p className="mt-1 text-xs text-text-secondary">{label}</p></div><Icon className={cn('h-5 w-5', tone)} aria-hidden="true" /></div>
          </Card>
        ))}
      </div>

      <ErrorBoundary level="section" invalidateQueries>
        <Card padding={false} className="overflow-hidden">
          {filteredEntries.length === 0 ? (
            <div className="px-5 py-14 text-center"><p className="font-medium text-text-primary">{t('audit.noResults')}</p><p className="mt-1 text-sm text-text-secondary">{t('audit.noResultsHint')}</p></div>
          ) : (
            <ol className="divide-y divide-border/60">
              {filteredEntries.map((entry) => (
                <li key={entry.id} data-testid="audit-entry" className="px-4 py-4 transition-colors hover:bg-hover sm:px-5">
                  <div className="flex items-start gap-3">
                    <span className={cn('mt-0.5 rounded-full px-2.5 py-1 text-[11px] font-semibold', actionTone[entry.action])}>{t(`audit.actions.${entry.action}`)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text-primary">{entityLabel(entry)}</p>
                      <p className="mt-1 text-xs text-text-secondary">{entry.actorName} · {t(`audit.modules.${entry.module}`)}</p>
                      <time className="mt-1 block text-xs text-text-secondary" dateTime={entry.timestamp}>{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.timestamp))}</time>
                    </div>
                    <button type="button" onClick={() => setSelectedEntry(entry)} aria-label={t('audit.details.view', { entity: entityLabel(entry) })} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-btn text-primary hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary/30"><Eye className="h-4 w-4" aria-hidden="true" /></button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </ErrorBoundary>

      <AuditEntryDetailsDrawer entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </div>
  );
}
