import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, CreditCard as CardIcon, LogOut, Trash2, UserPlus, X } from 'lucide-react'
import { api } from '@/lib/api'
import {
  useAction,
  useGroup,
  useGroupAccountRequests,
  useGroupAccounts,
  useGroupCategories,
  useGroupCreditCardRequests,
  useGroupCreditCards,
} from '@/lib/hooks'
import { useAuth } from '@/lib/auth'
import type { GroupMember, GroupRole } from '@/lib/types'
import { accountTypeLabel, formatMoney, fullName, initials, roleLabel } from '@/lib/format'
import { Badge, Button, Card, ConfirmDialog, Empty, Field, Input, Modal, PageHeader, QueryState, Select, Tabs } from '@/components/ui'
import CategoryManager from '@/components/CategoryManager'

type Tab = 'members' | 'accounts' | 'cards' | 'categories' | 'requests' | 'settings'

export default function GroupDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('members')
  const group = useGroup(id)
  const g = group.data
  const isOwner = g?.myRole === 'OWNER'
  const isAdmin = isOwner || g?.myRole === 'ADMIN'
  const accounts = useGroupAccounts(tab === 'accounts' ? id : undefined)
  const cards = useGroupCreditCards(tab === 'cards' ? id : undefined)
  const categories = useGroupCategories(tab === 'categories' ? id : undefined)
  const requests = useGroupAccountRequests(id, isAdmin)
  const cardRequests = useGroupCreditCardRequests(id, isAdmin)

  const [inviting, setInviting] = useState(false)
  const [email, setEmail] = useState('')
  const [removing, setRemoving] = useState<GroupMember>()
  const [confirm, setConfirm] = useState<'leave' | 'delete'>()
  const [renameTo, setRenameTo] = useState<string>()
  const [transferTo, setTransferTo] = useState('')

  const inv = [['groups'], ['groups', id]]
  const invite = useAction((e: string) => api.post(`/groups/${id}/invitations`, { inviteeEmail: e }), {
    success: 'Convite enviado',
    onSuccess: () => {
      setInviting(false)
      setEmail('')
    },
  })
  const setRole = useAction(
    ({ email, role }: { email: string; role: GroupRole }) => api.patch(`/groups/${id}/members/role`, { email, role }),
    { invalidate: inv, success: 'Papel atualizado' },
  )
  const remove = useAction((email: string) => api.delete(`/groups/${id}/members`, { params: { email } }), {
    invalidate: inv,
    success: 'Membro removido',
    onSuccess: () => setRemoving(undefined),
  })
  const rename = useAction((name: string) => api.put(`/groups/${id}`, { name }), { invalidate: inv, success: 'Grupo renomeado' })
  const transfer = useAction((newOwnerEmail: string) => api.patch(`/groups/${id}/transfer`, { newOwnerEmail }), {
    invalidate: inv,
    success: 'Propriedade transferida',
    onSuccess: () => setTransferTo(''),
  })
  const leave = useAction(() => api.delete(`/groups/${id}/leave`), {
    invalidate: [['groups']],
    success: 'Você saiu do grupo',
    onSuccess: () => nav('/grupos'),
  })
  const del = useAction(() => api.delete(`/groups/${id}`), {
    invalidate: [['groups']],
    success: 'Grupo excluído',
    onSuccess: () => nav('/grupos'),
  })

  const decideAccount = (verb: 'accept' | 'reject') =>
    useAction((rid: string) => api.post(`/groups/${id}/account-requests/${rid}/${verb}`), {
      invalidate: [['groups', id], ['accounts']],
      success: verb === 'accept' ? 'Solicitação aceita' : 'Solicitação recusada',
    })
  const acceptReq = decideAccount('accept')
  const rejectReq = decideAccount('reject')

  const decideCard = (verb: 'accept' | 'reject') =>
    useAction((rid: string) => api.post(`/groups/${id}/credit-card-requests/${rid}/${verb}`), {
      invalidate: [['groups', id], ['credit-cards']],
      success: verb === 'accept' ? 'Cartão vinculado ao grupo' : 'Solicitação recusada',
    })
  const acceptCardReq = decideCard('accept')
  const rejectCardReq = decideCard('reject')

  const canManage = (m: GroupMember) =>
    isAdmin && m.role !== 'OWNER' && m.user.id !== user?.id && (isOwner || m.role === 'MEMBER')

  const pendingReqCount = (requests.data?.length ?? 0) + (cardRequests.data?.length ?? 0)

  return (
    <QueryState isLoading={group.isLoading} error={group.error}>
      {g && (
        <>
          <PageHeader
            back={
              <Link to="/grupos" className="mb-1 inline-flex items-center gap-1 text-xs text-muted hover:text-text">
                <ArrowLeft className="size-3" /> Grupos
              </Link>
            }
            title={g.name}
            subtitle={`${g.memberCount} membros · você é ${roleLabel[g.myRole].toLowerCase()}`}
            action={
              <div className="flex gap-2">
                {isAdmin && (
                  <Button onClick={() => setInviting(true)}>
                    <UserPlus className="size-4" /> Convidar
                  </Button>
                )}
                {isOwner && (
                  <Button variant="danger" onClick={() => setConfirm('delete')} aria-label="Excluir grupo">
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            }
          />
          <div className="mb-4">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { key: 'members', label: 'Membros' },
                { key: 'accounts', label: 'Contas' },
                { key: 'cards', label: 'Cartões' },
                { key: 'categories', label: 'Categorias' },
                ...(isAdmin ? [{ key: 'requests' as const, label: 'Solicitações', badge: pendingReqCount }] : []),
                { key: 'settings', label: 'Ajustes' },
              ]}
            />
          </div>

          {tab === 'members' && (
            <Card className="divide-y divide-border">
              {g.members.map((m) => (
                <div key={m.user.id} className="flex items-center gap-3 p-3">
                  <div className="grid size-10 place-items-center rounded-full bg-primary/20 text-xs font-bold text-primary-hover">
                    {initials(m.user)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{fullName(m.user)}</p>
                    <p className="truncate text-xs text-muted">{m.user.email}</p>
                  </div>
                  {canManage(m) && isOwner ? (
                    <Select
                      className="!h-9 !w-28 text-xs"
                      value={m.role}
                      onChange={(e) => setRole.mutate({ email: m.user.email, role: e.target.value as GroupRole })}
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="MEMBER">Membro</option>
                    </Select>
                  ) : (
                    <Badge tone={m.role === 'OWNER' ? 'primary' : 'default'}>{roleLabel[m.role]}</Badge>
                  )}
                  {canManage(m) && (
                    <button
                      onClick={() => setRemoving(m)}
                      className="p-1.5 text-muted hover:text-expense"
                      aria-label="Remover"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </Card>
          )}

          {tab === 'accounts' && (
            <QueryState isLoading={accounts.isLoading} error={accounts.error}>
              {!accounts.data?.length ? (
                <Empty title="Nenhuma conta vinculada. Vincule pela tela de Contas." />
              ) : (
                <Card className="divide-y divide-border">
                  {accounts.data.map((a) => (
                    <Link key={a.id} to={`/contas/${a.id}`} className="flex items-center justify-between gap-3 p-3 hover:bg-surface-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{a.name}</p>
                        <p className="truncate text-xs text-muted">
                          {accountTypeLabel[a.type]} · {fullName(a.owner)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold">{formatMoney(a.balance)}</p>
                    </Link>
                  ))}
                </Card>
              )}
            </QueryState>
          )}

          {tab === 'cards' && (
            <QueryState isLoading={cards.isLoading} error={cards.error}>
              {!cards.data?.length ? (
                <Empty title="Nenhum cartão vinculado. Vincule pela tela de Cartões." />
              ) : (
                <Card className="divide-y divide-border">
                  {cards.data.map((c) => (
                    <Link
                      key={c.id}
                      to={`/cartoes/${c.id}`}
                      className="flex items-center justify-between gap-3 p-3 hover:bg-surface-2"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary-hover">
                          <CardIcon className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{c.name}</p>
                          <p className="truncate text-xs text-muted">
                            Fecha dia {c.closingDay} · Vence dia {c.dueDay}
                            {c.owner ? ` · ${fullName(c.owner)}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted">Disponível</p>
                        <p className="text-sm font-semibold text-income">{formatMoney(c.availableLimit)}</p>
                      </div>
                    </Link>
                  ))}
                </Card>
              )}
            </QueryState>
          )}

          {tab === 'categories' && (
            <QueryState isLoading={categories.isLoading} error={categories.error}>
              <CategoryManager categories={categories.data ?? []} groupId={id} canEdit={isAdmin} />
            </QueryState>
          )}

          {tab === 'requests' && isAdmin && (
            <QueryState isLoading={requests.isLoading || cardRequests.isLoading} error={requests.error || cardRequests.error}>
              {!pendingReqCount ? (
                <Empty title="Sem solicitações pendentes." />
              ) : (
                <Card className="divide-y divide-border">
                  {requests.data?.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">Conta: {r.account.name}</p>
                        <p className="truncate text-xs text-muted">Solicitada por {fullName(r.requester)}</p>
                      </div>
                      <Button size="sm" onClick={() => acceptReq.mutate(r.id)}>
                        <Check className="size-4" />
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => rejectReq.mutate(r.id)}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))}
                  {cardRequests.data?.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">Cartão: {r.creditCard.name}</p>
                        <p className="truncate text-xs text-muted">Solicitado por {fullName(r.requester)}</p>
                      </div>
                      <Button size="sm" onClick={() => acceptCardReq.mutate(r.id)}>
                        <Check className="size-4" />
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => rejectCardReq.mutate(r.id)}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))}
                </Card>
              )}
            </QueryState>
          )}

          {tab === 'settings' && (
            <div className="space-y-4">
              {isAdmin && (
                <Card className="p-4">
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (renameTo?.trim()) rename.mutate(renameTo.trim())
                    }}
                  >
                    <Field label="Renomear grupo">
                      <Input value={renameTo ?? g.name} onChange={(e) => setRenameTo(e.target.value)} />
                    </Field>
                    <Button
                      type="submit"
                      variant="outline"
                      loading={rename.isPending}
                      disabled={renameTo === undefined || renameTo === g.name}
                    >
                      Salvar nome
                    </Button>
                  </form>
                </Card>
              )}
              {isOwner && (
                <Card className="p-4">
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (transferTo) transfer.mutate(transferTo)
                    }}
                  >
                    <Field label="Transferir propriedade" hint="Você passará a ser admin.">
                      <Select value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                        <option value="">Selecione um membro…</option>
                        {g.members
                          .filter((m) => m.role !== 'OWNER')
                          .map((m) => (
                            <option key={m.user.id} value={m.user.email}>
                              {fullName(m.user)} ({m.user.email})
                            </option>
                          ))}
                      </Select>
                    </Field>
                    <Button type="submit" variant="outline" loading={transfer.isPending} disabled={!transferTo}>
                      Transferir
                    </Button>
                  </form>
                </Card>
              )}
              <Card className="space-y-2 p-4">
                {!isOwner && (
                  <Button variant="danger" className="w-full" onClick={() => setConfirm('leave')}>
                    <LogOut className="size-4" /> Sair do grupo
                  </Button>
                )}
                {isOwner && (
                  <Button variant="danger" className="w-full" onClick={() => setConfirm('delete')}>
                    <Trash2 className="size-4" /> Excluir grupo
                  </Button>
                )}
                {isOwner && <p className="text-xs text-muted">Para sair, transfira a propriedade antes.</p>}
              </Card>
            </div>
          )}

          <Modal open={inviting} onClose={() => setInviting(false)} title="Convidar membro">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                invite.mutate(email.trim())
              }}
            >
              <Field label="E-mail">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              </Field>
              <Button type="submit" className="w-full" loading={invite.isPending}>
                Enviar convite
              </Button>
            </form>
          </Modal>
          <ConfirmDialog
            open={!!removing}
            onClose={() => setRemoving(undefined)}
            title="Remover membro"
            message={`Remover ${removing ? fullName(removing.user) : ''} do grupo?`}
            confirmLabel="Remover"
            loading={remove.isPending}
            onConfirm={() => removing && remove.mutate(removing.user.email)}
          />
          <ConfirmDialog
            open={!!confirm}
            onClose={() => setConfirm(undefined)}
            title={confirm === 'delete' ? 'Excluir grupo' : 'Sair do grupo'}
            message={confirm === 'delete' ? 'Essa ação não pode ser desfeita.' : 'Você perderá acesso ao grupo.'}
            confirmLabel={confirm === 'delete' ? 'Excluir' : 'Sair'}
            loading={leave.isPending || del.isPending}
            onConfirm={() => (confirm === 'delete' ? del.mutate() : leave.mutate())}
          />
        </>
      )}
    </QueryState>
  )
}
