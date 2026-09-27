import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => {
  return <div className={`animate-pulse bg-slate-200/80 rounded-md ${className}`} />;
};

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 6,
}) => {
  return (
    <div className="w-full divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="flex items-center gap-4 py-3 px-4">
          {Array.from({ length: columns }).map((_, cIdx) => (
            <div key={cIdx} className="flex-1">
              <Skeleton className={`h-3.5 ${cIdx === 0 ? 'w-20' : 'w-full'}`} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export const MetricsSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="bg-white p-3.5 rounded-xl border border-slate-200/80 space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-12" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      ))}
    </div>
  );
};
