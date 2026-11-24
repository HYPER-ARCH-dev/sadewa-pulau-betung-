import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div
      className={`skeleton-shimmer bg-slate-200/80 dark:bg-slate-800/80 rounded-md ${className}`}
      aria-hidden="true"
    />
  );
};

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="w-full space-y-4 p-4 sm:p-5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
      <div className="flex flex-wrap gap-3 mb-5">
        <Skeleton className="h-9 w-40 rounded-xl" />
        <Skeleton className="h-9 w-32 rounded-xl" />
        <Skeleton className="h-9 w-28 rounded-xl ml-auto" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex space-x-4 items-center border-b border-slate-100 dark:border-slate-800/80 pb-4 last:border-b-0 last:pb-0"
        >
          <Skeleton className="h-4 w-16 rounded-md shrink-0" />
          <Skeleton className="h-4 flex-1 rounded-md" />
          <Skeleton className="h-4 w-24 rounded-md hidden sm:block shrink-0" />
          <Skeleton className="h-8 w-20 rounded-xl shrink-0" />
        </div>
      ))}
    </div>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm shadow-sm">
      <div className="flex items-center space-x-3">
        <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-1/2 rounded-md" />
          <Skeleton className="h-4 w-3/4 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-3 w-full rounded-md" />
      <Skeleton className="h-3 w-2/3 rounded-md" />
      <div className="pt-2 flex justify-between items-center">
        <Skeleton className="h-6 w-20 rounded-lg" />
        <Skeleton className="h-6 w-16 rounded-lg" />
      </div>
    </div>
  );
};
