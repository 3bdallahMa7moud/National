import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import AuditLogRow from '@/components/common/AuditLogRow';
import { useMockData } from '@/hooks/useMockData';
import { Search, Filter, History } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function AuditLogPage() {
  const { t } = useTranslation(['reports', 'common']);
  const { auditLog } = useMockData();
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');

  const filteredLog = auditLog.filter((entry) => {
    const matchesSearch = entry.description.toLowerCase().includes(search.toLowerCase()) ||
                          entry.userName.toLowerCase().includes(search.toLowerCase()) ||
                          (entry.oldValue && entry.oldValue.toLowerCase().includes(search.toLowerCase())) ||
                          (entry.newValue && entry.newValue.toLowerCase().includes(search.toLowerCase()));
    const matchesAction = filterAction === 'all' || entry.action === filterAction;
    return matchesSearch && matchesAction;
  });

  const filterTabs = [
    { id: 'all', label: t('reports:audit.filterAll') },
    { id: 'create', label: t('common:audit.actions.create') },
    { id: 'update', label: t('common:audit.actions.update') },
    { id: 'delete', label: t('common:audit.actions.delete') },
    { id: 'bulk_update', label: t('common:audit.actions.bulk_update') },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">{t('reports:audit.title')}</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">{t('reports:audit.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 bg-primary-50 text-primary rounded-pill flex items-center gap-1.5">
            <History className="w-4 h-4" />
            {t('reports:audit.realtimeActive')}
          </span>
        </div>
      </div>

      <Card>
        <div className="mb-5 flex flex-col items-center justify-between gap-4 border-b border-border pb-4 sm:flex-row">
          <div className="relative w-full sm:w-80">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              placeholder={t('reports:audit.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field ps-10"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <Filter className="w-4 h-4 text-text-secondary flex-shrink-0" />
            {filterTabs.map((tab) => (
              <Button
                key={tab.id}
                size="sm"
                variant={filterAction === tab.id ? 'primary' : 'secondary'}
                onClick={() => setFilterAction(tab.id)}
                className="whitespace-nowrap"
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-border/50">
          {filteredLog.length === 0 ? (
            <div className="py-12 text-center text-text-secondary">
              <p className="text-base font-medium">{t('reports:audit.noResults')}</p>
              <p className="text-xs mt-1">{t('reports:audit.noResultsHint')}</p>
            </div>
          ) : (
            filteredLog.map((entry) => (
              <AuditLogRow key={entry.id} entry={entry} />
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
