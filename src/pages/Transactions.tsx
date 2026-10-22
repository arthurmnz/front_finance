import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/lib/api'
import { useAccounts, useCreditCards, useMyCategories } from '@/lib/hooks'
import type { Transaction, TransactionStatus, TransactionType } from '@/lib/types'
import { formatMoney, txTypeLabel } from '@/lib/format'
import { Button, Card, Empty, Field, Input, PageHeader, Select, Spinner } from '@/components/ui'
import { MonthPicker, currentPeriod } from '@/components/MonthPicker'
import TransactionList from '@/components/TransactionList'
import TransactionFormModal from '@/components/TransactionFormModal'

interface Filters { search: string; accountId: string; creditCardId: string; categoryId: string; type: '' | TransactionType; status: '' | TransactionStatus; recurring: boolean }
const EMPTY: Filters = { search: '', accountId: '', creditCardId: '', categoryId: '', type: '', status: '', recurring: false }

const chip = (active: boolean) => clsx('rounded-full border px-3 py-1.5 text-xs font-medium transition',
  active ? 'border-primary bg-primary/20 text-primary-hover' : 'border-border text-muted hover:text-text')

export default function Transactions() {
  const [period, setPeriod] = useState(currentPeriod())
  const [f, setF] = useState<Filters>(EMPTY)
  const [showFilters, setShowFilters] = useState(false)
  const [adding, setAdding] = useState(false)
  const accounts = useAccounts()
  const creditCards = useCreditCards().data ?? []
  const categories = useMyCategories().data ?? []
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((p) => ({ ...p, [k]: v }))

  const queries = useQueries({
    queries: (accounts.data ?? []).map((a) => ({
      queryKey: ['transactions', 'account', a.id, period.month, period.year],
      queryFn: () => api.get<Transaction[]>(`/transactions/account/${a.id}`, { params: period }).then((r) => r.data),
    })),
  })
  const loading = accounts.isLoading || queries.some((q) => q.isLoading)
  const all = useMemo(() => {
    const m = new Map<string, Transaction>()
    queries.forEach((q) => q.data?.forEach((t) => m.set(t.id, t)))
    return [...m.values()]
  }, [queries])

  const filtered = useMemo(() => {
    const term = f.search.trim().toLowerCase()
    return all.filter((t) =>
      (!term || t.title.toLowerCase().includes(term)) &&
      (!f.accountId || t.accountId === f.accountId || t.destinationAccountId === f.accountId) &&
      (!f.creditCardId || t.creditCardId === f.creditCardId) &&
      (!f.categoryId || (f.categoryId === 'none' ? !t.categoryId : t.categoryId === f.categoryId)) &&
      (!f.type || t.type === f.type) &&
      (!f.status || t.status === f.status) &&
      (!f.recurring || !!t.recurrenceGroupId))
  }, [all, f])

  const income = filtered.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0)
  const expense = filtered.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0)
  const activeCount = [f.accountId, f.creditCardId, f.categoryId, f.type, f.status, f.recurring].filter(Boolean).length
  const accountNames = useMemo(() => new Map((accounts.data ?? []).map((a) => [a.id, a.name])), [accounts.data])
  const cardNames = useMemo(() => new Map(creditCards.map((c) => [c.id, c.name])), [creditCards])

  return (
    <>
      <PageHeader title="Transações" action={<Button className="max-md:hidden" onClick={() => setAdding(true)}><Plus className="size-4" /> Nova</Button>} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <MonthPicker value={period} onChange={setPeriod} />
        <Button variant="outline" size="sm" className="h-10" onClick={() => setShowFilters((v) => !v)}>
          <SlidersHorizontal className="size-4" /> Filtros{activeCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] text-white">{activeCount}</span>}
        </Button>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input className="pl-9" placeholder="Buscar por título…" value={f.search} onChange={(e) => set('search', e.target.value)} />
      </div>

      {showFilters && (
        <Card className="mb-4 space-y-4 p-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Tipo</p>
            <div className="flex flex-wrap gap-2">
              <button className={chip(f.type === '')} onClick={() => set('type', '')}>Todos</button>
              {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((t) => <button key={t} className={chip(f.type === t)} onClick={() => set('type', t)}>{txTypeLabel[t]}</button>)}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Situação</p>
            <div className="flex flex-wrap gap-2">
              <button className={chip(f.status === '')} onClick={() => set('status', '')}>Todas</button>
              <button className={chip(f.status === 'PENDING')} onClick={() => set('status', 'PENDING')}>Pendentes</button>
              <button className={chip(f.status === 'COMPLETED')} onClick={() => set('status', 'COMPLETED')}>Concluídas</button>
              <button className={chip(f.recurring)} onClick={() => set('recurring', !f.recurring)}>Recorrentes</button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Conta">
              <Select value={f.accountId} onChange={(e) => set('accountId', e.target.value)}>
                <option value="">Todas as contas</option>
                {accounts.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <Field label="Cartão de crédito">
              <Select value={f.creditCardId} onChange={(e) => set('creditCardId', e.target.value)}>
                <option value="">Todos (contas e cartões)</option>
                {creditCards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Categoria">
              <Select value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                <option value="">Todas as categorias</option>
                <option value="none">Sem categoria</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          </div>
          {activeCount > 0 && <Button variant="ghost" size="sm" onClick={() => setF((p) => ({ ...EMPTY, search: p.search }))}><X className="size-4" /> Limpar filtros</Button>}
        </Card>
      )}

      <Card className="mb-4 grid grid-cols-3 divide-x divide-border text-center">
        <div className="p-3"><p className="text-xs text-muted">Receitas</p><p className="text-sm font-semibold text-income">{formatMoney(income)}</p></div>
        <div className="p-3"><p className="text-xs text-muted">Despesas</p><p className="text-sm font-semibold text-expense">{formatMoney(expense)}</p></div>
        <div className="p-3"><p className="text-xs text-muted">Resultado</p><p className={clsx('text-sm font-semibold', income - expense < 0 && 'text-expense')}>{formatMoney(income - expense)}</p></div>
      </Card>

      {loading ? <Spinner /> : !accounts.data?.length ? <Empty title="Crie uma conta para registrar transações." /> : !filtered.length ? (
        <Empty title={all.length ? 'Nenhuma transação com esses filtros.' : 'Nenhuma transação neste mês.'} />
      ) : (
        <TransactionList items={filtered} categories={categories} groupByDay accountNames={accountNames} cardNames={cardNames} accountId={f.accountId || undefined} />
      )}
      <TransactionFormModal open={adding} onClose={() => setAdding(false)} />
    </>
  )
}
