import { Filter, RotateCcw, Search } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import type { AuditFilters, OperationalAuditAction, OperationalAuditModule } from '@/types/operationalAudit';

interface AuditLogFiltersProps {
  filters: AuditFilters;
  actors: string[];
  activeCount: number;
  onChange: (filters: AuditFilters) => void;
  onReset: () => void;
}

const actions: Array<OperationalAuditAction | 'all'> = ['all', 'create', 'update', 'delete', 'assign', 'clear', 'archive', 'restore', 'publish', 'discard', 'vacation', 'settings', 'undo'];
const modules: Array<OperationalAuditModule | 'all'> = ['all', 'schedule', 'ot', 'employees', 'profile', 'settings'];

export default function AuditLogFilters({ filters, actors, activeCount, onChange, onReset }: AuditLogFiltersProps) {
  const { t } = useTranslation('reports');
  const [mobileOpen, setMobileOpen] = useState(false);
  const change = <Key extends keyof AuditFilters>(key: Key, value: AuditFilters[Key]) => onChange({ ...filters, [key]: value });

  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-card">
      <button
        type="button"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((value) => !value)}
        className="flex min-h-11 w-full items-center justify-between rounded-btn px-2 text-sm font-semibold text-text-primary sm:hidden"
      >
        <span className="flex items-center gap-2"><Filter className="h-4 w-4" aria-hidden="true" />{t('audit.filters.title')}</span>
        <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary">{activeCount}</span>
      </button>
      <div className={`${mobileOpen ? 'grid' : 'hidden'} mt-3 grid-cols-1 gap-3 sm:mt-0 sm:grid sm:grid-cols-2 xl:grid-cols-6`}>
        <label className="text-xs font-medium text-text-secondary xl:col-span-2">
          <span className="mb-1.5 block">{t('audit.filters.search')}</span>
          <span className="relative block">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" aria-hidden="true" />
            <input type="search" value={filters.search} onChange={(event) => change('search', event.target.value)} className="input-field min-h-11 ps-10" />
          </span>
        </label>
        <label className="text-xs font-medium text-text-secondary">
          <span className="mb-1.5 block">{t('audit.filters.from')}</span>
          <input type="date" value={filters.startDate ?? ''} onChange={(event) => change('startDate', event.target.value || undefined)} className="input-field min-h-11" />
        </label>
        <label className="text-xs font-medium text-text-secondary">
          <span className="mb-1.5 block">{t('audit.filters.to')}</span>
          <input type="date" value={filters.endDate ?? ''} onChange={(event) => change('endDate', event.target.value || undefined)} className="input-field min-h-11" />
        </label>
        <label className="text-xs font-medium text-text-secondary">
          <span className="mb-1.5 block">{t('audit.filters.actor')}</span>
          <select value={filters.actor} onChange={(event) => change('actor', event.target.value)} className="input-field min-h-11">
            <option value="">{t('audit.filters.allActors')}</option>
            {actors.map((actor) => <option key={actor} value={actor}>{actor}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-text-secondary">
          <span className="mb-1.5 block">{t('audit.filters.action')}</span>
          <select value={filters.action} onChange={(event) => change('action', event.target.value as AuditFilters['action'])} className="input-field min-h-11">
            {actions.map((action) => <option key={action} value={action}>{action === 'all' ? t('audit.filters.allActions') : t(`audit.actions.${action}`)}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-text-secondary">
          <span className="mb-1.5 block">{t('audit.filters.module')}</span>
          <select value={filters.module} onChange={(event) => change('module', event.target.value as AuditFilters['module'])} className="input-field min-h-11">
            {modules.map((module) => <option key={module} value={module}>{module === 'all' ? t('audit.filters.allModules') : t(`audit.modules.${module}`)}</option>)}
          </select>
        </label>
        <div className="flex items-end xl:col-start-6">
          <Button type="button" variant="secondary" onClick={onReset} className="min-h-11 w-full" icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}>
            {t('audit.filters.reset')}
          </Button>
        </div>
      </div>
    </div>
  );
}
