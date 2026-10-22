import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { ArrowDownCircle, ArrowUpCircle, Eye, EyeOff, Plus } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { api } from '@/lib/api'
import { useAccounts, useAllCategories, useCreditCards, useTotalBalance } from '@/lib/hooks'
import { useAuth } from '@/lib/auth'
import type { Transaction } from '@/lib/types'
import { formatDate, formatMoney } from '@/lib/format'
import { Button, Card, Empty, PageHeader, Spinner } from '@/components/ui'
import { MonthPicker, currentPeriod } from '@/components/MonthPicker'
import TransactionFormModal from '@/components/TransactionFormModal'
import AccountFormModal from '@/components/AccountFormModal'
import CreditCardFormModal from '@/components/CreditCardFormModal'

const PALETTE = ['#6366f1', '#f87171', '#34d399', '#fbbf24', '#38bdf8', '#e879f9', '#fb923c', '#a3e635']

export default function Dashboard() {
  const { user } = useAuth()
  const [period, setPeriod] = useState(currentPeriod())
  const [ignored, setIgnored] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const [addingAccount, setAddingAccount] = useState(false)
  const [addingCard, setAddingCard] = useState(false)
  const creditCards = useCreditCards()
  const accounts = useAccounts()
  const cats = useAllCategories().data
  const balance = useTotalBalance(period.month, period.year, ignored)

  const txQueries = useQueries({
    queries: (accounts.data ?? []).map((a) => ({
      queryKey: ['transactions', 'account', a.id, period.month, period.year],
      queryFn: () => api.get<Transaction[]>(`/transactions/account/${a.id}`, { params: period }).then((r) => r.data),
    })),
  })
  const txLoading = txQueries.some((q) => q.isLoading)
  const allTx = useMemo(() => {
    const seen = new Map<string, Transaction>()
    txQueries.forEach((q) => q.data?.forEach((t) => seen.set(t.id, t)))
    return [...seen.values()]
  }, [txQueries])

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    allTx.filter((t) => t.type === 'EXPENSE').forEach((t) => {
      const k = t.categoryId ?? 'none'
      map.set(k, (map.get(k) ?? 0) + t.amount)
    })
    return [...map.entries()].map(([id, value], i) => {
      const c = cats.find((c) => c.id === id)
      return { name: c?.name ?? 'Sem categoria', value, color: c?.color ?? PALETTE[i % PALETTE.length] }
    }).sort((a, b) => b.value - a.value)
  }, [allTx, cats])

  const upcoming = allTx.filter((t) => t.status === 'PENDING').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)
  const toggleIgnore = (id: string) => setIgnored((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  return (
    <>
      <PageHeader title={`Olá, ${user?.firstName ?? ''}`} subtitle="Resumo das suas finanças" action={<Button onClick={() => setAdding(true)}><Plus className="size-4" /> Nova</Button>} />
      <div className="mb-4"><MonthPicker value={period} onChange={setPeriod} /></div>

      <Card className="mb-4 bg-gradient-to-br from-primary/25 to-surface p-5">
        <p className="text-sm text-muted">Saldo total</p>
        <p className="text-4xl font-bold">{balance.data ? formatMoney(balance.data.total) : '—'}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2"><ArrowUpCircle className="size-8 text-income" /><div><p className="text-xs text-muted">Receitas</p><p className="font-semibold text-income">{formatMoney(balance.data?.monthlyIncome ?? 0)}</p></div></div>
          <div className="flex items-center gap-2"><ArrowDownCircle className="size-8 text-expense" /><div><p className="text-xs text-muted">Despesas</p><p className="font-semibold text-expense">{formatMoney(balance.data?.monthlyExpense ?? 0)}</p></div></div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold">Contas</h2>
            <button onClick={() => setAddingAccount(true)} aria-label="Nova conta" title="Nova conta"
              className="grid size-8 place-items-center rounded-full bg-primary/15 text-primary-hover transition hover:bg-primary/25"><Plus className="size-4" /></button>
          </div>
          <p className="mb-3 text-xs text-muted">Toque no olho para ignorar uma conta do saldo total.</p>
          {accounts.isLoading ? <Spinner /> : !accounts.data?.length ? <Empty title="Sem contas."><Button size="sm" onClick={() => setAddingAccount(true)}>Criar conta</Button></Empty> : (
            <ul className="divide-y divide-border">
              {accounts.data.map((a) => (
                <li key={a.id} className="flex items-center gap-2 py-2.5">
                  <button onClick={() => toggleIgnore(a.id)} className="p-1 text-muted hover:text-text" aria-label="Ignorar no saldo">
                    {ignored.includes(a.id) ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                  <Link to={`/contas/${a.id}`} className={`flex flex-1 items-center justify-between ${ignored.includes(a.id) ? 'opacity-40' : ''}`}>
                    <span className="text-sm">{a.name}</span>
                    <span className={`text-sm font-semibold ${a.balance < 0 ? 'text-expense' : ''}`}>{formatMoney(a.balance)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Despesas por categoria</h2>
          {txLoading ? <Spinner /> : !byCategory.length ? <Empty title="Sem despesas no período." /> : (
            <>
              <div className="h-44">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byCategory} dataKey="value" innerRadius={45} outerRadius={75} stroke="none">
                      {byCategory.map((c, i) => <Cell key={i} fill={c.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatMoney(Number(v))} contentStyle={{ background: '#1a2233', border: '1px solid #263047', borderRadius: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1.5">
                {byCategory.slice(0, 5).map((c, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="size-2.5 rounded-full" style={{ background: c.color }} />{c.name}
                    <span className="ml-auto font-medium">{formatMoney(c.value)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <Card className="mt-4 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Cartões de crédito</h2>
          <button onClick={() => setAddingCard(true)} aria-label="Novo cartão" title="Novo cartão"
            className="grid size-8 place-items-center rounded-full bg-primary/15 text-primary-hover transition hover:bg-primary/25"><Plus className="size-4" /></button>
        </div>
        {creditCards.isLoading ? <Spinner /> : !creditCards.data?.length ? (
          <Empty title="Sem cartões de crédito."><Button size="sm" onClick={() => setAddingCard(true)}>Criar cartão</Button></Empty>
        ) : (
          <ul className="divide-y divide-border">
            {creditCards.data.map((c) => (
              <li key={c.id} className="py-2.5">
                <Link to={`/cartoes/${c.id}`} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted">Disponível: <span className="text-income">{formatMoney(c.availableLimit)}</span> · Vence dia {c.dueDay}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted">Fatura atual</p>
                    <p className="font-semibold text-expense">{formatMoney(c.currentInvoiceAmount)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-4 p-4">
        <h2 className="mb-2 font-semibold">Próximas pendentes</h2>
        {txLoading ? <Spinner /> : !upcoming.length ? <Empty title="Nada pendente neste mês 🎉" /> : (
          <ul className="divide-y divide-border">
            {upcoming.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                <div><p className="font-medium">{t.title}</p><p className="text-xs text-muted">{formatDate(t.date)}</p></div>
                <span className={t.type === 'INCOME' ? 'font-semibold text-income' : t.type === 'EXPENSE' ? 'font-semibold text-expense' : 'font-semibold'}>{formatMoney(t.amount)}</span>
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
