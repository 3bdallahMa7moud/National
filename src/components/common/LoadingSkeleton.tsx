import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  lines?: number;
  className?: string;
  type?: 'text' | 'card' | 'table';
}

export default function LoadingSkeleton({ lines = 3, className, type = 'text' }: LoadingSkeletonProps) {
  if (type === 'card') {
    return (
      <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
            <div className="h-8 bg-gray-200 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className={cn('animate-pulse space-y-3', className)}>
        <div className="h-10 bg-gray-200 rounded w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('animate-pulse space-y-3', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-gray-200 rounded" style={{ width: `${80 - i * 15}%` }} />
      ))}
    </div>
  );
}
