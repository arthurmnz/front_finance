import type { ReactNode } from 'react'

export interface EmptyProps {
  icon?: ReactNode
  title: string
  children?: ReactNode
}

export function Empty({ icon, title, children }: EmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-text-muted">
      {icon && <div className="text-text-dim mb-1">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="mt-2">{children}</div>}
    </div>
  )
}
