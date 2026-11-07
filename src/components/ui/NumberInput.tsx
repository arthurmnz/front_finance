import { forwardRef, type InputHTMLAttributes } from 'react'
import clsx from 'clsx'
import { Minus, Plus } from 'lucide-react'
import { inputCls } from './Input'

export interface NumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  showControls?: boolean
  onChange?: (e: React.ChangeEvent<HTMLInputElement> | { target: { value: string } }) => void
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, min, max, step = 1, value, onChange, showControls = false, disabled, ...p }, ref) => {
    const numericValue = typeof value === 'number' ? value : Number(value) || 0
    const numStep = Number(step) || 1

    const handleStep = (direction: 1 | -1) => {
      if (disabled) return
      let next = numericValue + direction * numStep
      if (min !== undefined && next < Number(min)) next = Number(min)
      if (max !== undefined && next > Number(max)) next = Number(max)
      onChange?.({ target: { value: String(next) } })
    }

    if (!showControls) {
      return (
        <input
          ref={ref}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange?.(e)}
          className={clsx(inputCls, 'tabular-nums', className)}
          {...p}
        />
      )
    }

    return (
      <div className="relative flex w-full items-center">
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || (min !== undefined && numericValue <= Number(min))}
          onClick={() => handleStep(-1)}
          className="absolute left-1.5 z-10 grid size-8 place-items-center rounded-lg text-text-muted transition hover:bg-surface-2 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
          aria-label="Diminuir"
        >
          <Minus className="size-3.5" />
        </button>
        <input
          ref={ref}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange?.(e)}
          className={clsx(inputCls, 'px-11 text-center tabular-nums', className)}
          {...p}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || (max !== undefined && numericValue >= Number(max))}
          onClick={() => handleStep(1)}
          className="absolute right-1.5 z-10 grid size-8 place-items-center rounded-lg text-text-muted transition hover:bg-surface-2 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
          aria-label="Aumentar"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    )
  },
)

NumberInput.displayName = 'NumberInput'
