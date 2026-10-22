import { useState } from 'react'
import { ArrowLeftRight, Check, Clock, CreditCard as CardIcon, Pencil, Repeat, Trash2, User } from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/lib/api'
import { ALL_MONEY, useAction } from '@/lib/hooks'
import type { Category, Transaction } from '@/lib/types'
import { formatDate, formatMoney, fullName } from '@/lib/format'
import { Badge, Card, ConfirmDialog, Empty } from './ui'
import TransactionFormModal from './TransactionFormModal'

const dayLabel = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const diff = Math.round(
    (new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime() - date.getTime()) / 86400000,
  )
  const base = date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
  return diff === 0 ? `Hoje · ${base}` : diff === 1 ? `Ontem · ${base}` : base
}

interface Props {
  items: Transaction[]
  categories: Category[]
  accountId?: string
  groupByDay?: boolean
  accountNames?: Map<string, string>
  cardNames?: Map<string, string>
  showResponsible?: boolean
}

export default function TransactionList({
  items,
  categories,
  accountId,
  groupByDay,
  accountNames,
  cardNames,
  showResponsible = true,
}: Props) {
  const [editing, setEditing] = useState<Transaction>()
  const [deleting, setDeleting] = useState<Transaction>()
  const [allFuture, setAllFuture] = useState(false)
  const catMap = new Map(categories.map((c) => [c.id, c]))

  const toggle = useAction((id: string) => api.put(`/transactions/${id}/toggle-status`), { invalidate: ALL_MONEY })
  const del = useAction(
    (t: Transaction) => api.delete(`/transactions/${t.id}`, { params: { deleteAllFuture: allFuture } }),
    { invalidate: ALL_MONEY, success: 'Transação excluída', onSuccess: () => setDeleting(undefined) },
  )

  if (!items.length) return <Empty title="Nenhuma transação neste período." />
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date))

  const renderRow = (t: Transaction) => {
    const cat = t.categoryId ? catMap.get(t.categoryId) : undefined
    const incoming = t.type === 'INCOME' || (t.type === 'TRANSFER' && !!accountId && t.destinationAccountId === accountId)
    const done = t.status === 'COMPLETED'
    const isCard = !!t.creditCardId
    return (
      <div key={t.id} className="flex items-center gap-3 p-3">
        {isCard ? (
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary-hover" title="Compra no cartão">
            <CardIcon className="size-4" />
          </div>
        ) : (
          <button
            onClick={() => toggle.mutate(t.id)}
            title={done ? 'Marcar como pendente' : 'Marcar como concluída'}
            className={clsx(
              'grid size-9 shrink-0 place-items-center rounded-full transition',
              done ? 'bg-income/15 text-income' : 'bg-warn/15 text-warn',
            )}
          >
            {done ? <Check className="size-4" /> : <Clock className="size-4" />}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            {t.title}
            {t.installmentNumber && t.totalInstallments && (
              <Badge tone="primary">
                {t.installmentNumber}/{t.totalInstallments}
              </Badge>
            )}
            {t.recurrenceGroupId && !t.installmentNumber && <Repeat className="size-3 shrink-0 text-muted" />}
            {t.type === 'TRANSFER' && <ArrowLeftRight className="size-3 shrink-0 text-muted" />}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            {!groupByDay && formatDate(t.date)}
            {isCard && cardNames?.get(t.creditCardId!) && <span>💳 {cardNames.get(t.creditCardId!)}</span>}
            {!isCard && accountNames && (
              <span>
                {accountNames.get(t.accountId)}
                {t.type === 'TRANSFER' && t.destinationAccountId ? ` → ${accountNames.get(t.destinationAccountId)}` : ''}
              </span>
            )}
            {cat && (
              <span style={{ color: cat.color ?? undefined }}>
                {cat.icon} {cat.name}
              </span>
            )}
            {showResponsible && t.responsible && (
              <span className="inline-flex items-center gap-1 text-muted/90">
                <User className="size-3" /> {fullName(t.responsible)}
              </span>
            )}
            {!isCard && !done && <Badge tone="warn">Pendente</Badge>}
          </p>
        </div>
        <div className="text-right">
          <p
            className={clsx(
              'text-sm font-semibold',
              t.type === 'TRANSFER' ? 'text-text' : incoming ? 'text-income' : 'text-expense',
            )}
          >
            {incoming ? '+' : t.type === 'TRANSFER' ? '' : '−'}
            {formatMoney(t.amount)}
          </p>
          <div className="flex justify-end gap-1">
            <button onClick={() => setEditing(t)} className="p-1 text-muted hover:text-text" aria-label="Editar">
              <Pencil className="size-3.5" />
            </button>
            <button
              onClick={() => {
                setAllFuture(false)
                setDeleting(t)
              }}
              className="p-1 text-muted hover:text-expense"
              aria-label="Excluir"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  const days = new Map<string, Transaction[]>()
  if (groupByDay)
    sorted.forEach((t) => {
      const k = t.date.slice(0, 10)
      days.set(k, [...(days.get(k) ?? []), t])
    })
  const dayTotal = (list: Transaction[]) =>
    list.reduce((s, t) => s + (t.type === 'INCOME' ? t.amount : t.type === 'EXPENSE' ? -t.amount : 0), 0)

  return (
    <>
      {groupByDay ? (
        <div className="space-y-4">
          {[...days.entries()].map(([day, list]) => {
            const total = dayTotal(list)
            return (
              <section key={day}>
                <div className="mb-1.5 flex items-center justify-between px-1 text-xs">
                  <span className="font-medium capitalize text-muted">{dayLabel(day)}</span>
                  <span className={total < 0 ? 'text-expense' : total > 0 ? 'text-income' : 'text-muted'}>
                    {formatMoney(total)}
                  </span>
                </div>
                <Card className="divide-y divide-border">{list.map(renderRow)}</Card>
              </section>
            )
          })}
        </div>
      ) : (
        <Card className="divide-y divide-border">{sorted.map(renderRow)}</Card>
      )}
      <TransactionFormModal open={!!editing} onClose={() => setEditing(undefined)} transaction={editing} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(undefined)}
        title="Excluir transação"
        message={`Excluir "${deleting?.title}"?`}
        confirmLabel="Excluir"
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting)}
      >
        {deleting?.recurrenceGroupId && (
          <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-indigo-500"
              checked={allFuture}
              onChange={(e) => setAllFuture(e.target.checked)}
            />
            Excluir também todas as futuras
          </label>
        )}
      </ConfirmDialog>
    </>
  )
}
