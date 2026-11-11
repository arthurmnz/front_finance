import { forwardRef, useImperativeHandle, useRef, type InputHTMLAttributes } from 'react'
import clsx from 'clsx'
import { centsToInput, parseMoneyToCents } from '@/lib/format'
import { inputCls } from './Input'

export interface MoneyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number
  onChange: (cents: number) => void
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, className, ...p }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null)
    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const cents = parseMoneyToCents(e.target.value)
      onChange(cents)
      requestAnimationFrame(() => {
        if (inputRef.current) {
          const len = inputRef.current.value.length
          inputRef.current.setSelectionRange(len, len)
        }
      })
    }

    return (
      <div className="relative w-full">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-text-dim">
          R$
        </span>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          className={clsx(inputCls, 'pl-10 tabular-nums', className)}
          value={centsToInput(value)}
          onChange={handleChange}
          {...p}
        />
      </div>
    )
  },
)

MoneyInput.displayName = 'MoneyInput'
