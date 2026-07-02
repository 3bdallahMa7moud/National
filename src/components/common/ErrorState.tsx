import { AlertTriangle, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({ title = 'حدث خطأ', message = 'لم نتمكن من تحميل البيانات. يرجى المحاولة مرة أخرى', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-full bg-danger-50 mb-4">
        <AlertTriangle className="w-10 h-10 text-danger" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-1">{title}</h3>
      <p className="text-sm text-text-secondary max-w-sm mb-4">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} icon={<RefreshCw className="w-4 h-4" />}>
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}
