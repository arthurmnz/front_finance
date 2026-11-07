import { forwardRef, type KeyboardEvent, type ReactNode } from 'react'
import clsx from 'clsx'
import { Check } from 'lucide-react'

export interface CheckboxProps {
  checked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
  children?: ReactNode
  id?: string
  name?: string
  'aria-label'?: string
}

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
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
          'inline-flex items-center gap-2.5 select-none cursor-pointer',
          disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
          className,
        )}
      >
        {name && <input type="hidden" name={name} value={checked ? 'true' : 'false'} />}
        <button
          ref={ref}
          id={id}
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          className={clsx(
            'grid size-5 shrink-0 place-items-center rounded-lg border transition duration-150 outline-none',
            checked
              ? 'bg-violet border-violet text-white shadow-sm shadow-violet/30'
              : 'border-border bg-surface-1 hover:border-border-strong text-transparent',
            'focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-black',
          )}
        >
          <Check className={clsx('size-3.5 stroke-[2.5] transition-transform duration-150', checked ? 'scale-100' : 'scale-0')} />
        </button>
        {children && <span className="text-sm text-text-muted transition hover:text-white">{children}</span>}
      </label>
    )
  },
)

Checkbox.displayName = 'Checkbox'
