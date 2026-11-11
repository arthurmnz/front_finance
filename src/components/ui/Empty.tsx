import type { ReactNode } from 'react'

export interface EmptyProps {
  icon?: ReactNode
  title: string
  children?: ReactNode
}

export function Empty({ icon, title, children }: EmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 px-4 text-center text-text-muted">
      {icon && (
        <div className="grid size-12 place-items-center rounded-2xl bg-surface-2 border border-border/80 text-text-dim mb-2 card-highlight shadow-sm">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-white">{title}</p>
      {children && <div className="mt-2 text-xs text-text-dim max-w-sm">{children}</div>}
    </div>
  )
}
