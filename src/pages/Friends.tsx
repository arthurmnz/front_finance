import { useState } from 'react'
import { Ban, Check, UserPlus, Users, X } from 'lucide-react'
import { api } from '@/lib/api'
import { useAction, useFriendships, usePendingReceived, usePendingSent } from '@/lib/hooks'
import { useAuth } from '@/lib/auth'
import type { Friendship } from '@/lib/types'
import { fullName, initials } from '@/lib/format'
import { Button, Card, Empty, Field, Input, Modal, PageHeader, QueryState, Tabs } from '@/components/ui'

type Tab = 'friends' | 'received' | 'sent' | 'blocked'
const INV = [['friendships']]

export default function Friends() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('friends')
  const [adding, setAdding] = useState(false)
  const [email, setEmail] = useState('')
  const friends = useFriendships('ACCEPTED')
  const blocked = useFriendships('BLOCKED')
  const received = usePendingReceived()
  const sent = usePendingSent()

  const send = useAction((e: string) => api.post('/friendships', { addresseeEmail: e }), { invalidate: INV, success: 'Pedido enviado', onSuccess: () => { setAdding(false); setEmail(''); setTab('sent') } })
  const act = (verb: 'accept' | 'reject' | 'block', msg: string) => useAction((id: string) => api.post(`/friendships/${id}/${verb}`), { invalidate: INV, success: msg })
  const accept = act('accept', 'Amizade aceita')
  const reject = act('reject', 'Pedido recusado')
  const block = act('block', 'Usuário bloqueado')

  const other = (f: Friendship) => (f.requester.id === user?.id ? f.addressee : f.requester)
  const current = { friends, received, sent, blocked }[tab]

  const Row = ({ f }: { f: Friendship }) => {
    const u = other(f)
    return (
      <div className="flex items-center gap-3 p-3">
        <div className="grid size-10 place-items-center rounded-full bg-primary/20 text-xs font-bold text-primary-hover">{initials(u)}</div>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{fullName(u)}</p><p className="truncate text-xs text-muted">{u.email}</p></div>
        {tab === 'received' && (<>
          <Button size="sm" onClick={() => accept.mutate(f.id)}><Check className="size-4" /></Button>
          <Button size="sm" variant="danger" onClick={() => reject.mutate(f.id)}><X className="size-4" /></Button>
        </>)}
        {tab === 'friends' && <Button size="sm" variant="ghost" title="Bloquear" onClick={() => block.mutate(f.id)}><Ban className="size-4" /> Bloquear</Button>}
        {tab === 'sent' && <span className="text-xs text-muted">Aguardando</span>}
      </div>
    )
  }

  return (
    <>
      <PageHeader title="Amigos" action={<Button onClick={() => setAdding(true)}><UserPlus className="size-4" /> Adicionar</Button>} />
      <div className="mb-4">
        <Tabs value={tab} onChange={setTab} tabs={[
          { key: 'friends', label: 'Amigos' }, { key: 'received', label: 'Recebidos', badge: received.data?.length },
          { key: 'sent', label: 'Enviados' }, { key: 'blocked', label: 'Bloqueados' }]} />
      </div>
      <QueryState isLoading={current.isLoading} error={current.error}>
        {!current.data?.length ? <Empty title="Nada por aqui." icon={<Users className="size-10" />} /> : (
          <Card className="divide-y divide-border">{current.data.map((f) => <Row key={f.id} f={f} />)}</Card>
        )}
      </QueryState>
      <Modal open={adding} onClose={() => setAdding(false)} title="Adicionar amigo">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); send.mutate(email.trim()) }}>
          <Field label="E-mail do amigo"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></Field>
          <Button type="submit" className="w-full" loading={send.isPending}>Enviar pedido</Button>
        </form>
      </Modal>
    </>
  )
}
