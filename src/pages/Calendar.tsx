import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { AlertCircle, CreditCard as CardIcon, Settings2, TrendingDown, TrendingUp } from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/lib/api'
import { useAccounts, useCreditCards, useMyCategories } from '@/lib/hooks'
import { useAuth } from '@/lib/auth'
import type { AccountType, CreditCardInvoice, Transaction } from '@/lib/types'
import { accountTypeLabel, formatCompact, formatMoney, toISODate } from '@/lib/format'
import { Badge, Button, Card, Empty, Field, Modal, MoneyInput, PageHeader, Select, Spinner } from '@/components/ui'
import { MonthPicker, currentPeriod } from '@/components/MonthPicker'
import TransactionList from '@/components/TransactionList'

const DEFAULT_WARNING = 10000 // R$ 100,00 em centavos

function useWarningThreshold(userId?: string) {
  const key = `finance:calendar-warning:${userId ?? 'anon'}`
  const [value, setValue] = useState(() => {
    const raw = localStorage.getItem(key)
    return raw !== null && !Number.isNaN(Number(raw)) ? Number(raw) : DEFAULT_WARNING
  })
  const save = (v: number) => {
    localStorage.setItem(key, String(v))
    setValue(v)
  }
  return [value, save] as const
}

type Level = 'positive' | 'warning' | 'negative'
const levelOf = (balance: number, threshold: number): Level =>
  balance < 0 ? 'negative' : balance < threshold ? 'warning' : 'positive'

