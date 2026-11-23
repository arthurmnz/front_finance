import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Landmark, Link2, Pencil, PiggyBank, Plus, Trash2, TrendingUp, Unlink, Users, Wallet } from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/lib/api'
import { useAccessibleAccounts, useAccounts, useAction, useGroups } from '@/lib/hooks'
import type { Account } from '@/lib/types'
import { accountTypeLabel, formatMoney, fullName, initials } from '@/lib/format'
import { Badge, Button, Card, CardGridSkeleton, ConfirmDialog, Empty, Modal, PageHeader, QueryState, Select } from '@/components/ui'
import AccountFormModal from '@/components/AccountFormModal'
import { toast } from 'sonner'

const typeIcon = { CHECKING: Landmark, WALLET: Wallet, SAVINGS: PiggyBank, INVESTMENTS: TrendingUp }

export default function Accounts() {
  const q = useAccounts()
  const accessibleAccounts = useAccessibleAccounts()
  const groups = useGroups().data ?? []
  const [form, setForm] = useState<{ open: boolean; account?: Account }>({ open: false })
  const [linking, setLinking] = useState<Account>()
  const [groupId, setGroupId] = useState('')
  const [deleting, setDeleting] = useState<Account>()

  const jointAccounts = useMemo(
    () => (accessibleAccounts.data ?? []).filter((a) => a.isJoint),
    [accessibleAccounts.data],
  )

  const link = useAction(
    ({ id, gid }: { id: string; gid: string }) => api.post(`/accounts/${id}/group/${gid}`),
    {
      invalidate: [['accounts'], ['groups']],
      onSuccess: (r) => {
        toast.success(
          r.status === 202 ? 'Solicitação de vínculo enviada aos administradores' : 'Conta vinculada ao grupo',
        )
        setLinking(undefined)
      },
    },
  )
  const unlink = useAction((id: string) => api.delete(`/accounts/${id}/group`), {
    invalidate: [['accounts'], ['groups']],
    success: 'Conta desvinculada',
  })
  const del = useAction((id: string) => api.delete(`/accounts/${id}`), {
    invalidate: [['accounts'], ['total-balance'], ['transactions'], ['groups']],
    success: 'Conta excluída',
    onSuccess: () => setDeleting(undefined),
  })
  const groupName = (id: string) => groups.find((g) => g.id === id)?.name ?? 'Grupo'

  return (
    <>
      <PageHeader
        title="Contas"
        action={
          <Button onClick={() => setForm({ open: true })}>
            <Plus className="size-4" /> Nova
          </Button>
        }
      />
      <QueryState isLoading={q.isLoading} error={q.error} skeleton={<CardGridSkeleton cards={4} />}>
        {!q.data?.length ? (
          <Empty title="Você ainda não tem contas." icon={<Wallet className="size-10" />}>
            <Button onClick={() => setForm({ open: true })}>Criar primeira conta</Button>
          </Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {q.data.map((a) => {
              const Icon = typeIcon[a.type]
              return (
                <Card key={a.id} className="p-4">
                  <Link to={`/contas/${a.id}`} className="flex items-center gap-3">
                    <div className="grid size-11 place-items-center rounded-xl bg-violet/15 border border-violet/25 text-violet-hover shadow-[0_0_8px_rgba(125,57,235,0.15)]">
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">{a.name}</p>
                      <p className="text-xs text-text-dim">{accountTypeLabel[a.type]}</p>
                    </div>
                    <p
                      className={clsx(
                        'text-lg font-bold tabular-nums',
                        a.balance < 0 ? 'text-expense' : a.balance > 0 ? 'text-income' : 'text-white',
                      )}
                    >
                      {formatMoney(a.balance)}
                    </p>
                  </Link>
                  <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                    {a.groupId && <Badge tone="primary">{groupName(a.groupId)}</Badge>}
                    {a.includeInTotal === false && <Badge tone="neutral">Fora do total</Badge>}
                    <div className="ml-auto flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setForm({ open: true, account: a })}>
                        <Pencil className="size-3.5" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleting(a)}
                        aria-label="Excluir conta"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                      {a.groupId ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={unlink.isPending}
                          onClick={() => unlink.mutate(a.id)}
                        >
                          <Unlink className="size-3.5" /> Desvincular
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!groups.length}
                          onClick={() => {
                            setGroupId(groups[0]?.id ?? '')
                            setLinking(a)
                          }}
                        >
                          <Link2 className="size-3.5" /> Grupo
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </QueryState>

      {jointAccounts.length > 0 && (
        <section className="mt-8 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-violet-hover" />
              <h2 className="text-base font-semibold text-white">Contas Conjuntas de Grupos</h2>
            </div>
            <Badge tone="primary">{jointAccounts.length}</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {jointAccounts.map((a) => {
              const Icon = typeIcon[a.type]
              const allowed = a.allowedMembers ?? []
              return (
                <Card key={a.id} className="p-4 border-violet/30 hover:border-violet/50 transition">
                  <Link to={`/contas/${a.id}`} className="flex items-center gap-3 group">
                    <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet/15 border border-violet/30 text-violet-hover">
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="truncate font-semibold text-white group-hover:text-lime transition">
                          {a.name}
                        </p>
                      </div>
                      <p className="text-xs text-text-dim">{accountTypeLabel[a.type]}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <p
                        className={clsx(
                          'text-lg font-bold tabular-nums',
                          a.balance < 0 ? 'text-expense' : a.balance > 0 ? 'text-income' : 'text-white',
                        )}
                      >
                        {formatMoney(a.balance)}
                      </p>
                      <ChevronRight className="size-4 text-text-dim group-hover:text-lime transition" />
                    </div>
                  </Link>

                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="primary">Conjunta</Badge>
                      {a.groupId && <Badge tone="neutral">{groupName(a.groupId)}</Badge>}
                      {a.includeInTotal === false && <Badge tone="neutral">Fora do total</Badge>}
                    </div>
                    {allowed.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-dim">
                        <span className="shrink-0">Acesso:</span>
                        {allowed.map((m) => (
                          <span
                            key={m.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs text-text-muted"
                          >
                            <span className="grid size-4 place-items-center rounded-full bg-violet/20 text-[9px] font-bold text-violet-hover">
                              {initials(m)}
                            </span>
                            {fullName(m)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </section>
      )}

      <AccountFormModal open={form.open} account={form.account} onClose={() => setForm({ open: false })} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(undefined)}
        title="Excluir conta"
        confirmLabel="Excluir"
        loading={del.isPending}
        message={`Excluir "${deleting?.name}"? Todas as transações dessa conta serão removidas e essa ação não pode ser desfeita.`}
        onConfirm={() => deleting && del.mutate(deleting.id)}
      />
      <Modal open={!!linking} onClose={() => setLinking(undefined)} title="Vincular a um grupo">
        <p className="mb-3 text-xs text-text-muted leading-relaxed">
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
