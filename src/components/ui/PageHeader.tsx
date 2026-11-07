import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
  back?: ReactNode
}

export function PageHeader({ title, subtitle, action, back }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        {back}
        <h1 className="truncate text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mt-0.5 text-xs text-text-muted leading-relaxed">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}
