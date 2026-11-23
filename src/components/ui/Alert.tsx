import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Info } from 'lucide-react'

export interface AlertProps {
  children: ReactNode
  tone?: 'info' | 'success' | 'neutral'
  icon?: ReactNode
  className?: string
}

export function Alert({ children, tone = 'neutral', icon, className }: AlertProps) {
  return (
    <div
      role="alert"
      className={clsx(
        'flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-relaxed',
        tone === 'neutral' && 'bg-surface-elevated border-border-subtle text-ink-secondary',
        tone === 'info' && 'bg-accent/15 border-accent/30 text-ink-primary',
        tone === 'success' && 'bg-accent/15 border-accent/30 text-ink-primary',
        className,
      )}
    >
      <div className="mt-0.5 shrink-0">
        {icon || <Info className={clsx('size-4', tone === 'success' ? 'text-accent' : tone === 'info' ? 'text-accent-soft' : 'text-ink-secondary')} />}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}
