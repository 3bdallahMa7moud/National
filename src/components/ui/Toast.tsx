import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'urgent';
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  urgent: AlertTriangle,
};

const styles = {
  success: 'border-success bg-success-50 text-success-600',
  error: 'border-danger bg-danger-50 text-danger-600',
  warning: 'border-warning bg-warning-50 text-warning-600',
  info: 'border-info bg-info-50 text-info-600',
  urgent: 'border-danger bg-danger text-white',
};

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const Icon = icons[toast.type];

  useEffect(() => {
    const timeout = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration || (toast.type === 'urgent' ? 10000 : 4000));
    return () => clearTimeout(timeout);
  }, [toast, onDismiss]);

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-card border-s-4 shadow-dropdown min-w-[320px] max-w-[420px] animate-toastIn',
        styles[toast.type]
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.message && <p className="text-xs mt-0.5 opacity-80">{toast.message}</p>}
      </div>
      <button onClick={() => onDismiss(toast.id)} className="flex-shrink-0 p-0.5 rounded hover:opacity-70">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-4 start-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
      <style>{`
        @keyframes toastIn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
        .animate-toastIn { animation: toastIn 0.3s ease-out; }
      `}</style>
    </ToastContext.Provider>
  );
}
