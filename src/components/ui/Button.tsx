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
          'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none select-none cursor-pointer',
          size === 'md' ? 'h-11 min-h-11 px-4 text-sm' : 'h-9 min-h-9 px-3 text-xs',
          variant === 'primary' &&
            'bg-violet text-white hover:bg-violet-hover active:bg-violet-active shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_2px_8px_rgba(125,57,235,0.3)]',
          variant === 'lime' &&
            'bg-lime text-black hover:bg-lime-hover active:bg-lime-active font-semibold shadow-[0_2px_8px_rgba(198,255,51,0.25)]',
          variant === 'ghost' &&
            'text-text-muted hover:bg-surface-2 hover:text-white',
          variant === 'outline' &&
            'border border-border bg-surface-1 text-white card-highlight hover:bg-surface-2 hover:border-border-strong',
          variant === 'danger' &&
            'border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20 hover:border-danger/50 active:bg-danger/25 font-medium',
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
