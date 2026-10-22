import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { AlertTriangle, CreditCard as CardIcon, Settings2, TrendingDown, TrendingUp } from 'lucide-react'
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
  positive: 'bg-income/15 border-income/30',
  warning: 'bg-warn/15 border-warn/40',
  negative: 'bg-expense/20 border-expense/40',
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

    // Compras no cartão de crédito não afetam diretamente o saldo da conta na data da compra;
    // elas saem da conta vinculada no dia do vencimento da fatura (ou quando o usuário registra pagamento manual).
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

    // Faturas de cartão vinculadas às contas filtradas com saldo restante a pagar no mês
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
      <PageHeader title="Calendário" subtitle="Saldo projetado dia a dia, contando transações pendentes e faturas de cartão" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <MonthPicker
          value={period}
          onChange={(p) => {
            setPeriod(p)
            setSelected(undefined)
          }}
        />
        <Select className="!h-10 !w-auto" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Todas as contas</option>
          {visibleAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="h-10"
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
          onClick={() => {
            setTypes([])
            setAccountId('')
          }}
          className={clsx(
            'rounded-full border px-3 py-1.5 text-xs font-medium transition',
            !types.length ? 'border-primary bg-primary/20 text-primary-hover' : 'border-border text-muted hover:text-text',
          )}
        >
          Todos os tipos
        </button>
        {(Object.keys(accountTypeLabel) as AccountType[]).map((t) => (
          <button
            key={t}
            onClick={() => toggleType(t)}
            className={clsx(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition',
              types.includes(t) ? 'border-primary bg-primary/20 text-primary-hover' : 'border-border text-muted hover:text-text',
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
            <Card className="p-3">
              <p className="text-xs text-muted">Início do mês</p>
              <p className="text-sm font-semibold sm:text-base">{formatMoney(projection.opening)}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted">Fim do mês</p>
              <p
                className={clsx(
                  'flex items-center gap-1 text-sm font-semibold sm:text-base',
                  projection.closing < projection.opening ? 'text-expense' : 'text-income',
                )}
              >
                {projection.closing < projection.opening ? (
                  <TrendingDown className="size-4" />
                ) : (
                  <TrendingUp className="size-4" />
                )}
                {formatMoney(projection.closing)}
              </p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted">Menor saldo</p>
              <p className={clsx('text-sm font-semibold sm:text-base', projection.min.balance < 0 && 'text-expense')}>
                {formatMoney(projection.min.balance)}
              </p>
              <p className="text-[11px] text-muted">dia {projection.min.day}</p>
            </Card>
          </div>

          {projection.firstNegative && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-expense/40 bg-expense/10 p-3 text-sm text-expense">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                O saldo fica negativo a partir do dia {projection.firstNegative.day} (
                {formatMoney(projection.firstNegative.balance)}).
              </span>
            </div>
          )}

          <Card className="p-2 sm:p-3">
            <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-muted">
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
                  onClick={() => setSelected(d.date === selected ? undefined : d.date)}
                  className={clsx(
                    'flex min-h-16 flex-col items-center justify-between rounded-lg border p-1 text-center transition sm:min-h-20 sm:p-1.5',
                    levelCell[levelOf(d.balance, threshold)],
                    d.date === selected && '!border-primary ring-2 ring-primary/60',
                    d.date === today && 'outline outline-1 outline-primary',
                  )}
                >
                  <span className={clsx('text-xs font-medium', d.date === today ? 'text-primary-hover' : 'text-muted')}>
                    {d.day}
                  </span>
                  {d.delta !== 0 && (
                    <span className={clsx('text-[10px] leading-none', d.delta > 0 ? 'text-income' : 'text-expense')}>
                      {d.delta > 0 ? '+' : ''}
                      {formatCompact(d.delta)}
                    </span>
                  )}
                  <span
                    className={clsx(
                      'text-[11px] font-semibold leading-none sm:text-xs',
                      d.balance < 0 ? 'text-expense' : d.balance > 0 ? 'text-text' : 'text-muted',
                    )}
                  >
                    {formatCompact(d.balance)}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <i className="size-2.5 rounded-sm bg-income" /> Positivo (≥ {formatMoney(threshold)})
              </span>
              <span className="flex items-center gap-1.5">
                <i className="size-2.5 rounded-sm bg-warn" /> Atenção (abaixo de {formatMoney(threshold)})
              </span>
              <span className="flex items-center gap-1.5">
                <i className="size-2.5 rounded-sm bg-expense" /> Negativo
              </span>
            </div>
            <p className="mt-1 px-1 text-[11px] text-muted">
              Em cada dia: movimentação (incluindo vencimento de fatura de cartão) e saldo projetado ao final do dia.
            </p>
          </Card>

          {sel && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-semibold">Dia {sel.day}</h2>
                <span className="text-sm text-muted">
                  Saldo:{' '}
                  <b className={clsx(sel.balance < 0 ? 'text-expense' : 'text-text')}>{formatMoney(sel.balance)}</b>
                </span>
              </div>
              {sel.invoices.length > 0 && (
                <Card className="divide-y divide-border">
                  {sel.invoices.map((inv) => (
                    <Link
                      key={inv.cardId}
                      to={`/cartoes/${inv.cardId}`}
                      className="flex items-center gap-3 p-3 hover:bg-surface-2"
                    >
                      <div className="grid size-9 place-items-center rounded-full bg-primary/15 text-primary-hover">
                        <CardIcon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">Vencimento fatura {inv.cardName}</p>
                        <p className="text-xs text-muted">Saída prevista na conta vinculada</p>
                      </div>
                      <Badge tone="warn">Fatura</Badge>
                      <p className="text-sm font-semibold text-expense">−{formatMoney(inv.remainingAmount)}</p>
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
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            setThreshold(draft)
            setConfiguring(false)
          }}
        >
          <p className="text-sm text-muted">
            Dias com saldo projetado abaixo deste valor (e não negativo) ficam em{' '}
            <b className="text-warn">amarelo</b>. Saldo negativo fica em vermelho e o restante em verde.
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
