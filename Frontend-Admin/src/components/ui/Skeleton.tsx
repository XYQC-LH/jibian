'use client'

// NOTE: 此文件与 Frontend-User/src/components/ui/Skeleton.tsx 同步。
// 修改时请同步更新另一端的对应文件，保持实现一致。

// ---- Base primitive ----

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/10 ${className}`} />
}

// ---- Table skeleton ----

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="w-full animate-pulse">
      {/* Header */}
      <div className="flex gap-4 border-b border-white/10 pb-3">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-4 rounded bg-white/10" style={{ flex: i === 0 ? 2 : 1 }} />
        ))}
      </div>
      {/* Rows */}
      <div className="divide-y divide-white/5">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 py-4">
            {Array.from({ length: columns }).map((_, c) => (
              <div
                key={c}
                className="h-5 rounded bg-white/5"
                style={{ flex: c === 0 ? 2 : 1 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Card skeleton ----

export function CardSkeleton({ count = 3, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`grid gap-4 ${className}`} style={{ gridTemplateColumns: `repeat(auto-fill, minmax(280px, 1fr))` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white/10" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/5 rounded bg-white/10" />
              <div className="h-3 w-2/5 rounded bg-white/5" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-white/5" />
            <div className="h-3 w-4/5 rounded bg-white/5" />
            <div className="h-3 w-3/5 rounded bg-white/5" />
          </div>
          <div className="mt-4 flex gap-2">
            <div className="h-8 w-20 rounded-md bg-white/10" />
            <div className="h-8 w-20 rounded-md bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---- Detail page skeleton ----

export function DetailSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <div className="animate-pulse space-y-6">
      {/* Title area */}
      <div className="flex items-center gap-4">
        <div className="h-8 w-8 rounded-lg bg-white/10" />
        <div className="h-6 w-48 rounded bg-white/10" />
      </div>
      {/* Sections */}
      {Array.from({ length: sections }).map((_, i) => (
        <div key={i} className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 h-5 w-32 rounded bg-white/10" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="space-y-1">
                <div className="h-3 w-20 rounded bg-white/5" />
                <div className="h-9 w-full rounded-md bg-white/5" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---- Dashboard skeleton ----

export function DashboardSkeleton({ statCards = 4 }: { statCards?: number }) {
  return (
    <div className="animate-pulse space-y-6">
      {/* Stats cards row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(200px, 1fr))` }}>
        {Array.from({ length: statCards }).map((_, i) => (
          <div key={i} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-2 h-3 w-16 rounded bg-white/5" />
            <div className="mb-1 h-8 w-24 rounded bg-white/10" />
            <div className="h-3 w-20 rounded bg-white/5" />
          </div>
        ))}
      </div>
      {/* Chart area */}
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-4 h-5 w-28 rounded bg-white/10" />
        <div className="h-64 w-full rounded bg-white/5" />
      </div>
      {/* Bottom row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 h-5 w-24 rounded bg-white/10" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="h-4 w-4 rounded-full bg-white/5" />
                <div className="h-4 flex-1 rounded bg-white/5" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 h-5 w-24 rounded bg-white/10" />
          <div className="h-48 w-full rounded bg-white/5" />
        </div>
      </div>
    </div>
  )
}

// ---- StatsCard skeleton (single stat) ----

export function StatsCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg border border-white/10 bg-white/[0.03] p-4 ${className}`}>
      <div className="mb-2 h-3 w-16 rounded bg-white/5" />
      <div className="mb-1 h-8 w-24 rounded bg-white/10" />
      <div className="h-3 w-20 rounded bg-white/5" />
    </div>
  )
}

// ---- Monitor skeleton ----

export function MonitorSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Metric cards */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="h-4 w-20 rounded bg-white/5" />
              <div className="h-6 w-14 rounded-full bg-white/10" />
            </div>
            <div className="mb-1 h-7 w-28 rounded bg-white/10" />
            <div className="h-3 w-24 rounded bg-white/5" />
            <div className="mt-3 h-1 w-full rounded bg-white/5" />
          </div>
        ))}
      </div>
      {/* Chart */}
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-4 h-5 w-32 rounded bg-white/10" />
        <div className="h-72 w-full rounded bg-white/5" />
      </div>
    </div>
  )
}

// ---- Chart skeleton ----

export function ChartSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg border border-white/10 bg-white/[0.03] p-5 ${className}`}>
      <div className="mb-4 h-5 w-28 rounded bg-white/10" />
      <div className="h-64 w-full rounded bg-white/5" />
    </div>
  )
}

// ---- Inline skeleton for small areas ----

export function InlineSkeleton({ width = 'w-full', height = 'h-4' }: { width?: string; height?: string }) {
  return <div className={`animate-pulse rounded bg-white/5 ${width} ${height}`} />
}
