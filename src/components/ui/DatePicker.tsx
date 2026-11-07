import { useEffect, useId, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate, toISODate } from '@/lib/format'

export interface DatePickerProps {
  value?: string
  onChange?: (e: { target: { value: string }; currentTarget: { value: string } }) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  required?: boolean
  name?: string
  id?: string
  min?: string
  max?: string
  'aria-label'?: string
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return toISODate(dt)
}

function shiftMonth(iso: string, months: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const dt = new Date(y, m - 1 + months, d)
  return toISODate(dt)
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Selecione a data…',
  disabled = false,
  className,
  required,
  name,
  id,
  min,
  max,
  'aria-label': ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dayButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const generatedId = useId()
  const datePickerId = id || generatedId

  const selectedIso = value ? value.slice(0, 10) : ''
  const todayIso = toISODate(new Date())

  // Estado do mês/ano atualmente visualizado no calendário
  const [viewDate, setViewDate] = useState(() => {
    if (value && value.length >= 10) {
      const [y, m, d] = value.slice(0, 10).split('-').map(Number)
      if (y && m && d) return new Date(y, m - 1, d)
    }
    return new Date()
  })

  // Data com foco ativo de navegação por teclado na grade
  const [focusedIso, setFocusedIso] = useState<string>(() => selectedIso || todayIso)

  // Sincroniza visualização quando o valor muda externamente
  useEffect(() => {
    if (value && value.length >= 10) {
      const [y, m, d] = value.slice(0, 10).split('-').map(Number)
      if (y && m && d) {
        setViewDate(new Date(y, m - 1, d))
        setFocusedIso(value.slice(0, 10))
      }
    }
  }, [value])

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Fecha com Escape
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth() // 0 a 11

  const monthName = viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const changeMonth = (offset: number) => {
    setViewDate(new Date(year, month + offset, 1))
  }

  // Gera os dias do calendário (incluindo preenchimento de início e fim)
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay() // 0 = Dom
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    const days: { iso: string; dayNumber: number; isCurrentMonth: boolean; disabled: boolean }[] = []

    // Dias do mês anterior
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i
      const prevDate = new Date(year, month - 1, dayNum)
      const iso = toISODate(prevDate)
      const isDisabled = Boolean((min && iso < min) || (max && iso > max))
      days.push({ iso, dayNumber: dayNum, isCurrentMonth: false, disabled: isDisabled })
    }

    // Dias do mês atual
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const curDate = new Date(year, month, i)
      const iso = toISODate(curDate)
      const isDisabled = Boolean((min && iso < min) || (max && iso > max))
      days.push({ iso, dayNumber: i, isCurrentMonth: true, disabled: isDisabled })
    }

    // Dias do próximo mês para fechar linhas de 7
    const remaining = (7 - (days.length % 7)) % 7
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i)
      const iso = toISODate(nextDate)
      const isDisabled = Boolean((min && iso < min) || (max && iso > max))
      days.push({ iso, dayNumber: i, isCurrentMonth: false, disabled: isDisabled })
    }

    return days
  }, [year, month, min, max])

  // Move o foco DOM para o botão correspondente à data ativa quando o popover abre ou a data muda
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      const btn = dayButtonRefs.current.get(focusedIso)
      if (btn) {
        btn.focus()
      } else {
        // Se o botão da data atual não estiver na tela, foca o primeiro dia do mês visível
        const firstCur = calendarDays.find((d) => d.isCurrentMonth)
        if (firstCur) {
          dayButtonRefs.current.get(firstCur.iso)?.focus()
        }
      }
    }, 40)
    return () => clearTimeout(timer)
  }, [open, focusedIso, calendarDays])

  const selectDate = (iso: string) => {
    if (disabled) return
    onChange?.({ target: { value: iso }, currentTarget: { value: iso } })
    setOpen(false)
    triggerRef.current?.focus()
  }

  // Navegação por teclado WAI-ARIA na grade de dias
  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    let nextIso: string | null = null

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        nextIso = shiftDate(focusedIso, -1)
        break
      case 'ArrowRight':
        e.preventDefault()
        nextIso = shiftDate(focusedIso, 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        nextIso = shiftDate(focusedIso, -7)
        break
      case 'ArrowDown':
        e.preventDefault()
        nextIso = shiftDate(focusedIso, 7)
        break
      case 'Home':
        e.preventDefault()
        nextIso = toISODate(new Date(year, month, 1))
        break
      case 'End':
        e.preventDefault()
        nextIso = toISODate(new Date(year, month + 1, 0))
        break
      case 'PageUp':
        e.preventDefault()
        nextIso = shiftMonth(focusedIso, -1)
        break
      case 'PageDown':
        e.preventDefault()
        nextIso = shiftMonth(focusedIso, 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (focusedIso) {
          selectDate(focusedIso)
        }
        return
      default:
        return
    }

    if (nextIso) {
      const [ny, nm] = nextIso.split('-').map(Number)
      if (ny !== year || nm !== month + 1) {
        setViewDate(new Date(ny, nm - 1, 1))
      }
      setFocusedIso(nextIso)
    }
  }

  return (
    <div ref={containerRef} className={clsx('relative w-full', className)}>
      {name && <input type="hidden" name={name} value={selectedIso} required={required} />}

      {/* Trigger button */}
      <button
        ref={triggerRef}
        id={datePickerId}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          if (!disabled) {
            setOpen((prev) => {
              const next = !prev
              if (next) {
                setFocusedIso(selectedIso || todayIso)
              }
              return next
            })
          }
        }}
        className={clsx(
          'flex h-11 w-full items-center justify-between gap-2 rounded-xl border px-3.5 text-left text-sm transition select-none cursor-pointer',
          'bg-surface-1 border-border text-white',
          'hover:border-border-strong',
          open && '!border-lime ring-1 ring-lime',
          disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
        )}
      >
        <span className={clsx('truncate tabular-nums', !selectedIso && 'text-text-dim')}>
          {selectedIso ? formatDate(selectedIso) : placeholder}
        </span>
        <CalendarIcon
          className={clsx('size-4 shrink-0 text-text-dim transition-colors', open && 'text-lime')}
        />
      </button>

      {/* Popover de calendário */}
      {open && (
        <div
          role="dialog"
          aria-label="Calendário"
          aria-modal="true"
          className={clsx(
            'absolute left-0 top-full z-50 mt-1.5 w-72 rounded-2xl border border-border bg-surface-1 shadow-2xl shadow-black/95 p-3.5 animate-in fade-in-0 zoom-in-95',
          )}
        >
          {/* Header do calendário */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="grid size-8 place-items-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-white transition"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-xs font-semibold capitalize text-white">{monthName}</span>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="grid size-8 place-items-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-white transition"
              aria-label="Próximo mês"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Dias da semana */}
          <div className="mb-1.5 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wider text-text-dim select-none">
            {WEEKDAYS.map((w) => (
              <span key={w} className="py-1">
                {w}
              </span>
            ))}
          </div>

          {/* Grid de dias com navegação por teclado */}
          <div
            role="grid"
            aria-label={monthName}
            tabIndex={-1}
            onKeyDown={handleGridKeyDown}
            className="grid grid-cols-7 gap-1 outline-none"
          >
            {calendarDays.map((d) => {
              const isSelected = d.iso === selectedIso
              const isToday = d.iso === todayIso
              const isFocused = d.iso === focusedIso

              return (
                <button
                  key={d.iso}
                  ref={(el) => {
                    if (el) dayButtonRefs.current.set(d.iso, el)
                    else dayButtonRefs.current.delete(d.iso)
                  }}
                  type="button"
                  role="gridcell"
                  tabIndex={isFocused ? 0 : -1}
                  aria-selected={isSelected}
                  disabled={d.disabled}
                  onClick={() => selectDate(d.iso)}
                  onFocus={() => setFocusedIso(d.iso)}
                  className={clsx(
                    'grid size-8 place-items-center rounded-xl text-xs font-medium transition cursor-pointer select-none tabular-nums outline-none',
                    isSelected && 'bg-lime text-black font-bold shadow-sm shadow-lime/30',
                    !isSelected && isToday && 'border border-lime/60 text-lime hover:bg-surface-2',
                    !isSelected && !isToday && d.isCurrentMonth && 'text-white hover:bg-surface-2',
                    !isSelected && !isToday && !d.isCurrentMonth && 'text-text-faint hover:bg-surface-2/60',
                    isFocused && !isSelected && 'ring-2 ring-lime ring-offset-2 ring-offset-black z-10',
                    d.disabled && 'opacity-20 cursor-not-allowed pointer-events-none',
                  )}
                >
                  {d.dayNumber}
                </button>
              )
            })}
          </div>

          {/* Atalho Hoje */}
          <div className="mt-3 flex justify-between border-t border-border pt-2.5">
            <button
              type="button"
              onClick={() => {
                const today = new Date()
                setViewDate(today)
                selectDate(toISODate(today))
              }}
              className="text-xs font-semibold text-lime hover:underline"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                triggerRef.current?.focus()
              }}
              className="text-xs text-text-dim hover:text-white"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
