import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
  back?: ReactNode
}

export function PageHeader({ title, subtitle, action, back }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        {back && <div className="mb-2">{back}</div>}
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-xs sm:text-sm text-text-muted leading-relaxed">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">{action}</div>}
    </div>
  )
}
