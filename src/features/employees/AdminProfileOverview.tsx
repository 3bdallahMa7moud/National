import { ArrowUpRight, CalendarDays, ClipboardList, LayoutDashboard, TimerReset } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import type { OperationalAuditEntry } from '@/types/operationalAudit';

export default function AdminProfileOverview({ recentEntries }: { recentEntries: OperationalAuditEntry[] }) {
  const { t } = useTranslation('employees');
  const links = [
    ['/admin/dashboard', 'dashboard', LayoutDashboard], ['/admin/audit-log', 'auditLog', ClipboardList], ['/admin/schedule', 'schedule', CalendarDays], ['/admin/late-schedule', 'ot', TimerReset],
  ] as const;
  return <div className="space-y-5"><Card><h2 className="text-base font-semibold text-text-primary">{t('profileView.adminOperations')}</h2><p className="mt-1 text-sm text-text-secondary">{t('profileView.adminOperationsHint')}</p><div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">{links.map(([href, key, Icon]) => <Link key={href} to={href} className="flex min-h-14 items-center gap-3 rounded-btn border border-border px-4 font-medium text-text-primary hover:border-primary/40 hover:bg-primary-50"><Icon className="h-5 w-5 text-primary" /><span>{t(`profileView.adminLinks.${key}`)}</span><ArrowUpRight className="ms-auto h-4 w-4 text-primary rtl:-scale-x-100" /></Link>)}</div></Card>{recentEntries.length > 0 && <Card><h2 className="font-semibold text-text-primary">{t('profileView.recentActivity')}</h2><ol className="mt-3 divide-y divide-border/60">{recentEntries.slice(0, 5).map((entry) => <li key={entry.id} className="py-3"><p className="text-sm font-medium text-text-primary">{entry.entityLabel}</p><p className="mt-1 text-xs text-text-secondary">{entry.actorName} · {entry.action}</p></li>)}</ol></Card>}</div>;
}
