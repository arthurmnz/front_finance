import { forwardRef, type InputHTMLAttributes } from 'react'
import clsx from 'clsx'

export const inputCls =
  'w-full h-11 rounded-xl bg-surface border border-border-subtle px-3.5 text-sm text-ink-primary placeholder:text-ink-secondary/60 outline-none card-highlight transition-all duration-150 hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent caret-accent disabled:opacity-40 disabled:cursor-not-allowed'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...p }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={clsx(inputCls, className)}
        {...p}
      />
    )
  },
)

Input.displayName = 'Input'
