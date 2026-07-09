import { Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export default function EmptyState({ title, message, icon, action }: EmptyStateProps) {
  const { t } = useTranslation(['common']);

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-full bg-surface-muted mb-4">
        {icon || <Inbox className="w-10 h-10 text-text-secondary" />}
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-1">
        {title ?? t('common:emptyState.title')}
      </h3>
      <p className="text-sm text-text-secondary max-w-sm">
        {message ?? t('common:emptyState.message')}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
