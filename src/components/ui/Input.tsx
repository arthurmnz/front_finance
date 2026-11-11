import { forwardRef, type InputHTMLAttributes } from 'react'
import clsx from 'clsx'

export const inputCls =
  'w-full h-11 rounded-xl bg-surface-1 border border-border px-3.5 text-sm text-white placeholder:text-text-dim outline-none card-highlight transition-all duration-150 hover:border-border-strong focus:border-lime focus:ring-1 focus:ring-lime caret-lime disabled:opacity-40 disabled:cursor-not-allowed'

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
