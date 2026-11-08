import type { ReactNode } from 'react'
import clsx from 'clsx'

export type BadgeTone = 'default' | 'income' | 'primary' | 'lime' | 'neutral' | 'expense' | 'danger'

export interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
  className?: string
}

export function Badge({ children, tone = 'default', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide select-none',
        tone === 'default' && 'bg-surface-2 text-text-muted border border-border',
        tone === 'neutral' && 'bg-white/10 text-white/90 border border-white/15',
        tone === 'income' && 'bg-lime-subtle text-lime border border-lime/25 font-semibold',
        (tone === 'expense' || tone === 'danger') && 'bg-expense-subtle text-expense border border-expense/30 font-semibold',
        tone === 'primary' && 'bg-violet-subtle text-violet-hover border border-violet/30 font-medium',
        tone === 'lime' && 'bg-lime text-black font-bold shadow-sm shadow-lime/20',
        className,
      )}
    >
      {children}
    </span>
  )
}
