import { useTranslation } from 'react-i18next';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning';
  loading?: boolean;
}

export default function ConfirmDialog({
  isOpen, onClose, onConfirm, title, message,
  confirmText, cancelText,
  variant = 'danger', loading = false,
}: ConfirmDialogProps) {
  const { t } = useTranslation(['common']);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" title={title}>
      <div className="text-center">
        <div className={`mx-auto p-3 rounded-full w-fit mb-4 ${variant === 'danger' ? 'bg-danger-50' : 'bg-warning-50'}`}>
          <AlertTriangle className={`w-8 h-8 ${variant === 'danger' ? 'text-danger' : 'text-warning'}`} />
        </div>
        <p className="text-sm text-text-secondary mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelText ?? t('common:actions.cancel')}
          </Button>
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmText ?? t('common:actions.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
