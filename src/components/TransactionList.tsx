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
    const isIncomingTransfer =
      t.type === 'TRANSFER' &&
      (Boolean(accountId && t.destinationAccountId === accountId) ||
        Boolean(
          !accountId &&
            accountNames &&
            t.destinationAccountId &&
            accountNames.has(t.destinationAccountId) &&
            !accountNames.has(t.accountId),
        ))
    const incoming = t.type === 'INCOME' || isIncomingTransfer
    const done = t.status === 'COMPLETED'
    const isCard = !!t.creditCardId
    const catColor = cat ? normalizeCategoryColor(cat.color) : undefined

    return (
      <div key={t.id} className="group flex items-center gap-3 p-3 sm:p-3.5 transition-colors duration-150 hover:bg-surface-2/50">
        {isCard ? (
          <div
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet/15 border border-violet/25 text-violet-hover shadow-[0_0_8px_rgba(125,57,235,0.15)]"
            title="Compra no cartão"
          >
            <CardIcon className="size-4" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => toggle.mutate(t.id)}
            title={done ? 'Marcar como pendente / não pago' : 'Marcar como concluído / pago'}
            className={clsx(
              'grid size-9 shrink-0 place-items-center rounded-xl transition-all duration-150 active:scale-95 cursor-pointer',
              done
                ? 'bg-lime-subtle text-lime border border-lime/30 hover:bg-lime/25 shadow-[0_0_8px_rgba(198,255,51,0.15)]'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25',
            )}
          >
            {done ? <Check className="size-4 stroke-[2.5]" /> : <Clock className="size-4" />}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-white">
            <span className="truncate">{t.title}</span>
            {t.installmentNumber && t.totalInstallments && (
              <Badge tone="primary" className="shrink-0 text-[10px]">
                {t.installmentNumber}/{t.totalInstallments}
              </Badge>
            )}
            {t.recurrenceGroupId && !t.installmentNumber && <Repeat className="size-3 shrink-0 text-text-dim" />}
            {t.type === 'TRANSFER' && <ArrowLeftRight className="size-3 shrink-0 text-text-dim" />}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-dim mt-0.5">
            {!groupByDay && <span className="tabular-nums">{formatDate(t.date)}</span>}
            {isCard && cardNames?.get(t.creditCardId!) && <span>💳 {cardNames.get(t.creditCardId!)}</span>}
            {!isCard && accountNames && (
              <span>
                {accountNames.get(t.accountId)}
                {t.type === 'TRANSFER' && t.destinationAccountId ? ` → ${accountNames.get(t.destinationAccountId)}` : ''}
              </span>
            )}
            {cat && (
              <span className="inline-flex items-center gap-1 font-medium" style={{ color: catColor }}>
                <span>{cat.icon}</span> <span>{cat.name}</span>
              </span>
            )}
            {showResponsible && t.responsible && (
              <span className="inline-flex items-center gap-1 text-text-muted">
                <User className="size-3 text-text-dim" /> {fullName(t.responsible)}
              </span>
            )}
            {!isCard && (
              done ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-lime/10 border border-lime/25 px-1.5 py-0.2 text-[10px] font-medium text-lime">
                  <Check className="size-2.5 stroke-[2.5]" /> Concluído
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.2 text-[10px] font-medium text-amber-400">
                  <Clock className="size-2.5" /> Pendente
                </span>
              )
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p
            className={clsx(
              'text-sm sm:text-base font-semibold tabular-nums tracking-tight',
              incoming ? 'text-lime' : 'text-expense',
            )}
          >
            {incoming ? '+' : t.type === 'TRANSFER' ? '' : '−'}
            {formatMoney(t.amount)}
          </p>
          <div className="flex justify-end gap-1 mt-0.5 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => setEditing(t)}
              className="p-1 rounded-md text-text-dim hover:text-white hover:bg-surface-2 transition active:scale-95"
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
              className="p-1 rounded-md text-text-dim hover:text-expense hover:bg-surface-2 transition active:scale-95"
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
                <div className="mb-2 flex items-center justify-between px-1 text-xs">
                  <span className="font-semibold capitalize text-text-muted tracking-tight">{dayLabel(day)}</span>
                  <span
                    className={clsx(
                      'tabular-nums font-semibold',
                      total > 0 ? 'text-lime' : total < 0 ? 'text-expense' : 'text-text-muted',
                    )}
                  >
                    {total > 0 ? '+' : total < 0 ? '−' : ''}
                    {formatMoney(Math.abs(total))}
                  </span>
                </div>
                <Card className="divide-y divide-border overflow-hidden">{list.map(renderRow)}</Card>
              </section>
            )
          })}
        </div>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">{sorted.map(renderRow)}</Card>
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
          <div className="mt-3 rounded-xl border border-border bg-surface-2 p-3 card-highlight">
            <Checkbox checked={allFuture} onChange={setAllFuture}>
              Excluir também todas as futuras
            </Checkbox>
          </div>
        )}
      </ConfirmDialog>
    </>
  )
}
