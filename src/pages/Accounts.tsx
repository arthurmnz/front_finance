import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Landmark, Link2, Pencil, PiggyBank, Plus, Trash2, TrendingUp, Unlink, Wallet } from 'lucide-react'
import { api } from '@/lib/api'
import { useAccounts, useAction, useGroups } from '@/lib/hooks'
import type { Account } from '@/lib/types'
import { accountTypeLabel, formatMoney } from '@/lib/format'
import { Badge, Button, Card, CardGridSkeleton, ConfirmDialog, Empty, Modal, PageHeader, QueryState, Select } from '@/components/ui'
import AccountFormModal from '@/components/AccountFormModal'
import { toast } from 'sonner'

const typeIcon = { CHECKING: Landmark, WALLET: Wallet, SAVINGS: PiggyBank, INVESTMENTS: TrendingUp }

export default function Accounts() {
  const q = useAccounts()
  const groups = useGroups().data ?? []
  const [form, setForm] = useState<{ open: boolean; account?: Account }>({ open: false })
  const [linking, setLinking] = useState<Account>()
  const [groupId, setGroupId] = useState('')
  const [deleting, setDeleting] = useState<Account>()

  const link = useAction(
    ({ id, gid }: { id: string; gid: string }) => api.post(`/accounts/${id}/group/${gid}`),
    {
      invalidate: [['accounts'], ['groups']],
      onSuccess: (r) => { toast.success(r.status === 202 ? 'Solicitação de vínculo enviada aos administradores' : 'Conta vinculada ao grupo'); setLinking(undefined) },
    },
  )
  const unlink = useAction((id: string) => api.delete(`/accounts/${id}/group`), { invalidate: [['accounts'], ['groups']], success: 'Conta desvinculada' })
  const del = useAction((id: string) => api.delete(`/accounts/${id}`), { invalidate: [['accounts'], ['total-balance'], ['transactions'], ['groups']], success: 'Conta excluída', onSuccess: () => setDeleting(undefined) })
  const groupName = (id: string) => groups.find((g) => g.id === id)?.name ?? 'Grupo'

  return (
    <>
      <PageHeader title="Contas" action={<Button onClick={() => setForm({ open: true })}><Plus className="size-4" /> Nova</Button>} />
      <QueryState isLoading={q.isLoading} error={q.error} skeleton={<CardGridSkeleton cards={4} />}>
        {!q.data?.length ? (
          <Empty title="Você ainda não tem contas." icon={<Wallet className="size-10" />}><Button onClick={() => setForm({ open: true })}>Criar primeira conta</Button></Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {q.data.map((a) => {
              const Icon = typeIcon[a.type]
              return (
                <Card key={a.id} className="p-4">
                  <Link to={`/contas/${a.id}`} className="flex items-center gap-3">
                    <div className="grid size-11 place-items-center rounded-xl bg-primary/15 text-primary-hover"><Icon className="size-5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{a.name}</p>
                      <p className="text-xs text-muted">{accountTypeLabel[a.type]}</p>
                    </div>
                    <p className={`text-lg font-bold ${a.balance < 0 ? 'text-expense' : ''}`}>{formatMoney(a.balance)}</p>
                  </Link>
                  <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                    {a.groupId && <Badge tone="primary">{groupName(a.groupId)}</Badge>}
                    <div className="ml-auto flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setForm({ open: true, account: a })}><Pencil className="size-3.5" /> Editar</Button>
                      <Button size="sm" variant="ghost" className="hover:!text-expense" onClick={() => setDeleting(a)} aria-label="Excluir conta"><Trash2 className="size-3.5" /></Button>
                      {a.groupId
                        ? <Button size="sm" variant="ghost" loading={unlink.isPending} onClick={() => unlink.mutate(a.id)}><Unlink className="size-3.5" /> Desvincular</Button>
                        : <Button size="sm" variant="ghost" disabled={!groups.length} onClick={() => { setGroupId(groups[0]?.id ?? ''); setLinking(a) }}><Link2 className="size-3.5" /> Grupo</Button>}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </QueryState>

      <AccountFormModal open={form.open} account={form.account} onClose={() => setForm({ open: false })} />
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(undefined)} title="Excluir conta" confirmLabel="Excluir" loading={del.isPending}
        message={`Excluir "${deleting?.name}"? Todas as transações dessa conta serão removidas e essa ação não pode ser desfeita.`} onConfirm={() => deleting && del.mutate(deleting.id)} />
      <Modal open={!!linking} onClose={() => setLinking(undefined)} title="Vincular a um grupo">
        <p className="mb-3 text-sm text-muted">Se você for dono/admin do grupo, o vínculo é imediato. Caso contrário, será enviada uma solicitação.</p>
        <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </Select>
        <Button className="mt-4 w-full" loading={link.isPending} onClick={() => linking && groupId && link.mutate({ id: linking.id, gid: groupId })}>Vincular</Button>
      </Modal>
    </>
  )
}
