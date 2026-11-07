import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type InputHTMLAttributes,
  type MouseEvent,
} from 'react'
import clsx from 'clsx'
import { Eye, EyeOff } from 'lucide-react'
import { inputCls } from './Input'

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  className?: string
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, disabled, ...props }, ref) => {
    const [visible, setVisible] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

    const handleToggle = (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      if (disabled) return

      const input = inputRef.current
      const start = input?.selectionStart ?? null
      const end = input?.selectionEnd ?? null

      setVisible((prev) => !prev)

      requestAnimationFrame(() => {
        if (input) {
          input.focus()
          if (start !== null && end !== null && typeof input.setSelectionRange === 'function') {
            try {
              input.setSelectionRange(start, end)
            } catch {
              // noop
            }
          }
        }
      })
    }

    return (
      <div className="relative w-full">
        <input
          ref={inputRef}
          type={visible ? 'text' : 'password'}
          disabled={disabled}
          className={clsx(inputCls, 'pr-11', className)}
          {...props}
        />
        <button
          type="button"
          tabIndex={0}
          disabled={disabled}
          onClick={handleToggle}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
          className={clsx(
            'absolute right-1.5 top-1/2 -translate-y-1/2 grid size-8 place-items-center rounded-lg text-text-dim transition select-none cursor-pointer',
            'hover:bg-surface-2 hover:text-white',
            visible && 'text-lime hover:text-lime-hover',
            'focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-1 focus-visible:ring-offset-black outline-none',
            disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
          )}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    )
  },
)

PasswordInput.displayName = 'PasswordInput'
