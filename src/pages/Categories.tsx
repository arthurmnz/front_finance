import { useState } from 'react'
import { useGroupCategories, useGroups, useMyCategories } from '@/lib/hooks'
import { PageHeader, QueryState, Select, Tabs } from '@/components/ui'
import CategoryManager from '@/components/CategoryManager'

export default function Categories() {
  const [tab, setTab] = useState<'me' | 'group'>('me')
  const [groupId, setGroupId] = useState('')
  const mine = useMyCategories()
  const groups = useGroups().data ?? []
  const gid = groupId || groups[0]?.id
  const group = useGroupCategories(tab === 'group' ? gid : undefined)
  const myRole = groups.find((g) => g.id === gid)?.myRole

  return (
    <>
      <PageHeader title="Categorias" />
      <div className="mb-4"><Tabs value={tab} onChange={setTab} tabs={[{ key: 'me', label: 'Minhas' }, { key: 'group', label: 'Dos grupos' }]} /></div>
      {tab === 'me' ? (
        <QueryState isLoading={mine.isLoading} error={mine.error}><CategoryManager categories={mine.data ?? []} /></QueryState>
      ) : !groups.length ? (
        <p className="py-10 text-center text-sm text-muted">Você não participa de nenhum grupo.</p>
      ) : (
        <>
          <div className="mb-3"><Select value={gid} onChange={(e) => setGroupId(e.target.value)}>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select></div>
          <QueryState isLoading={group.isLoading} error={group.error}>
            <CategoryManager categories={group.data ?? []} groupId={gid} canEdit={myRole === 'OWNER' || myRole === 'ADMIN'} />
          </QueryState>
        </>
      )}
    </>
  )
}
