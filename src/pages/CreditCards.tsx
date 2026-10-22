import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CreditCard as CardIcon, Link2, Pencil, Plus, Trash2, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAccounts, useAction, useCreditCards, useGroups } from '@/lib/hooks'
import { useAuth } from '@/lib/auth'
import type { CreditCard } from '@/lib/types'
import { formatMoney, fullName } from '@/lib/format'
import { Badge, Button, Card, ConfirmDialog, Empty, Modal, PageHeader, QueryState, Select } from '@/components/ui'
import CreditCardFormModal from '@/components/CreditCardFormModal'

export default function CreditCards() {
  const { user } = useAuth()
  const q = useCreditCards()
  const accounts = useAccounts().data ?? []
  const groups = useGroups().data ?? []
  const [form, setForm] = useState<{ open: boolean; card?: CreditCard }>({ open: false })
  const [linking, setLinking] = useState<CreditCard>()
  const [groupId, setGroupId] = useState('')
  const [deleting, setDeleting] = useState<CreditCard>()

  const link = useAction(
    ({ id, gid }: { id: string; gid: string }) => api.post(`/credit-cards/${id}/group/${gid}`),
    {
      invalidate: [['credit-cards'], ['groups']],
      onSuccess: (r) => {
        toast.success(
          r.status === 202
            ? 'Solicitação de vínculo enviada aos administradores do grupo'
            : 'Cartão vinculado ao grupo',
        )
        setLinking(undefined)
      },
    },
  )
  const unlink = useAction((id: string) => api.delete(`/credit-cards/${id}/group`), {
    invalidate: [['credit-cards'], ['groups']],
    success: 'Cartão desvinculado do grupo',
  })
  const del = useAction((id: string) => api.delete(`/credit-cards/${id}`), {
    invalidate: [['credit-cards'], ['transactions'], ['groups']],
    success: 'Cartão excluído',
    onSuccess: () => setDeleting(undefined),
  })

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? 'Conta'
  const groupName = (id: string) => groups.find((g) => g.id === id)?.name ?? 'Grupo'

  return (
    <>
      <PageHeader
        title="Cartões de Crédito"
        subtitle="Controle limites, faturas, parcelamentos e compartilhamento em grupos"
        action={
          <Button onClick={() => setForm({ open: true })}>
            <Plus className="size-4" /> Novo cartão
          </Button>
        }
      />

      <QueryState isLoading={q.isLoading} error={q.error}>
        {!q.data?.length ? (
          <Empty title="Você ainda não tem cartões de crédito." icon={<CardIcon className="size-10" />}>
            <Button onClick={() => setForm({ open: true })}>Criar primeiro cartão</Button>
          </Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {q.data.map((c) => {
              const pct = c.limitAmount > 0 ? Math.min(100, Math.round((c.usedLimit / c.limitAmount) * 100)) : 0
              const isMine = c.ownerId === user?.id
              return (
                <Card key={c.id} className="p-4">
                  <Link to={`/cartoes/${c.id}`} className="block space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="grid size-11 place-items-center rounded-xl bg-primary/15 text-primary-hover">
                        <CardIcon className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{c.name}</p>
                        <p className="truncate text-xs text-muted">
                          Fecha dia {c.closingDay} · Vence dia {c.dueDay} · {accountName(c.accountId)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-muted">Fatura atual</p>
                        <p className="text-base font-bold text-expense">{formatMoney(c.currentInvoiceAmount)}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted">Usado: {formatMoney(c.usedLimit)}</span>
                        <span className="font-medium text-income">Disponível: {formatMoney(c.availableLimit)}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                        <div
                          className={`h-full rounded-full ${pct >= 90 ? 'bg-expense' : pct >= 70 ? 'bg-warn' : 'bg-primary'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-muted">Limite total: {formatMoney(c.limitAmount)}</p>
                    </div>
                  </Link>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    {c.groupId && <Badge tone="primary">{groupName(c.groupId)}</Badge>}
                    {!isMine && c.owner && <Badge>Dono: {fullName(c.owner)}</Badge>}
                    {isMine && (
                      <div className="ml-auto flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setForm({ open: true, card: c })}>
                          <Pencil className="size-3.5" /> Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="hover:!text-expense"
                          onClick={() => setDeleting(c)}
                          aria-label="Excluir cartão"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                        {c.groupId ? (
                          <Button size="sm" variant="ghost" loading={unlink.isPending} onClick={() => unlink.mutate(c.id)}>
                            <Unlink className="size-3.5" /> Desvincular
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!groups.length}
                            onClick={() => {
                              setGroupId(groups[0]?.id ?? '')
                              setLinking(c)
                            }}
                          >
                            <Link2 className="size-3.5" /> Grupo
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </QueryState>

      <CreditCardFormModal open={form.open} card={form.card} onClose={() => setForm({ open: false })} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(undefined)}
        title="Excluir cartão de crédito"
        confirmLabel="Excluir"
        loading={del.isPending}
        message={`Excluir "${deleting?.name}"? Todas as transações e faturas deste cartão serão removidas.`}
        onConfirm={() => deleting && del.mutate(deleting.id)}
      />
      <Modal open={!!linking} onClose={() => setLinking(undefined)} title="Vincular cartão a um grupo">
        <p className="mb-3 text-sm text-muted">
          Se você for dono/admin do grupo, o vínculo é imediato. Caso contrário, será enviada uma solicitação.
        </p>
        <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
        <Button
          className="mt-4 w-full"
          loading={link.isPending}
          onClick={() => linking && groupId && link.mutate({ id: linking.id, gid: groupId })}
        >
          Vincular
        </Button>
      </Modal>
    </>
  )
}
