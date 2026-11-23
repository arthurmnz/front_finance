import { forwardRef, type TextareaHTMLAttributes } from 'react'
import clsx from 'clsx'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 3, ...p }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={clsx(
          'w-full rounded-xl bg-surface border border-border-subtle px-3.5 py-2.5 text-sm text-ink-primary placeholder:text-ink-secondary/60 outline-none card-highlight transition-all duration-150 hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent caret-accent disabled:opacity-40 disabled:cursor-not-allowed resize-none',
          className,
        )}
        {...p}
      />
    )
  },
)

Textarea.displayName = 'Textarea'
