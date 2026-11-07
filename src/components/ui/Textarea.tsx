import { forwardRef, type TextareaHTMLAttributes } from 'react'
import clsx from 'clsx'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 3, ...p }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={clsx(
          'w-full rounded-xl bg-surface-1 border border-border px-3.5 py-2.5 text-sm text-white placeholder:text-text-dim outline-none transition focus:border-lime focus:ring-1 focus:ring-lime caret-lime disabled:opacity-40 disabled:cursor-not-allowed resize-none',
          className,
        )}
        {...p}
      />
    )
  },
)

Textarea.displayName = 'Textarea'
