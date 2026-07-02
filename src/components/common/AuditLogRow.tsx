import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { AuditLogEntry } from '@/types';
import dayjs from '@/lib/dayjs';

const actionLabels: Record<string, string> = {
  create: 'إنشاء',
  update: 'تعديل',
  delete: 'حذف',
  bulk_update: 'تعديل جماعي',
};

const actionColors: Record<string, string> = {
  create: 'bg-success-50 text-success-600',
  update: 'bg-info-50 text-info-600',
  delete: 'bg-danger-50 text-danger-600',
  bulk_update: 'bg-warning-50 text-warning-600',
};

export default function AuditLogRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border/50 last:border-0">
      <div
        className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50/50 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={cn('px-2 py-0.5 rounded-pill text-[10px] font-semibold', actionColors[entry.action])}>
          {actionLabels[entry.action]}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-primary truncate">{entry.description}</p>
          <p className="text-xs text-text-secondary">
            {entry.userName} · {dayjs(entry.timestamp).fromNow()}
          </p>
        </div>
        {(entry.oldValue || entry.newValue) && (
          expanded ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />
        )}
      </div>

      {expanded && (entry.oldValue || entry.newValue) && (
        <div className="px-4 pb-3 me-10">
          <div className="bg-gray-50 rounded-btn p-3 text-xs space-y-1">
            {entry.oldValue && (
              <div className="flex gap-2">
                <span className="text-danger font-medium">القديم:</span>
                <span className="text-text-secondary">{entry.oldValue}</span>
              </div>
            )}
            {entry.newValue && (
              <div className="flex gap-2">
                <span className="text-success font-medium">الجديد:</span>
                <span className="text-text-primary">{entry.newValue}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
