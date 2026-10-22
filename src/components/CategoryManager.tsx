import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAction } from '@/lib/hooks'
import type { Category, CategoryInput, CategoryType } from '@/lib/types'
import { categoryTypeLabel } from '@/lib/format'
import { Badge, Button, Card, ConfirmDialog, Empty, Field, Input, Modal, Select, Textarea } from './ui'

const COLORS = ['#6366f1', '#f87171', '#34d399', '#fbbf24', '#38bdf8', '#e879f9', '#fb923c', '#a3e635']
const keys = (groupId?: string) => [groupId ? ['categories', 'group', groupId] : ['categories', 'me']]

function CategoryForm({ open, onClose, category, groupId }: { open: boolean; onClose: () => void; category?: Category; groupId?: string }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<CategoryType>('EXPENSE')
  const [color, setColor] = useState(COLORS[0])
  const [icon, setIcon] = useState('')

  useEffect(() => {
    if (!open) return
    setName(category?.name ?? ''); setDescription(category?.description ?? ''); setType(category?.type ?? 'EXPENSE')
    setColor(category?.color ?? COLORS[0]); setIcon(category?.icon ?? '')
  }, [open, category])

  const save = useAction(
    (b: CategoryInput) => (category ? api.put(`/categories/${category.id}`, b) : api.post('/categories', b)),
    { invalidate: keys(groupId), success: category ? 'Categoria atualizada' : 'Categoria criada', onSuccess: onClose },
  )

  return (
    <Modal open={open} onClose={onClose} title={category ? 'Editar categoria' : 'Nova categoria'}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate({ name: name.trim(), description: description || null, type, color, icon: icon || null, groupId: groupId ?? null }) }}>
        <Field label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></Field>
        <Field label="Descrição"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Tipo">
          <Select value={type} onChange={(e) => setType(e.target.value as CategoryType)}>
            {Object.entries(categoryTypeLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Ícone (emoji)"><Input value={icon} maxLength={4} placeholder="🍔" onChange={(e) => setIcon(e.target.value)} /></Field>
        <Field label="Cor">
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button type="button" key={c} onClick={() => setColor(c)} style={{ background: c }}
                className={`size-9 rounded-full ring-offset-2 ring-offset-surface ${color === c ? 'ring-2 ring-white' : ''}`} aria-label={c} />
            ))}
          </div>
        </Field>
        <Button type="submit" className="w-full" loading={save.isPending}>Salvar</Button>
      </form>
    </Modal>
  )
}

/** Lista + CRUD de categorias (pessoais ou de um grupo). */
export default function CategoryManager({ categories, groupId, canEdit = true }: { categories: Category[]; groupId?: string; canEdit?: boolean }) {
  const [form, setForm] = useState<{ open: boolean; category?: Category }>({ open: false })
  const [deleting, setDeleting] = useState<Category>()
  const del = useAction((id: string) => api.delete(`/categories/${id}`), { invalidate: keys(groupId), success: 'Categoria excluída', onSuccess: () => setDeleting(undefined) })

  return (
    <>
      {canEdit && <div className="mb-3 flex justify-end"><Button size="sm" onClick={() => setForm({ open: true })}><Plus className="size-4" /> Nova categoria</Button></div>}
      {!categories.length ? <Empty title="Nenhuma categoria." icon={<Tags className="size-10" />} /> : (
        <Card className="divide-y divide-border">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-3">
              <Link to={`/categorias/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl text-lg" style={{ background: `${c.color ?? '#6366f1'}33` }}>{c.icon || <span className="size-3 rounded-full" style={{ background: c.color ?? '#6366f1' }} />}</div>
                <div className="min-w-0"><p className="truncate text-sm font-medium">{c.name}</p>{c.description && <p className="truncate text-xs text-muted">{c.description}</p>}</div>
              </Link>
              <Badge tone={c.type === 'INCOME' ? 'income' : c.type === 'EXPENSE' ? 'expense' : 'default'}>{categoryTypeLabel[c.type]}</Badge>
              {canEdit && (
                <div className="flex">
                  <button onClick={() => setForm({ open: true, category: c })} className="p-1.5 text-muted hover:text-text" aria-label="Editar"><Pencil className="size-4" /></button>
                  <button onClick={() => setDeleting(c)} className="p-1.5 text-muted hover:text-expense" aria-label="Excluir"><Trash2 className="size-4" /></button>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
      <CategoryForm open={form.open} category={form.category} groupId={groupId} onClose={() => setForm({ open: false })} />
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(undefined)} title="Excluir categoria" message={`Excluir "${deleting?.name}"?`}
        confirmLabel="Excluir" loading={del.isPending} onConfirm={() => deleting && del.mutate(deleting.id)} />
    </>
  )
}
