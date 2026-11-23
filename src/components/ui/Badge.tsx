import type { ReactNode } from 'react'
import clsx from 'clsx'

export type BadgeTone = 'default' | 'income' | 'positive' | 'primary' | 'lime' | 'neutral' | 'expense' | 'danger'

export interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
  className?: string
}

export function Badge({ children, tone = 'default', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-mono font-medium tracking-wide select-none transition-colors',
        tone === 'default' && 'bg-surface-elevated text-ink-secondary border border-border-subtle',
        tone === 'neutral' && 'bg-white/10 text-ink-primary/90 border border-white/15',
        (tone === 'income' || tone === 'positive') && 'bg-income-subtle text-income border border-income/35 font-semibold shadow-[0_0_12px_rgba(52,211,153,0.14)]',
        (tone === 'expense' || tone === 'danger') && 'bg-expense-subtle text-expense border border-expense/35 font-semibold shadow-[0_0_12px_rgba(255,77,106,0.12)]',
        tone === 'primary' && 'bg-accent/15 text-accent-soft border border-accent/35 font-medium shadow-[0_0_12px_rgba(251,191,36,0.15)]',
        tone === 'lime' && 'bg-accent text-canvas font-bold shadow-sm shadow-accent/25',
        className,
      )}
    >
      {children}
    </span>
  )
}
