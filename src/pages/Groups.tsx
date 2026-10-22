import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, ChevronRight, Plus, Trash2, UsersRound, X } from 'lucide-react'
import { api } from '@/lib/api'
import { useAction, useGroupInvitations, useGroups } from '@/lib/hooks'
import type { Group, GroupSummary } from '@/lib/types'
import { roleLabel } from '@/lib/format'
import { Badge, Button, Card, ConfirmDialog, Empty, Field, Input, Modal, PageHeader, QueryState } from '@/components/ui'

export default function Groups() {
  const nav = useNavigate()
  const groups = useGroups()
  const invites = useGroupInvitations()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [deleting, setDeleting] = useState<GroupSummary>()

  const create = useAction((n: string) => api.post<Group>('/groups', { name: n }).then((r) => r.data), {
    invalidate: [['groups']], success: 'Grupo criado', onSuccess: (g) => { setCreating(false); setName(''); nav(`/grupos/${g.id}`) },
  })
  const del = useAction((id: string) => api.delete(`/groups/${id}`), { invalidate: [['groups'], ['accounts']], success: 'Grupo excluído', onSuccess: () => setDeleting(undefined) })
  const accept = useAction((id: string) => api.post(`/groups/invitations/${id}/accept`), { invalidate: [['groups'], ['group-invitations']], success: 'Convite aceito' })
  const reject = useAction((id: string) => api.post(`/groups/invitations/${id}/reject`), { invalidate: [['group-invitations']], success: 'Convite recusado' })

  return (
    <>
      <PageHeader title="Grupos" action={<Button onClick={() => setCreating(true)}><Plus className="size-4" /> Novo</Button>} />

      {!!invites.data?.length && (
        <Card className="mb-4 border-primary/40 p-4">
          <h2 className="mb-2 text-sm font-semibold">Convites pendentes</h2>
          <div className="divide-y divide-border">
            {invites.data.map((i) => (
              <div key={i.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{i.group.name}</p><p className="truncate text-xs text-muted">Convidado por {i.inviter.firstName} ({i.inviter.email})</p></div>
                <Button size="sm" onClick={() => accept.mutate(i.id)}><Check className="size-4" /></Button>
                <Button size="sm" variant="danger" onClick={() => reject.mutate(i.id)}><X className="size-4" /></Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <QueryState isLoading={groups.isLoading} error={groups.error}>
        {!groups.data?.length ? <Empty title="Você não participa de nenhum grupo." icon={<UsersRound className="size-10" />} /> : (
          <Card className="divide-y divide-border">
            {groups.data.map((g) => (
              <div key={g.id} className="flex items-center hover:bg-surface-2">
                <Link to={`/grupos/${g.id}`} className="flex min-w-0 flex-1 items-center gap-3 p-4">
                  <div className="grid size-11 place-items-center rounded-xl bg-primary/15 text-primary-hover"><UsersRound className="size-5" /></div>
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{g.name}</p><p className="text-xs text-muted">{g.memberCount} {g.memberCount === 1 ? 'membro' : 'membros'}</p></div>
                  <Badge tone={g.myRole === 'OWNER' ? 'primary' : 'default'}>{roleLabel[g.myRole]}</Badge>
                  <ChevronRight className="size-4 text-muted" />
                </Link>
                {g.myRole === 'OWNER' && (
                  <button onClick={() => setDeleting(g)} className="mr-2 rounded-lg p-2.5 text-muted hover:text-expense" aria-label="Excluir grupo"><Trash2 className="size-4" /></button>
                )}
              </div>
            ))}
          </Card>
        )}
      </QueryState>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(undefined)} title="Excluir grupo" confirmLabel="Excluir" loading={del.isPending}
        message={`Excluir "${deleting?.name}"? Todos os membros serão removidos. Essa ação não pode ser desfeita.`} onConfirm={() => deleting && del.mutate(deleting.id)} />
      <Modal open={creating} onClose={() => setCreating(false)} title="Novo grupo">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(name.trim()) }}>
          <Field label="Nome do grupo"><Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></Field>
          <Button type="submit" className="w-full" loading={create.isPending}>Criar</Button>
        </form>
      </Modal>
    </>
  )
}
