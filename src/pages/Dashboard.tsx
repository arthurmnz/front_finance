import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import clsx from 'clsx'
import { ArrowDownCircle, ArrowUpCircle, ChevronRight, Eye, EyeOff, Plus, Users } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { api } from '@/lib/api'
import { useAccounts, useAction, useAllCategories, useCreditCards, useResponsibleTransactions, useTotalBalance, useUserDebtsSummary } from '@/lib/hooks'
import { useAuth } from '@/lib/auth'
import type { Account, CreditCardInvoice, Transaction } from '@/lib/types'
import { formatDate, formatMoney } from '@/lib/format'
import { normalizeCategoryColor } from '@/lib/palette'
import { Badge, Button, Card, Empty, PageHeader, Spinner } from '@/components/ui'
import { MonthPicker, currentPeriod } from '@/components/MonthPicker'
import TransactionFormModal from '@/components/TransactionFormModal'
import AccountFormModal from '@/components/AccountFormModal'
import CreditCardFormModal from '@/components/CreditCardFormModal'

export default function Dashboard() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [period, setPeriod] = useState(currentPeriod())
  const [adding, setAdding] = useState(false)
  const [addingAccount, setAddingAccount] = useState(false)
  const [addingCard, setAddingCard] = useState(false)
  const creditCards = useCreditCards()
  const accounts = useAccounts()
  const cats = useAllCategories().data
  const balance = useTotalBalance(period.month, period.year, [])
  const responsibleTxs = useResponsibleTransactions(period.month, period.year)
  const debtsSummary = useUserDebtsSummary(period.month, period.year)

  const toggleIncludeInTotal = useAction(
    (a: Account) =>
      api.put('/accounts/' + a.id, {
        name: a.name,
        startBalance: a.startBalance,
        type: a.type,
        tax: a.tax,
        includeInTotal: !a.includeInTotal,
      }),
    {
      invalidate: [['accounts'], ['total-balance']],
      success: 'Configuração da conta atualizada',
    },
  )

  const txQueries = useQueries({
    queries: (accounts.data ?? []).map((a) => ({
      queryKey: ['transactions', 'account', a.id, period.month, period.year],
      queryFn: () => api.get<Transaction[]>(`/transactions/account/${a.id}`, { params: period }).then((r) => r.data),
    })),
  })
  const invoiceQueries = useQueries({
    queries: (creditCards.data ?? []).map((c) => ({
      queryKey: ['credit-cards', c.id, 'invoice', period.month, period.year],
      queryFn: () =>
        api
          .get<CreditCardInvoice>(`/credit-cards/${c.id}/invoice`, { params: period })
          .then((r) => r.data),
    })),
  })
  const txLoading = txQueries.some((q) => q.isLoading)
  const txStamp = txQueries.map((q) => q.dataUpdatedAt).join(',')
  const invStamp = invoiceQueries.map((q) => q.dataUpdatedAt).join(',')
  const allTx = useMemo(() => {
    const seen = new Map<string, Transaction>()
    txQueries.forEach((q) => q.data?.forEach((t) => seen.set(t.id, t)))
    return [...seen.values()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txStamp])

  const summary = useMemo(() => {
    const activeAccounts = (accounts.data ?? []).filter((a) => a.includeInTotal !== false)
    const activeIds = new Set(activeAccounts.map((a) => a.id))
    const currentBalance = balance.data?.total ?? activeAccounts.reduce((s, a) => s + a.balance, 0)

    let realizedIncome = 0
    let pendingIncome = 0
    let realizedExpense = 0
    let pendingExpense = 0
    let pendingTransferDelta = 0

    allTx.forEach((t) => {
      if (t.creditCardId) return
      if (t.type === 'INCOME' && activeIds.has(t.accountId)) {
        if (t.status === 'COMPLETED') realizedIncome += t.amount
        else pendingIncome += t.amount
      } else if (t.type === 'EXPENSE' && activeIds.has(t.accountId)) {
        if (t.status === 'COMPLETED') realizedExpense += t.amount
        else pendingExpense += t.amount
      } else if (t.type === 'TRANSFER' && t.status === 'PENDING') {
        if (activeIds.has(t.accountId)) pendingTransferDelta -= t.amount
        if (t.destinationAccountId && activeIds.has(t.destinationAccountId)) pendingTransferDelta += t.amount
      }
    })

    let unpaidCardInvoices = 0
    const cardList = creditCards.data ?? []
    invoiceQueries.forEach((iq, idx) => {
      const inv = iq.data
      const card = cardList[idx]
      if (!inv || !card) return
      if (!activeIds.has(card.accountId)) return
      unpaidCardInvoices += Math.max(0, inv.remainingAmount ?? 0)
    })

    const projectedIncome = realizedIncome + pendingIncome
    const projectedExpense = realizedExpense + pendingExpense + unpaidCardInvoices
    const projectedBalance = currentBalance + pendingIncome - pendingExpense - unpaidCardInvoices + pendingTransferDelta

    return {
      currentBalance,
      projectedBalance,
      realizedIncome,
      projectedIncome,
      realizedExpense,
      projectedExpense,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.data, balance.data, allTx, invStamp])

  const combinedExpenses = useMemo(() => {
    const map = new Map<string, Transaction>()
    allTx.filter((t) => t.type === 'EXPENSE').forEach((t) => map.set(t.id, t))
    ;(responsibleTxs.data ?? [])
      .filter((t) => t.type === 'EXPENSE' && t.responsibleId === user?.id)
      .forEach((t) => {
        if (!map.has(t.id)) map.set(t.id, t)
      })
    return [...map.values()]
  }, [allTx, responsibleTxs.data, user?.id])

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    combinedExpenses.forEach((t) => {
      const k = t.categoryId ?? 'none'
      map.set(k, (map.get(k) ?? 0) + t.amount)
    })
    return [...map.entries()]
      .map(([id, value], i) => {
        const c = cats?.find((cat) => cat.id === id)
        const col = normalizeCategoryColor(c?.color, i)
        return { name: c?.name ?? 'Sem categoria', value, color: col }
      })
    .sort((a, b) => b.value - a.value)
  }, [combinedExpenses, cats])

  const upcoming = allTx
    .filter((t) => t.status === 'PENDING')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)

  return (
    <>
      <PageHeader
        title={`Olá, ${user?.firstName ?? ''}`}
        subtitle="Resumo consolidado do seu fluxo financeiro"
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Nova
          </Button>
        }
      />
      <div className="mb-4">
        <MonthPicker value={period} onChange={setPeriod} />
      </div>

      {/* Hero card de saldos */}
      <Card className="mb-5 p-5 bg-surface-1 border border-border card-highlight shadow-md">
        <div className="grid grid-cols-2 gap-4 border-b border-border/60 pb-5">
          <div>
            <p className="text-xs font-medium text-text-muted">Saldo total</p>
            <p
              className={clsx(
                'mt-1 text-2xl font-bold sm:text-3xl tracking-tight tabular-nums',
                summary.currentBalance < 0 ? 'text-expense' : 'text-white',
              )}
            >
              {balance.data ? formatMoney(summary.currentBalance) : '—'}
            </p>
          </div>
          <div className="border-l border-border/60 pl-4 sm:pl-6">
            <p className="text-xs font-medium text-text-muted">Saldo projetado</p>
            <p
              className={clsx(
                'mt-1 text-2xl font-bold sm:text-3xl tracking-tight tabular-nums',
                summary.projectedBalance < 0 ? 'text-expense' : 'text-lime',
              )}
            >
              {balance.data ? formatMoney(summary.projectedBalance) : '—'}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 rounded-xl bg-surface-2/40 border border-border/70 p-3 card-highlight">
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 place-items-center rounded-xl bg-lime-subtle border border-lime/30 text-lime shrink-0">
                <ArrowUpCircle className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-text-muted font-medium">Receitas realizadas</p>
                <p className="truncate font-semibold text-lime tabular-nums text-sm sm:text-base">
                  {formatMoney(summary.realizedIncome)}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface-2/80 px-2.5 py-1.5 text-xs">
              <span className="text-[11px] text-text-dim">Projeção total:</span>
              <span className="font-semibold text-lime tabular-nums">
                {formatMoney(summary.projectedIncome)}
              </span>
            </div>
          </div>

          <div className="space-y-2 rounded-xl bg-surface-2/40 border border-border/70 p-3 card-highlight">
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 place-items-center rounded-xl bg-expense-subtle border border-expense/30 text-expense shrink-0">
                <ArrowDownCircle className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-text-muted font-medium">Despesas realizadas</p>
                <p className="truncate font-semibold text-expense tabular-nums text-sm sm:text-base">
                  −{formatMoney(summary.realizedExpense)}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface-2/80 px-2.5 py-1.5 text-xs">
              <span className="text-[11px] text-text-dim">Projeção total:</span>
              <span className="font-semibold text-expense tabular-nums">
                −{formatMoney(summary.projectedExpense)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card
          onClick={() => nav('/contas')}
          className="cursor-pointer p-4 transition-all duration-150 hover:border-violet/40 hover:bg-surface-1/90"
        >
          <div className="mb-1 flex items-center justify-between">
            <Link
              to="/contas"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 font-semibold text-white hover:text-lime transition"
            >
              Contas <ChevronRight className="size-4 text-text-dim" />
            </Link>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setAddingAccount(true)
              }}
              aria-label="Nova conta"
              title="Nova conta"
              className="grid size-8 place-items-center rounded-xl bg-violet/15 border border-violet/25 text-violet-hover transition hover:bg-violet/25 active:scale-95"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <p className="mb-3 text-xs text-text-dim">Toque no olho para incluir ou ignorar a conta no saldo total.</p>
          {accounts.isLoading ? (
            <Spinner />
          ) : !accounts.data?.length ? (
            <Empty title="Sem contas cadastradas.">
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setAddingAccount(true)
                }}
              >
                Criar conta
              </Button>
            </Empty>
          ) : (
            <ul className="divide-y divide-border">
              {accounts.data.map((a) => (
                <li key={a.id} className="flex items-center gap-2 py-2.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleIncludeInTotal.mutate(a)
                    }}
                    disabled={toggleIncludeInTotal.isPending}
                    className="p-1 rounded-lg text-text-muted hover:text-white hover:bg-surface-2 transition active:scale-95 disabled:opacity-50"
                    aria-label={a.includeInTotal !== false ? 'Ignorar no saldo' : 'Incluir no saldo'}
                    title={a.includeInTotal !== false ? 'Ignorar no saldo total' : 'Incluir no saldo total'}
                  >
                    {a.includeInTotal === false ? (
                      <EyeOff className="size-4 text-text-dim" />
                    ) : (
                      <Eye className="size-4 text-lime" />
                    )}
                  </button>
                  <Link
                    to={`/contas/${a.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className={clsx(
                      'flex flex-1 items-center justify-between hover:text-lime transition',
                      a.includeInTotal === false && 'opacity-40',
                    )}
                  >
                    <span className="text-sm text-white font-medium">{a.name}</span>
                    <span
                      className={clsx(
                        'text-sm font-semibold tabular-nums',
                        a.balance < 0 ? 'text-expense' : 'text-white',
                      )}
                    >
                      {formatMoney(a.balance)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-semibold text-white">Despesas por categoria</h2>
          {txLoading ? (
            <Spinner />
          ) : !byCategory.length ? (
            <Empty title="Sem despesas no período." />
          ) : (
            <>
              <div className="h-44">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byCategory} dataKey="value" innerRadius={45} outerRadius={75} stroke="none">
                      {byCategory.map((c, i) => (
                        <Cell key={i} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => formatMoney(Number(v))}
                      contentStyle={{
                        background: '#0e0e13',
                        border: '1px solid #20202d',
                        borderRadius: 12,
                        color: '#ffffff',
                      }}
                      itemStyle={{ color: '#ffffff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1.5">
                {byCategory.slice(0, 5).map((c, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-text-muted">
                    <span className="size-2 rounded-full shrink-0" style={{ background: c.color }} />
                    <span className="truncate">{c.name}</span>
                    <span className="ml-auto font-medium text-white tabular-nums">{formatMoney(c.value)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <Card
        onClick={() => nav('/cartoes')}
        className="mt-4 cursor-pointer p-4 transition-all duration-150 hover:border-violet/40 hover:bg-surface-1/90"
      >
        <div className="mb-2 flex items-center justify-between">
          <Link
            to="/cartoes"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 font-semibold text-white hover:text-lime transition"
          >
            Cartões de crédito <ChevronRight className="size-4 text-text-dim" />
          </Link>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setAddingCard(true)
            }}
            aria-label="Novo cartão"
            title="Novo cartão"
            className="grid size-8 place-items-center rounded-xl bg-violet/15 border border-violet/25 text-violet-hover transition hover:bg-violet/25 active:scale-95"
          >
            <Plus className="size-4" />
          </button>
        </div>
        {creditCards.isLoading ? (
          <Spinner />
        ) : !creditCards.data?.length ? (
          <Empty title="Sem cartões de crédito.">
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setAddingCard(true)
              }}
            >
              Criar cartão
            </Button>
          </Empty>
        ) : (
          <ul className="divide-y divide-border">
            {creditCards.data.map((c) => (
              <li key={c.id} className="py-2.5">
                <Link
                  to={`/cartoes/${c.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-between text-sm hover:text-lime transition"
                >
                  <div>
                    <p className="font-medium text-white">{c.name}</p>
                    <p className="text-xs text-text-dim">
                      Disponível: <span className="text-lime tabular-nums">{formatMoney(c.availableLimit)}</span> · Vence dia{' '}
                      <span className="tabular-nums">{c.dueDay}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-text-dim">Fatura atual</p>
                    <p
                      className={clsx(
                        'font-semibold tabular-nums',
                        c.currentInvoiceAmount > 0 ? 'text-expense' : 'text-white',
                      )}
                    >
                      −{formatMoney(c.currentInvoiceAmount)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        onClick={() => nav('/grupos')}
        className="mt-4 cursor-pointer p-4 transition-all duration-150 hover:border-violet/40 hover:bg-surface-1/90"
      >
        <div className="mb-3 flex items-center justify-between">
          <Link
            to="/grupos"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 font-semibold text-white hover:text-lime transition"
          >
            <Users className="size-4 text-violet" />
            Acertos entre Membros / Cartão Compartilhado
            <ChevronRight className="size-4 text-text-dim" />
          </Link>
          {debtsSummary.data && (
            <div className="flex items-center gap-2">
              {debtsSummary.data.totalOwedCurrentMonth > 0 && (
                <Badge tone="expense">
                  A pagar: {formatMoney(debtsSummary.data.totalOwedCurrentMonth)}
                </Badge>
              )}
              {debtsSummary.data.totalReceivableCurrentMonth > 0 && (
                <Badge tone="income">
                  A receber: {formatMoney(debtsSummary.data.totalReceivableCurrentMonth)}
                </Badge>
              )}
            </div>
          )}
        </div>

        {debtsSummary.isLoading ? (
          <Spinner />
        ) : !debtsSummary.data?.groups.length ? (
          <p className="text-xs text-text-dim py-1">Nenhum acerto pendente com membros nos grupos 🎉</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3 pb-2 pt-1 border-b border-border/60">
              <div className="rounded-xl bg-surface-2/60 border border-border/70 p-3 card-highlight">
                <span className="text-[11px] text-text-muted font-medium">Total a pagar (mês)</span>
                <p
                  className={clsx(
                    'mt-0.5 text-lg font-bold tabular-nums',
                    debtsSummary.data.totalOwedCurrentMonth > 0 ? 'text-expense' : 'text-white',
                  )}
                >
                  {formatMoney(debtsSummary.data.totalOwedCurrentMonth)}
                </p>
              </div>
              <div className="rounded-xl bg-surface-2/60 border border-border/70 p-3 card-highlight">
                <span className="text-[11px] text-text-muted font-medium">Total a receber (mês)</span>
                <p className="mt-0.5 text-lg font-bold text-lime tabular-nums">
                  {formatMoney(debtsSummary.data.totalReceivableCurrentMonth)}
                </p>
              </div>
            </div>

            <ul className="divide-y divide-border pt-1">
              {debtsSummary.data.groups.map((g) => (
                <li key={g.groupId} className="py-2.5">
                  <Link
                    to={`/grupos/${g.groupId}?tab=settlements`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-between text-sm hover:text-lime transition"
                  >
                    <div>
                      <p className="font-medium text-white">{g.groupName}</p>
                      <p className="text-xs text-text-dim">
                        Total acumulado: {g.owedTotal > 0 ? <span className="text-expense tabular-nums">Deve {formatMoney(g.owedTotal)}</span> : 'Em dia'}
                        {g.receivableTotal > 0 ? <span className="tabular-nums"> · Tem a receber {formatMoney(g.receivableTotal)}</span> : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      {g.owedCurrentMonth > 0 && (
                        <p className="text-xs font-semibold text-expense tabular-nums">
                          −{formatMoney(g.owedCurrentMonth)} neste mês
                        </p>
                      )}
                      {g.receivableCurrentMonth > 0 && (
                        <p className="text-xs font-semibold text-lime tabular-nums">
                          +{formatMoney(g.receivableCurrentMonth)} neste mês
                        </p>
                      )}
                      {g.owedCurrentMonth === 0 && g.receivableCurrentMonth === 0 && (
                        <span className="text-xs text-text-dim">Ver acertos</span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card className="mt-4 p-4">
        <h2 className="mb-2 font-semibold text-white">Próximas pendentes</h2>
        {txLoading ? (
          <Spinner />
        ) : !upcoming.length ? (
          <Empty title="Nada pendente neste mês 🎉" />
        ) : (
          <ul className="divide-y divide-border">
            {upcoming.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-medium text-white">{t.title}</p>
                  <p className="text-xs text-text-dim tabular-nums">{formatDate(t.date)}</p>
                </div>
                <span
                  className={clsx(
                    'font-semibold tabular-nums',
                    t.type === 'INCOME' ? 'text-lime' : 'text-expense',
                  )}
                >
                  {t.type === 'INCOME' ? '+' : '−'}
                  {formatMoney(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AccountFormModal open={addingAccount} onClose={() => setAddingAccount(false)} />
      <CreditCardFormModal open={addingCard} onClose={() => setAddingCard(false)} />
      <TransactionFormModal open={adding} onClose={() => setAdding(false)} />
    </>
  )
}
