import { useState } from 'react'
import { ArrowLeftRight, Check, Clock, CreditCard as CardIcon, Pencil, Repeat, Trash2, User } from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/lib/api'
import { ALL_MONEY, useAction } from '@/lib/hooks'
import type { Category, Transaction } from '@/lib/types'
import { formatDate, formatMoney, fullName } from '@/lib/format'
import { normalizeCategoryColor } from '@/lib/palette'
import { Badge, Card, Checkbox, ConfirmDialog, Empty } from './ui'
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
    const catColor = cat ? normalizeCategoryColor(cat.color) : undefined

    return (
      <div key={t.id} className="flex items-center gap-3 p-3 transition hover:bg-surface-2/40">
        {isCard ? (
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet/15 text-violet-hover" title="Compra no cartão">
            <CardIcon className="size-4" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => toggle.mutate(t.id)}
            title={done ? 'Marcar como pendente' : 'Marcar como concluída'}
            className={clsx(
              'grid size-9 shrink-0 place-items-center rounded-xl transition cursor-pointer',
              done ? 'bg-lime-subtle text-lime' : 'bg-surface-2 text-text-muted hover:text-white',
            )}
          >
            {done ? <Check className="size-4" /> : <Clock className="size-4" />}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-white">
            {t.title}
            {t.installmentNumber && t.totalInstallments && (
              <Badge tone="primary">
                {t.installmentNumber}/{t.totalInstallments}
              </Badge>
            )}
            {t.recurrenceGroupId && !t.installmentNumber && <Repeat className="size-3 shrink-0 text-text-dim" />}
            {t.type === 'TRANSFER' && <ArrowLeftRight className="size-3 shrink-0 text-text-dim" />}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-text-dim mt-0.5">
            {!groupByDay && formatDate(t.date)}
            {isCard && cardNames?.get(t.creditCardId!) && <span>💳 {cardNames.get(t.creditCardId!)}</span>}
            {!isCard && accountNames && (
              <span>
                {accountNames.get(t.accountId)}
                {t.type === 'TRANSFER' && t.destinationAccountId ? ` → ${accountNames.get(t.destinationAccountId)}` : ''}
              </span>
            )}
            {cat && (
              <span style={{ color: catColor }}>
                {cat.icon} {cat.name}
              </span>
            )}
            {showResponsible && t.responsible && (
              <span className="inline-flex items-center gap-1 text-text-muted">
                <User className="size-3" /> {fullName(t.responsible)}
              </span>
            )}
            {!isCard && !done && <Badge tone="default">Pendente</Badge>}
          </p>
        </div>
        <div className="text-right">
          <p
            className={clsx(
              'text-sm font-semibold tabular-nums',
              incoming ? 'text-lime' : 'text-white',
            )}
          >
            {incoming ? '+' : t.type === 'TRANSFER' ? '' : '−'}
            {formatMoney(t.amount)}
          </p>
          <div className="flex justify-end gap-1 mt-0.5">
            <button
              type="button"
              onClick={() => setEditing(t)}
              className="p-1 text-text-dim hover:text-white transition"
              aria-label="Editar"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setAllFuture(false)
                setDeleting(t)
              }}
              className="p-1 text-text-dim hover:text-white transition"
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
                  <span className="font-medium capitalize text-text-dim">{dayLabel(day)}</span>
                  <span
                    className={clsx(
                      'tabular-nums font-semibold',
                      total > 0 ? 'text-lime' : 'text-white',
                    )}
                  >
                    {total > 0 ? '+' : total < 0 ? '−' : ''}
                    {formatMoney(Math.abs(total))}
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
          <div className="mt-3 rounded-xl border border-border bg-surface-2 p-3">
            <Checkbox checked={allFuture} onChange={setAllFuture}>
              Excluir também todas as futuras
            </Checkbox>
          </div>
        )}
      </ConfirmDialog>
    </>
  )
}
