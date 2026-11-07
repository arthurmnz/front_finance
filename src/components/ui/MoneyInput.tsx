import { forwardRef, type InputHTMLAttributes } from 'react'
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
    return (
      <div className="relative w-full">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-text-dim">
          R$
        </span>
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          className={clsx(inputCls, 'pl-10 tabular-nums', className)}
          value={centsToInput(value)}
          onChange={(e) => onChange(parseMoneyToCents(e.target.value))}
          {...p}
        />
      </div>
    )
  },
)

MoneyInput.displayName = 'MoneyInput'