const levelCell: Record<Level, string> = {
  positive: 'bg-lime-subtle border-lime/25 text-lime',
  warning: 'bg-violet-subtle border-violet/30 text-white',
  negative: 'bg-surface-2 border-white/20 text-white',
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function Calendar() {
  const [period, setPeriod] = useState(currentPeriod())
  const [accountId, setAccountId] = useState('')
  const [selected, setSelected] = useState<string>()
  const [types, setTypes] = useState<AccountType[]>([])
  const { user } = useAuth()
  const [threshold, setThreshold] = useWarningThreshold(user?.id)
  const [configuring, setConfiguring] = useState(false)
  const [draft, setDraft] = useState(0)
  const accounts = useAccounts()
  const creditCards = useCreditCards()
  const categories = useMyCategories().data ?? []

  const queries = useQueries({
    queries: (accounts.data ?? []).map((a) => ({
      queryKey: ['transactions', 'account', a.id, 'all'],
      queryFn: () => api.get<Transaction[]>(`/transactions/account/${a.id}`).then((r) => r.data),
    })),
  })

  // Busca a fatura do mês selecionado de cada cartão de crédito para projetar a saída no dia do vencimento
  const invoiceQueries = useQueries({
    queries: (creditCards.data ?? []).map((c) => ({
      queryKey: ['credit-cards', c.id, 'invoice', period.month, period.year],
      queryFn: () =>
        api
          .get<CreditCardInvoice>(`/credit-cards/${c.id}/invoice`, { params: period })
          .then((r) => r.data),
    })),
  })

  const loading =
    accounts.isLoading || creditCards.isLoading || queries.some((q) => q.isLoading) || invoiceQueries.some((q) => q.isLoading)

  const projection = useMemo(() => {
    const accs = (accounts.data ?? []).filter(
      (a) => (!types.length || types.includes(a.type)) && (!accountId || a.id === accountId),
    )
    const ids = new Set(accs.map((a) => a.id))
    const all = new Map<string, Transaction>()
    queries.forEach((q) => q.data?.forEach((t) => all.set(t.id, t)))

    const effect = (t: Transaction) => {
      if (t.creditCardId) return 0
      let v = 0
      if (t.type === 'INCOME' && ids.has(t.accountId)) v += t.amount
      if (t.type === 'EXPENSE' && ids.has(t.accountId)) v -= t.amount
      if (t.type === 'TRANSFER') {
        if (ids.has(t.accountId)) v -= t.amount
        if (t.destinationAccountId && ids.has(t.destinationAccountId)) v += t.amount
      }
      return v
    }

    const first = toISODate(new Date(period.year, period.month - 1, 1))
    const daysInMonth = new Date(period.year, period.month, 0).getDate()
    const relevant = [...all.values()].filter((t) => effect(t) !== 0)

    let running =
      accs.reduce((s, a) => s + a.startBalance, 0) +
      relevant.filter((t) => t.date.slice(0, 10) < first).reduce((s, t) => s + effect(t), 0)
    const opening = running

    const byDay = new Map<string, Transaction[]>()
    relevant.forEach((t) => {
      const k = t.date.slice(0, 10)
      if (k >= first) byDay.set(k, [...(byDay.get(k) ?? []), t])
    })

    const invoicesByDay = new Map<string, { cardId: string; cardName: string; remainingAmount: number }[]>()
    const cardList = creditCards.data ?? []
    invoiceQueries.forEach((iq, idx) => {
      const inv = iq.data
      const card = cardList[idx]
      if (!inv || !card) return
      if (!ids.has(card.accountId)) return
      if ((inv.remainingAmount ?? 0) <= 0 || !inv.dueDate) return
      const dueIso = inv.dueDate.slice(0, 10)
      invoicesByDay.set(dueIso, [
        ...(invoicesByDay.get(dueIso) ?? []),
        { cardId: card.id, cardName: card.name, remainingAmount: inv.remainingAmount },
      ])
    })

    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const date = toISODate(new Date(period.year, period.month - 1, i + 1))
      const txs = byDay.get(date) ?? []
      const invoices = invoicesByDay.get(date) ?? []
      const invoiceDelta = invoices.reduce((s, inv) => s - inv.remainingAmount, 0)
      const delta = txs.reduce((s, t) => s + effect(t), 0) + invoiceDelta
      running += delta
      return { day: i + 1, date, txs, invoices, delta, balance: running }
    })
    const min = days.reduce((m, d) => (d.balance < m.balance ? d : m), days[0])
    const firstNegative = days.find((d) => d.balance < 0)
    return { days, opening, closing: running, min, firstNegative, allTxs: relevant }
  }, [accounts.data, queries, invoiceQueries, accountId, types, period])

  const toggleType = (t: AccountType) => {
    setTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))
    setAccountId('')
  }
  const visibleAccounts = (accounts.data ?? []).filter((a) => !types.length || types.includes(a.type))
  const offset = new Date(period.year, period.month - 1, 1).getDay()
  const today = toISODate(new Date())
  const sel = projection.days.find((d) => d.date === selected)
  const accountNames = useMemo(() => new Map((accounts.data ?? []).map((a) => [a.id, a.name])), [accounts.data])

  return (
    <>
      <PageHeader
        title="Calendário"
        subtitle="Saldo projetado dia a dia, contando transações pendentes e faturas de cartão"
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <MonthPicker
          value={period}
          onChange={(p) => {
            setPeriod(p)
            setSelected(undefined)
          }}
        />
        <div className="w-48">
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Todas as contas</option>
            {visibleAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-11"
          onClick={() => {
            setDraft(threshold)
            setConfiguring(true)
          }}
        >
          <Settings2 className="size-4" /> Alerta: {formatMoney(threshold)}
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setTypes([])
            setAccountId('')
          }}
          className={clsx(
            'rounded-xl border px-3 py-1.5 text-xs font-medium transition cursor-pointer select-none',
            !types.length
              ? 'border-violet bg-violet text-white font-semibold shadow-sm shadow-violet/25'
              : 'border-border text-text-muted hover:bg-surface-2 hover:text-white',
          )}
        >
          Todos os tipos
        </button>
        {(Object.keys(accountTypeLabel) as AccountType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => toggleType(t)}
            className={clsx(
              'rounded-xl border px-3 py-1.5 text-xs font-medium transition cursor-pointer select-none',
              types.includes(t)
                ? 'border-violet bg-violet text-white font-semibold shadow-sm shadow-violet/25'
                : 'border-border text-text-muted hover:bg-surface-2 hover:text-white',
            )}
          >
            {accountTypeLabel[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : !accounts.data?.length ? (
        <Empty title="Crie uma conta para ver a projeção." />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <Card className="p-3.5">
              <p className="text-xs text-text-dim">Início do mês</p>
              <p className="text-sm font-semibold sm:text-base text-white tabular-nums">{formatMoney(projection.opening)}</p>
            </Card>
            <Card className="p-3.5">
              <p className="text-xs text-text-dim">Fim do mês</p>
              <p
                className={clsx(
                  'flex items-center gap-1 text-sm font-semibold sm:text-base tabular-nums',
                  projection.closing >= projection.opening ? 'text-lime' : 'text-white',
                )}
              >
                {projection.closing < projection.opening ? (
                  <TrendingDown className="size-4 shrink-0 text-white" />
                ) : (
                  <TrendingUp className="size-4 shrink-0 text-lime" />
                )}
                {formatMoney(projection.closing)}
              </p>
            </Card>
            <Card className="p-3.5">
              <p className="text-xs text-text-dim">Menor saldo</p>
              <p className="text-sm font-semibold sm:text-base text-white tabular-nums">
                {formatMoney(projection.min.balance)}
              </p>
              <p className="text-[11px] text-text-dim">dia {projection.min.day}</p>
            </Card>
          </div>

          {projection.firstNegative && (
            <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-white/15 bg-surface-2 p-3.5 text-xs text-white">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-lime" />
              <span>
                O saldo fica negativo a partir do dia {projection.firstNegative.day} (
                {formatMoney(projection.firstNegative.balance)}).
              </span>
            </div>
          )}

          <Card className="p-3 sm:p-4">
            <div className="mb-2 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wider text-text-dim">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: offset }, (_, i) => (
                <div key={`e${i}`} />
              ))}
              {projection.days.map((d) => (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => setSelected(d.date === selected ? undefined : d.date)}
                  className={clsx(
                    'flex min-h-16 flex-col items-center justify-between rounded-xl border p-1 text-center transition cursor-pointer select-none sm:min-h-20 sm:p-1.5',
                    levelCell[levelOf(d.balance, threshold)],
                    d.date === selected && '!border-lime ring-2 ring-lime/60',
                    d.date === today && 'outline outline-1 outline-lime',
                  )}
                >
                  <span className={clsx('text-xs font-medium', d.date === today ? 'text-lime font-bold' : 'text-text-muted')}>
                    {d.day}
                  </span>
                  {d.delta !== 0 && (
                    <span className={clsx('text-[10px] leading-none tabular-nums font-medium', d.delta > 0 ? 'text-lime' : 'text-white')}>
                      {d.delta > 0 ? '+' : '−'}
                      {formatCompact(Math.abs(d.delta))}
                    </span>
                  )}
                  <span className="text-[11px] font-semibold leading-none sm:text-xs tabular-nums text-white">
                    {formatCompact(d.balance)}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-border pt-3 px-1 text-xs text-text-dim">
              <span className="flex items-center gap-1.5">
                <i className="size-2 rounded-full bg-lime shrink-0" /> Positivo (≥ {formatMoney(threshold)})
              </span>
              <span className="flex items-center gap-1.5">
                <i className="size-2 rounded-full bg-violet shrink-0" /> Atenção (abaixo de {formatMoney(threshold)})
              </span>
              <span className="flex items-center gap-1.5">
                <i className="size-2 rounded-full bg-white shrink-0" /> Negativo
              </span>
            </div>
            <p className="mt-1 px-1 text-[11px] text-text-dim">
              Em cada dia: movimentação (incluindo vencimento de fatura de cartão) e saldo projetado ao final do dia.
            </p>
          </Card>

          {sel && (
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-semibold text-white">Dia {sel.day}</h2>
                <span className="text-xs text-text-muted">
                  Saldo ao final do dia:{' '}
                  <b className="text-white tabular-nums">{formatMoney(sel.balance)}</b>
                </span>
              </div>
              {sel.invoices.length > 0 && (
                <Card className="divide-y divide-border">
                  {sel.invoices.map((inv) => (
                    <Link
                      key={inv.cardId}
                      to={`/cartoes/${inv.cardId}`}
                      className="flex items-center gap-3 p-3 hover:bg-surface-2 transition"
                    >
                      <div className="grid size-9 place-items-center rounded-xl bg-violet/15 text-violet-hover">
                        <CardIcon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">Vencimento fatura {inv.cardName}</p>
                        <p className="text-xs text-text-dim">Saída prevista na conta vinculada</p>
                      </div>
                      <Badge tone="primary">Fatura</Badge>
                      <p className="text-sm font-semibold text-white tabular-nums">−{formatMoney(inv.remainingAmount)}</p>
                    </Link>
                  ))}
                </Card>
              )}
              {sel.txs.length ? (
                <TransactionList
                  items={sel.txs}
                  categories={categories}
                  accountNames={accountNames}
                  accountId={accountId || undefined}
                />
              ) : (
                !sel.invoices.length && <Empty title="Sem movimentações neste dia." />
              )}
            </div>
          )}
        </>
      )}

      <Modal open={configuring} onClose={() => setConfiguring(false)} title="Valor de atenção">
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            setThreshold(draft)
            setConfiguring(false)
          }}
        >
          <p className="text-xs text-text-muted leading-relaxed">
            Dias com saldo projetado abaixo deste valor (e não negativo) recebem destaque de atenção em violeta. Saldo
            negativo é destacado em branco e os demais em lime.
          </p>
          <Field label="Valor de atenção">
            <MoneyInput value={draft} onChange={setDraft} />
          </Field>
          <Button type="submit" className="w-full">
            Salvar
          </Button>
        </form>
      </Modal>
    </>
  )
}
