import { forwardRef, type KeyboardEvent, type ReactNode } from 'react'
import clsx from 'clsx'

export interface SwitchProps {
  checked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
  children?: ReactNode
  id?: string
  name?: string
  'aria-label'?: string
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      checked = false,
      onChange,
      disabled = false,
      className,
      children,
      id,
      name,
      'aria-label': ariaLabel,
    },
    ref,
  ) => {
    const handleToggle = () => {
      if (!disabled) {
        onChange?.(!checked)
      }
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
      if ([' ', 'Enter'].includes(e.key)) {
        e.preventDefault()
        handleToggle()
      }
    }

    return (
      <label
        className={clsx(
          'inline-flex items-center gap-3 select-none cursor-pointer',
          disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
          className,
        )}
      >
        {name && <input type="hidden" name={name} value={checked ? 'true' : 'false'} />}
        <button
          ref={ref}
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          className={clsx(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out outline-none',
            checked ? 'bg-violet' : 'bg-surface-2 border-border',
            'focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-black',
          )}
        >
          <span
            className={clsx(
              'pointer-events-none inline-block size-5 transform rounded-full shadow-lg ring-0 transition duration-200 ease-in-out',
              checked ? 'translate-x-5 bg-lime' : 'translate-x-0 bg-white/70',
            )}
          />
        </button>
        {children && <span className="text-sm text-text-muted">{children}</span>}
      </label>
    )
  },
)

Switch.displayName = 'Switch'
