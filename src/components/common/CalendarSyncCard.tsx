import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Smartphone, Monitor, Apple } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface CalendarSyncCardProps {
  icalUrl: string;
}

const tabIds = ['google', 'apple', 'outlook'] as const;
type TabId = typeof tabIds[number];

const tabIcons: Record<TabId, typeof Monitor> = {
  google: Monitor,
  apple: Apple,
  outlook: Monitor,
};

export default function CalendarSyncCard({ icalUrl }: CalendarSyncCardProps) {
  const { t } = useTranslation(['calendar', 'common']);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('google');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(icalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const instructions = t(`calendar:card.instructions.${activeTab}`, { returnObjects: true }) as string[];

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="text-lg font-semibold text-text-primary mb-2">{t('calendar:card.urlTitle')}</h3>
        <p className="text-sm text-text-secondary mb-4">{t('calendar:card.urlDescription')}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={icalUrl}
            readOnly
            className="input-field flex-1 font-mono text-xs"
            dir="ltr"
          />
          <Button
            variant={copied ? 'primary' : 'secondary'}
            onClick={handleCopy}
            icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          >
            {copied ? t('common:actions.copied') : t('common:actions.copy')}
          </Button>
        </div>
        <p className="text-xs text-text-secondary mt-3 flex items-center gap-1">
          <Smartphone className="w-3.5 h-3.5" />
          {t('calendar:card.updateNote')}
        </p>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-text-primary mb-4">{t('calendar:card.howToTitle')}</h3>
        <div className="flex gap-2 mb-4 border-b border-border pb-3 overflow-x-auto">
          {tabIds.map((tabId) => {
            const Icon = tabIcons[tabId];
            return (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-btn text-sm font-medium transition-colors',
                  activeTab === tabId
                    ? 'bg-primary text-white'
                    : 'text-text-secondary hover:bg-gray-100'
                )}
              >
                <Icon className="w-4 h-4" />
                {t(`calendar:card.tabs.${tabId}`)}
              </button>
            );
          })}
        </div>
        <ol className="space-y-2.5 text-sm text-text-secondary list-decimal list-inside">
          {Array.isArray(instructions) && instructions.map((step, i) => (
            <li key={i} className="leading-relaxed">{step}</li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
