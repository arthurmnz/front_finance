import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  back?: ReactNode
}

export function PageHeader({ title, subtitle, action, back }: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        {back && <div className="mb-2 min-w-0">{back}</div>}
        <h1 className="break-words text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <div className="mt-1 min-w-0 break-words text-xs leading-relaxed text-text-muted sm:text-sm">
            {subtitle}
          </div>
        )}
      </div>
      {action && (
        <div className="flex max-w-full flex-wrap items-center gap-2 self-start sm:shrink-0 sm:justify-end sm:self-auto">
          {action}
        </div>
      )}
    </div>
  )
}
