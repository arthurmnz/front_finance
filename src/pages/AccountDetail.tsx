import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAccessibleAccounts, useAction, useAccountTransactions, useAllCategories } from '@/lib/hooks'
import { accountTypeLabel, formatMoney } from '@/lib/format'
import { Button, Card, ConfirmDialog, Empty, PageHeader, QueryState } from '@/components/ui'
import { MonthPicker, currentPeriod } from '@/components/MonthPicker'
import TransactionList from '@/components/TransactionList'
import TransactionFormModal from '@/components/TransactionFormModal'

export default function AccountDetail() {
  const { id } = useParams()
  const [period, setPeriod] = useState(currentPeriod())
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const nav = useNavigate()
  const accounts = useAccessibleAccounts()
  const account = accounts.data?.find((a) => a.id === id)
  const tx = useAccountTransactions(id, period.month, period.year)
  const cats = useAllCategories().data

  const del = useAction(() => api.delete(`/accounts/${id}`), { invalidate: [['accounts'], ['total-balance'], ['transactions'], ['groups']], success: 'Conta excluída', onSuccess: () => nav('/contas') })

  if (accounts.isSuccess && !account) return <Empty title="Conta não encontrada." />
  const items = (tx.data ?? []).filter((t) => !t.creditCardId)
  const income = items.filter((t) => t.type === 'INCOME' || (t.type === 'TRANSFER' && t.destinationAccountId === id)).reduce((s, t) => s + t.amount, 0)
  const expense = items.filter((t) => t.type === 'EXPENSE' || (t.type === 'TRANSFER' && t.accountId === id)).reduce((s, t) => s + t.amount, 0)

  return (
    <>
      <PageHeader
        back={<Link to="/contas" className="mb-1 inline-flex items-center gap-1 text-xs text-muted hover:text-text"><ArrowLeft className="size-3" /> Contas</Link>}
        title={account?.name ?? '…'} subtitle={account && accountTypeLabel[account.type]}
        action={<div className="flex gap-2"><Button onClick={() => setAdding(true)}><Plus className="size-4" /> Nova</Button><Button variant="danger" onClick={() => setDeleting(true)} aria-label="Excluir conta"><Trash2 className="size-4" /></Button></div>}
      />
      <Card className="mb-4 p-4">
        <p className="text-xs text-muted">Saldo atual</p>
        <p className="text-3xl font-bold">{account ? formatMoney(account.balance) : '—'}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
          <div><p className="text-xs text-muted">Entradas no mês</p><p className="font-semibold text-income">{formatMoney(income)}</p></div>
          <div><p className="text-xs text-muted">Saídas no mês</p><p className="font-semibold text-expense">{formatMoney(expense)}</p></div>
        </div>
      </Card>
      <div className="mb-3"><MonthPicker value={period} onChange={setPeriod} /></div>
      <QueryState isLoading={tx.isLoading} error={tx.error}>
        <TransactionList items={items} categories={cats} accountId={id} />
      </QueryState>
      <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} title="Excluir conta" confirmLabel="Excluir" loading={del.isPending}
        message={`Excluir "${account?.name}"? Todas as transações dessa conta serão removidas e essa ação não pode ser desfeita.`} onConfirm={() => del.mutate()} />
      <TransactionFormModal open={adding} onClose={() => setAdding(false)} defaultAccountId={id} />
    </>
  )
}
