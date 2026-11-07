import { forwardRef, type ButtonHTMLAttributes } from 'react'
import clsx from 'clsx'
import { Loader2 } from 'lucide-react'

export type ButtonVariant = 'primary' | 'lime' | 'ghost' | 'outline' | 'danger'
export type ButtonSize = 'sm' | 'md'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, className, children, disabled, type = 'button', ...p }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={clsx(
          'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[.98] disabled:opacity-40 disabled:pointer-events-none select-none cursor-pointer',
          size === 'md' ? 'h-11 px-4 text-sm' : 'h-9 px-3 text-xs',
          variant === 'primary' && 'bg-violet text-white hover:bg-violet-hover active:bg-violet-active shadow-sm shadow-violet/20',
          variant === 'lime' && 'bg-lime text-black hover:bg-lime-hover active:bg-lime-active font-semibold shadow-sm shadow-lime/20',
          variant === 'ghost' && 'text-text-muted hover:bg-surface-2 hover:text-white',
          variant === 'outline' && 'border border-border bg-surface-1 text-white hover:bg-surface-2 hover:border-border-strong',
          variant === 'danger' && 'border border-white/10 bg-white/5 text-white/90 hover:bg-white/10 hover:border-white/20 hover:text-white',
          className,
        )}
        {...p}
      >
        {loading && <Loader2 className="size-4 animate-spin shrink-0" />}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
