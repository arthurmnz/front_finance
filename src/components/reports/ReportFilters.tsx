import { SlidersHorizontal, X, Settings2 } from 'lucide-react'
import clsx from 'clsx'
import type { Account, Category, CreditCard, GroupMember } from '@/lib/types'
import { formatMoney } from '@/lib/format'
import { Button, Card, Field, Select } from '@/components/ui'
import { MonthPicker } from '@/components/MonthPicker'
import type { ReportFiltersState } from './types'

interface ReportFiltersProps {
  filters: ReportFiltersState
  onChange: (f: ReportFiltersState) => void
  accounts: Account[]
  creditCards: CreditCard[]
  categories: Category[]
  threshold: number
  onConfigureThreshold: () => void
  showFilters: boolean
  onToggleShowFilters: () => void
  members?: GroupMember[]
}

const chip = (active: boolean) =>
  clsx(
    'rounded-xl border px-3 py-1.5 text-xs font-medium transition cursor-pointer select-none',
    active
      ? 'border-violet bg-violet text-white font-semibold shadow-sm shadow-violet/25'
      : 'border-border text-text-muted hover:bg-surface-2 hover:text-white',
  )

export default function ReportFilters({
  filters,
  onChange,
  accounts,
  creditCards,
  categories,
  threshold,
  onConfigureThreshold,
  showFilters,
  onToggleShowFilters,
  members,
}: ReportFiltersProps) {
  const set = <K extends keyof ReportFiltersState>(k: K, v: ReportFiltersState[K]) => {
    onChange({ ...filters, [k]: v })
  }

  const activeCount = [
    filters.accountId,
    filters.creditCardId,
    filters.hideCreditCards,
    filters.categoryId,
    filters.status,
    filters.responsibleId,
  ].filter(Boolean).length

  const handleClear = () => {
    onChange({
      ...filters,
      accountId: '',
      creditCardId: '',
      hideCreditCards: false,
      categoryId: '',
      status: '',
      responsibleId: '',
    })
  }

  return (
    <div className="space-y-3 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker
            value={filters.period}
            onChange={(period) => set('period', period)}
          />

          <Button
            variant="outline"
            size="sm"
            className="h-10"
            onClick={onToggleShowFilters}
          >
            <SlidersHorizontal className="size-4" /> Filtros
            {activeCount > 0 && (
              <span className="rounded-full bg-violet px-1.5 py-0.2 text-[10px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-10 text-xs"
            onClick={onConfigureThreshold}
          >
            <Settings2 className="size-4 text-violet" /> Alerta Caixa: {formatMoney(threshold)}
          </Button>
        </div>

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClear} className="text-xs text-text-dim hover:text-white">
            <X className="size-3.5" /> Limpar filtros
          </Button>
        )}
      </div>

      {showFilters && (
        <Card className="space-y-4 p-4 border-border bg-surface-1">
          <div>
            <p className="mb-2 text-xs font-medium text-text-dim">Situação das transações</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={chip(filters.status === '')}
                onClick={() => set('status', '')}
              >
                Todas
              </button>
              <button
                type="button"
                className={chip(filters.status === 'COMPLETED')}
                onClick={() => set('status', 'COMPLETED')}
              >
                Concluídas
              </button>
              <button
                type="button"
                className={chip(filters.status === 'PENDING')}
                onClick={() => set('status', 'PENDING')}
              >
                Pendentes
              </button>
              <button
                type="button"
                className={chip(filters.hideCreditCards)}
                onClick={() => set('hideCreditCards', !filters.hideCreditCards)}
              >
                Sem cartão de crédito
              </button>
            </div>
          </div>

          <div className={clsx('grid gap-3', members && members.length > 0 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3')}>
            {members && members.length > 0 && (
              <Field label="Membro / Responsável">
                <Select
                  value={filters.responsibleId || ''}
                  onChange={(e) => set('responsibleId', e.target.value)}
                >
                  <option value="">Todos os membros</option>
                  {members.map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.firstName} {m.user.lastName}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <Field label="Conta">
              <Select value={filters.accountId} onChange={(e) => set('accountId', e.target.value)}>
                <option value="">Todas as contas</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Cartão de crédito">
              <Select
                value={filters.creditCardId}
                onChange={(e) => set('creditCardId', e.target.value)}
              >
                <option value="">Todos os cartões</option>
                <option value="none">Ocultar cartão (apenas contas)</option>
                {creditCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Categoria">
              <Select value={filters.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                <option value="">Todas as categorias</option>
                <option value="none">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>
      )}
    </div>
  )
}
