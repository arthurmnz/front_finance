import clsx from 'clsx'

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-xl bg-surface-2', className)} />
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border rounded-2xl border border-border bg-surface-1">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-3.5">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  )
}

export function CardGridSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-border bg-surface-1 p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-3.5 w-36" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="size-10" />
        </div>
      </div>
      <div className="space-y-3 rounded-2xl border border-border bg-surface-1 p-4">
        <div className="flex justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-36" />
          </div>
          <div className="space-y-2 text-right">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-28" />
          </div>
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <ListSkeleton rows={4} />
    </div>
  )
}

export function Spinner() {
  return <ListSkeleton rows={3} />
}
