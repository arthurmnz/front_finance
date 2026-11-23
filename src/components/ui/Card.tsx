import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import clsx from 'clsx'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode
  className?: string
}

export const Card = forwardRef<HTMLDivElement, CardProps>(({ className, children, ...p }, ref) => {
  return (
    <div
      ref={ref}
      className={clsx('rounded-2xl bg-surface border border-border-subtle text-ink-primary card-highlight transition-colors duration-150', className)}
      {...p}
    >
      {children}
    </div>
  )
})

Card.displayName = 'Card'
