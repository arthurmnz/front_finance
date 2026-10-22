import { ChevronLeft, ChevronRight } from 'lucide-react'
import { monthLabel } from '@/lib/format'

export interface Period { month: number; year: number }
export const currentPeriod = (): Period => { const d = new Date(); return { month: d.getMonth() + 1, year: d.getFullYear() } }

export function MonthPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const shift = (n: number) => {
    const d = new Date(value.year, value.month - 1 + n, 1)
    onChange({ month: d.getMonth() + 1, year: d.getFullYear() })
  }
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface px-1">
      <button onClick={() => shift(-1)} className="rounded-lg p-2 text-muted hover:bg-surface-2" aria-label="Mês anterior"><ChevronLeft className="size-4" /></button>
      <span className="min-w-36 text-center text-sm font-medium capitalize">{monthLabel(value.month, value.year)}</span>
      <button onClick={() => shift(1)} className="rounded-lg p-2 text-muted hover:bg-surface-2" aria-label="Próximo mês"><ChevronRight className="size-4" /></button>
    </div>
  )
}
