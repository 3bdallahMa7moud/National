import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Clock3, ListOrdered } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

type SettingsView = 'shiftTypes' | 'tableOrder';

interface ScheduleSettingsWorkspaceProps {
  shiftTypesPanel: ReactNode;
  tableOrderPanel: ReactNode;
}

const VIEW_ORDER: SettingsView[] = ['shiftTypes', 'tableOrder'];

export default function ScheduleSettingsWorkspace({
  shiftTypesPanel,
  tableOrderPanel,
}: ScheduleSettingsWorkspaceProps) {
  const { t, i18n } = useTranslation('schedule');
  const [activeView, setActiveView] = useState<SettingsView>('shiftTypes');
  const tabRefs = useRef<Record<SettingsView, HTMLButtonElement | null>>({
    shiftTypes: null,
    tableOrder: null,
  });
  const instanceId = useId().replace(/:/g, '');

  const selectAndFocus = (view: SettingsView) => {
    setActiveView(view);
    tabRefs.current[view]?.focus();
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentView: SettingsView) => {
    const currentIndex = VIEW_ORDER.indexOf(currentView);
    const isRtl = i18n.dir() === 'rtl';
    let nextIndex: number | null = null;

    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = VIEW_ORDER.length - 1;
    if (event.key === 'ArrowRight') nextIndex = currentIndex + (isRtl ? -1 : 1);
    if (event.key === 'ArrowLeft') nextIndex = currentIndex + (isRtl ? 1 : -1);

    if (nextIndex === null) return;
    event.preventDefault();
    const wrappedIndex = (nextIndex + VIEW_ORDER.length) % VIEW_ORDER.length;
    selectAndFocus(VIEW_ORDER[wrappedIndex]);
  };

  const tabs: Array<{ view: SettingsView; label: string; icon: ReactNode }> = [
    {
      view: 'shiftTypes',
      label: t('settingsPanel.workspace.shiftTypes'),
      icon: <Clock3 className="h-4 w-4" aria-hidden="true" />,
    },
    {
      view: 'tableOrder',
      label: t('settingsPanel.workspace.tableOrder'),
      icon: <ListOrdered className="h-4 w-4" aria-hidden="true" />,
    },
  ];

  const activeTabId = `${instanceId}-${activeView}-tab`;
  const activePanelId = `${instanceId}-${activeView}-panel`;

  return (
    <section className="space-y-4">
      <div
        role="tablist"
        aria-label={t('settingsPanel.workspace.ariaLabel')}
        className="grid grid-cols-1 gap-2 rounded-2xl border border-border bg-surface p-2 shadow-soft sm:grid-cols-2"
      >
        {tabs.map(({ view, label, icon }) => {
          const selected = activeView === view;
          return (
            <button
              key={view}
              ref={(element) => {
                tabRefs.current[view] = element;
              }}
              id={`${instanceId}-${view}-tab`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${instanceId}-${view}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveView(view)}
              onKeyDown={(event) => handleTabKeyDown(event, view)}
              className={cn(
                'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-teal focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                selected
                  ? 'border-primary-teal bg-primary-teal text-white shadow-sm'
                  : 'border-transparent bg-surface-muted/50 text-text-secondary hover:border-border hover:bg-hover hover:text-ink',
              )}
            >
              {icon}
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <div
        id={activePanelId}
        role="tabpanel"
        aria-labelledby={activeTabId}
        tabIndex={0}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-teal/50"
      >
        {activeView === 'shiftTypes' ? shiftTypesPanel : tableOrderPanel}
      </div>
    </section>
  );
}
