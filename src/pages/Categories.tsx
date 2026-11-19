import { useState } from 'react'
import { useGroupCategories, useGroups, useMyCategories } from '@/lib/hooks'
import { Empty, Field, PageHeader, QueryState, Select, Tabs } from '@/components/ui'
import CategoryManager from '@/components/CategoryManager'

export default function Categories() {
  const [tab, setTab] = useState<'me' | 'group'>('me')
  const [groupId, setGroupId] = useState('')
  const mine = useMyCategories()
  const groupsQuery = useGroups()
  const groups = groupsQuery.data ?? []
  const gid = groupId || groups[0]?.id
  const group = useGroupCategories(tab === 'group' ? gid : undefined)
  const myRole = groups.find((g) => g.id === gid)?.myRole

  return (
    <div className="min-w-0">
      <PageHeader
        title="Categorias"
        subtitle="Organize seus lançamentos em categorias gerais e subcategorias específicas."
      />
      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'me', label: 'Minhas categorias' },
            { key: 'group', label: 'Categorias do grupo' },
          ]}
        />
      </div>
      {tab === 'me' ? (
        <QueryState isLoading={mine.isLoading} error={mine.error}>
          <CategoryManager categories={mine.data ?? []} />
        </QueryState>
      ) : (
        <QueryState isLoading={groupsQuery.isLoading} error={groupsQuery.error}>
          {!groups.length ? (
            <Empty title="Você não participa de nenhum grupo." />
          ) : (
            <>
              <div className="mb-4 w-full sm:max-w-xs">
                <Field label="Grupo">
                  <Select
                    aria-label="Selecionar grupo"
                    value={gid}
                    onChange={(e) => setGroupId(e.target.value)}
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <QueryState isLoading={group.isLoading} error={group.error}>
                <CategoryManager
                  categories={group.data ?? []}
                  groupId={gid}
                  canEdit={myRole === 'OWNER' || myRole === 'ADMIN'}
                />
              </QueryState>
            </>
          )}
        </QueryState>
      )}
    </div>
  )
}
