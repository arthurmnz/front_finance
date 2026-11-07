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
        tone === 'neutral' && 'bg-surface-2 border-border text-text-muted',
        tone === 'info' && 'bg-violet-subtle border-violet/30 text-white',
        tone === 'success' && 'bg-lime-subtle border-lime/30 text-white',
        className,
      )}
    >
      <div className="mt-0.5 shrink-0">
        {icon || <Info className={clsx('size-4', tone === 'success' ? 'text-lime' : tone === 'info' ? 'text-violet-hover' : 'text-text-muted')} />}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}
