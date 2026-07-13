import { Activity, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import type { OperationalAuditEntry } from '@/types/operationalAudit';

interface RecentOperationalActivityProps { entries: OperationalAuditEntry[]; locale: string }

export default function RecentOperationalActivity({ entries, locale }: RecentOperationalActivityProps) {
  const { t } = useTranslation('dashboard');
  return (
    <Card padding={false} className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary"><Activity className="h-4 w-4 text-primary" aria-hidden="true" />{t('activity.title')}</h2>
          <p className="mt-1 text-xs text-text-secondary">{t('activity.description')}</p>
        </div>
        <Link to="/admin/audit-log" className="inline-flex min-h-11 items-center gap-1 rounded-btn px-3 text-sm font-medium text-primary hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary/30">
          {t('activity.viewAuditLog')}<ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
        </Link>
      </div>
      {entries.length === 0 ? <p className="px-5 py-8 text-center text-sm text-text-secondary">{t('activity.empty')}</p> : (
        <ol className="divide-y divide-border/60">
          {entries.slice(0, 5).map((entry) => (
            <li key={entry.id} data-testid="recent-audit-entry" className="px-5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">{entry.entityLabel}</p>
                  <p className="mt-0.5 text-xs text-text-secondary">{entry.actorName} · {t(`activity.actions.${entry.action}`)} · {t(`activity.modules.${entry.module}`)}</p>
                </div>
                <time className="shrink-0 text-xs text-text-secondary" dateTime={entry.timestamp}>{new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(entry.timestamp))}</time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
