import React from 'react';

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Đang tải dữ liệu">
    {/* 4 KPI Cards Skeleton */}
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="glass-panel rounded-2xl p-4 sm:p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="h-3.5 w-32 bg-slate-300/65 rounded" />
            <div className="h-10 w-10 bg-slate-300/65 rounded-xl" />
          </div>
          <div className="h-7 w-40 bg-slate-300/65 rounded" />
          <div className="h-3 w-28 bg-slate-200/75 rounded" />
        </div>
      ))}
    </div>

    {/* Monthly Status Skeleton */}
    <div className="glass-panel rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-5 w-72 max-w-full bg-slate-300/65 rounded" />
          <div className="h-3 w-96 max-w-full bg-slate-200/75 rounded" />
        </div>
        <div className="h-9 w-64 bg-slate-200/75 rounded-xl" />
      </div>
      <div className="h-2 w-full bg-slate-200/75 rounded-full" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass-tile h-32 rounded-xl p-3.5 space-y-2.5">
            <div className="flex justify-between">
              <div className="h-4 w-24 bg-slate-300/65 rounded" />
              <div className="h-4 w-16 bg-slate-300/65 rounded" />
            </div>
            <div className="h-3 w-36 bg-slate-200/75 rounded" />
            <div className="h-3 w-28 bg-slate-200/75 rounded" />
          </div>
        ))}
      </div>
    </div>

    {/* Charts Grid Skeleton */}
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
      <div className="xl:col-span-7 glass-panel rounded-2xl p-5 h-72 space-y-3">
        <div className="h-4 w-56 bg-slate-300/65 rounded" />
        <div className="h-52 w-full bg-slate-200/70 rounded-xl" />
      </div>
      <div className="xl:col-span-5 glass-panel rounded-2xl p-5 h-72 space-y-3">
        <div className="h-4 w-44 bg-slate-300/65 rounded" />
        <div className="h-52 w-full bg-slate-200/70 rounded-xl" />
      </div>
    </div>
  </div>
);
