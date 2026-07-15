import { useEffect, useRef } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { operationalAuditEntityKey } from '@/lib/operationalAudit';
import type { OperationalAuditEntry } from '@/types/operationalAudit';

interface AuditEntryDetailsDrawerProps { entry: OperationalAuditEntry | null; onClose: () => void }

function relatedHref(entry: OperationalAuditEntry): string {
  const params = new URLSearchParams();
  const { context } = entry;
  if (context.year !== undefined) params.set('year', String(context.year));
  if (context.month !== undefined) params.set('month', String(context.month + 1));
  if (context.rowId) params.set('rowId', context.rowId);
  if (context.day !== undefined) params.set('day', String(context.day));
  const query = params.toString();
  return query ? `${context.route}?${query}` : context.route;
}

export default function AuditEntryDetailsDrawer({ entry, onClose }: AuditEntryDetailsDrawerProps) {
  const { t, i18n } = useTranslation('reports');
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!entry) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter((element) => !element.hasAttribute('disabled'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [entry, onClose]);

  if (!entry) return null;
  const entityKey = operationalAuditEntityKey(entry);
  const entityLabel = entityKey ? t(entityKey) : entry.entityLabel;
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label={t('audit.details.close')} onClick={onClose} className="absolute inset-0 bg-black/40" />
      <aside ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="audit-details-title" className="absolute inset-y-0 end-0 w-full max-w-lg overflow-y-auto border-s border-border bg-surface p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">{t(`audit.modules.${entry.module}`)}</p><h2 id="audit-details-title" className="mt-1 text-lg font-semibold text-text-primary">{t('audit.details.title')}</h2></div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t('audit.details.close')} className="flex min-h-11 min-w-11 items-center justify-center rounded-btn text-text-secondary hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/30"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        <div className="space-y-5 py-5">
          <div><p className="text-xs font-medium text-text-secondary">{t('audit.details.entity')}</p><p className="mt-1 font-semibold text-text-primary">{entityLabel}</p><p className="mt-1 font-mono text-xs text-text-secondary">{entry.entityId}</p></div>
          <dl className="grid grid-cols-2 gap-4 rounded-card bg-surface-muted p-4 text-sm">
            <div><dt className="text-xs text-text-secondary">{t('audit.details.actor')}</dt><dd className="mt-1 font-medium text-text-primary">{entry.actorName}</dd></div>
            <div><dt className="text-xs text-text-secondary">{t('audit.details.action')}</dt><dd className="mt-1 font-medium text-text-primary">{t(`audit.actions.${entry.action}`)}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-text-secondary">{t('audit.details.timestamp')}</dt><dd className="mt-1 text-text-primary">{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(entry.timestamp))}</dd></div>
          </dl>
          {(entry.before !== undefined || entry.after !== undefined) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-card border border-danger/20 bg-danger/5 p-3"><p className="text-xs font-semibold text-danger">{t('audit.details.before')}</p><pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-text-primary">{entry.before || t('audit.details.notAvailable')}</pre></div>
              <div className="rounded-card border border-success/20 bg-success/5 p-3"><p className="text-xs font-semibold text-success">{t('audit.details.after')}</p><pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-text-primary">{entry.after || t('audit.details.notAvailable')}</pre></div>
            </div>
          )}
          <dl className="space-y-2 text-xs text-text-secondary">
            {entry.context.facilityId && <div className="flex justify-between gap-4"><dt>{t('audit.details.facility')}</dt><dd className="font-mono text-text-primary">{entry.context.facilityId}</dd></div>}
            {entry.context.unitId && <div className="flex justify-between gap-4"><dt>{t('audit.details.unit')}</dt><dd className="font-mono text-text-primary">{entry.context.unitId}</dd></div>}
            {entry.context.rowId && <div className="flex justify-between gap-4"><dt>{t('audit.details.row')}</dt><dd className="font-mono text-text-primary">{entry.context.rowId}</dd></div>}
            {entry.context.day !== undefined && <div className="flex justify-between gap-4"><dt>{t('audit.details.day')}</dt><dd className="font-mono text-text-primary">{entry.context.day}</dd></div>}
          </dl>
          <Link to={relatedHref(entry)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-btn bg-primary px-4 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary/30">{t('audit.details.openRelated')}<ExternalLink className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
      </aside>
    </div>
  );
}
