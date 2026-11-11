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
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide select-none transition-colors',
        tone === 'default' && 'bg-surface-2 text-text-muted border border-border/80',
        tone === 'neutral' && 'bg-white/10 text-white/90 border border-white/15',
        tone === 'income' && 'bg-lime-subtle text-lime border border-lime/30 font-semibold shadow-[0_0_12px_rgba(198,255,51,0.12)]',
        (tone === 'expense' || tone === 'danger') && 'bg-expense-subtle text-expense border border-expense/35 font-semibold shadow-[0_0_12px_rgba(255,77,106,0.12)]',
        tone === 'primary' && 'bg-violet-subtle text-violet-hover border border-violet/35 font-medium shadow-[0_0_12px_rgba(125,57,235,0.15)]',
        tone === 'lime' && 'bg-lime text-black font-bold shadow-sm shadow-lime/25',
        className,
      )}
    >
      {children}
    </span>
  )
}
