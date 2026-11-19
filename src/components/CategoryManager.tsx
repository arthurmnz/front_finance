import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  ExternalLink,
  FolderTree,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Tags,
  Trash2,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/lib/api'
import {
  buildCategoryTree,
  isChildTypeAllowed,
  isGeneralCategory,
} from '@/lib/categories'
import { useAction, useSeedDefaultCategories } from '@/lib/hooks'
import type { Category, CategoryInput, CategoryLevel, CategoryType } from '@/lib/types'
import { categoryTypeLabel } from '@/lib/format'
import { PALETTE, normalizeCategoryColor } from '@/lib/palette'
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Empty,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from './ui'
import { toast } from 'sonner'

const categoryKeys = (groupId?: string) => [
  ['categories'],
  groupId ? ['categories', 'group', groupId] : ['categories', 'me'],
]

type TypeFilter = 'ALL' | CategoryType

const filterChip = (active: boolean) =>
  clsx(
    'inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-1.5 text-xs font-medium transition cursor-pointer select-none active:scale-[0.98] sm:min-h-8',
    active
      ? 'border-violet bg-violet text-white font-semibold shadow-sm shadow-violet/25'
      : 'border-border bg-surface-1/60 text-text-muted hover:bg-surface-2 hover:text-white',
  )

interface CategoryFormProps {
  open: boolean
  onClose: () => void
  category?: Category
  categories: Category[]
  groupId?: string
  initialLevel?: CategoryLevel
  initialParentId?: string
  onSaved?: (saved: Category) => void
}

function CategoryForm({
  open,
  onClose,
  category,
  categories,
  groupId,
  initialLevel = 'GENERAL',
  initialParentId = '',
  onSaved,
}: CategoryFormProps) {
  const [level, setLevel] = useState<CategoryLevel>('GENERAL')
  const [parentId, setParentId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<CategoryType>('EXPENSE')
  const [color, setColor] = useState<string>(PALETTE[0])
  const [icon, setIcon] = useState('')
  const [colorTouched, setColorTouched] = useState(false)
  const [nameError, setNameError] = useState('')
  const [parentError, setParentError] = useState('')
  const [levelBlockedMsg, setLevelBlockedMsg] = useState('')

  const generalParents = useMemo(
    () =>
      categories
        .filter((c) => isGeneralCategory(c) && c.id !== category?.id)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [categories, category?.id],
  )

  const editingChildCount = useMemo(() => {
    if (!category || !isGeneralCategory(category)) return 0
    return categories.filter((c) => c.parentId === category.id).length
  }, [categories, category])

  useEffect(() => {
    if (!open) return
    const nextLevel: CategoryLevel = category
      ? isGeneralCategory(category)
        ? 'GENERAL'
        : 'SPECIFIC'
      : initialLevel
    const defaultParentId = category
      ? category.parentId ?? ''
      : initialParentId || (nextLevel === 'SPECIFIC' ? generalParents[0]?.id ?? '' : '')
    const defaultParent = generalParents.find((p) => p.id === defaultParentId)

    setLevel(nextLevel)
    setParentId(defaultParentId)
    setName(category?.name ?? '')
    setDescription(category?.description ?? '')
    const initialType: CategoryType = category
      ? category.type
      : nextLevel === 'SPECIFIC' && defaultParent && defaultParent.type !== 'BOTH'
        ? defaultParent.type
        : 'EXPENSE'
    setType(initialType)
    const initialColor = category
      ? normalizeCategoryColor(category.color)
      : nextLevel === 'SPECIFIC' && defaultParent?.color
        ? normalizeCategoryColor(defaultParent.color)
        : PALETTE[0]
    setColor(initialColor)
    setIcon(category?.icon ?? '')
    setColorTouched(Boolean(category))
    setNameError('')
    setParentError('')
    setLevelBlockedMsg('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category?.id, initialLevel, initialParentId])

  const selectedParent = useMemo(
    () => generalParents.find((p) => p.id === parentId),
    [generalParents, parentId],
  )

  const isTypeLockedByParent = level === 'SPECIFIC' && Boolean(selectedParent && selectedParent.type !== 'BOTH')

  const handleLevelChange = (next: CategoryLevel) => {
    if (next === level) return
    if (next === 'SPECIFIC' && editingChildCount > 0) {
      setLevelBlockedMsg(
        `Esta categoria geral possui ${editingChildCount} categoria(s) específica(s) vinculada(s). Exclua ou reatribua as subcategorias antes de convertê-la em específica.`,
      )
      return
    }
    setLevelBlockedMsg('')
    setParentError('')
    setLevel(next)
    if (next === 'SPECIFIC') {
      const targetParentId = parentId || generalParents[0]?.id || ''
      setParentId(targetParentId)
      const p = generalParents.find((g) => g.id === targetParentId)
      if (p) {
        if (p.type !== 'BOTH' && !isChildTypeAllowed(type, p.type)) {
          setType(p.type)
        }
        if (!category && !colorTouched && p.color) {
          setColor(normalizeCategoryColor(p.color))
        }
      }
    }
  }

  const handleParentChange = (nextParentId: string) => {
    setParentId(nextParentId)
    setParentError('')
    const p = generalParents.find((g) => g.id === nextParentId)
    if (!p) return
    if (p.type !== 'BOTH') {
      setType(p.type)
    }
    if (!category && !colorTouched && p.color) {
      setColor(normalizeCategoryColor(p.color))
    }
  }

  const save = useAction<CategoryInput, Category>(
    (b) =>
      category
        ? api.put<Category>(`/categories/${category.id}`, b).then((r) => r.data)
        : api.post<Category>('/categories', b).then((r) => r.data),
    {
      invalidate: categoryKeys(groupId),
      success: category ? 'Categoria atualizada' : 'Categoria criada',
      onSuccess: (saved) => {
        onSaved?.(saved)
        onClose()
      },
    },
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    let hasError = false

    if (!trimmedName) {
      setNameError('Informe o nome da categoria.')
      hasError = true
    } else {
      setNameError('')
    }

    if (level === 'SPECIFIC' && editingChildCount > 0) {
      setLevelBlockedMsg(
        `Esta categoria geral possui ${editingChildCount} subcategoria(s). Remova-as antes de converter para específica.`,
      )
      return
    }

    if (level === 'SPECIFIC' && !parentId) {
      setParentError('Selecione a categoria geral pai.')
      hasError = true
    } else {
      setParentError('')
    }

    if (hasError) return

    const finalType: CategoryType =
      level === 'SPECIFIC' && selectedParent && selectedParent.type !== 'BOTH'
        ? selectedParent.type
        : type

    save.mutate({
      name: trimmedName,
      description: description.trim() || null,
      type: finalType,
      level,
      parentId: level === 'SPECIFIC' ? parentId : null,
      color,
      icon: icon.trim() || null,
      groupId: groupId ?? null,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? 'Editar categoria' : level === 'SPECIFIC' ? 'Nova categoria específica' : 'Nova categoria geral'}
    >
      <form noValidate className="space-y-4" onSubmit={handleSubmit}>
        <Field label="Nível da categoria">
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-surface-2 p-1 border border-border">
            <button
              type="button"
              aria-pressed={level === 'GENERAL'}
              onClick={() => handleLevelChange('GENERAL')}
              className={clsx(
                'flex min-h-11 flex-col items-center justify-center rounded-lg px-2 py-1.5 text-center transition-all duration-150 cursor-pointer select-none',
                level === 'GENERAL'
                  ? 'bg-violet text-white font-semibold shadow-sm shadow-violet/25'
                  : 'text-text-muted hover:text-white',
              )}
            >
              <span className="text-xs font-semibold leading-tight">Geral</span>
              <span
                className={clsx(
                  'mt-0.5 text-[10px] leading-tight',
                  level === 'GENERAL' ? 'text-white/80' : 'text-text-dim',
                )}
              >
                Categoria pai
              </span>
            </button>
            <button
              type="button"
              aria-pressed={level === 'SPECIFIC'}
              onClick={() => handleLevelChange('SPECIFIC')}
              className={clsx(
                'flex min-h-11 flex-col items-center justify-center rounded-lg px-2 py-1.5 text-center transition-all duration-150 cursor-pointer select-none',
                level === 'SPECIFIC'
                  ? 'bg-violet text-white font-semibold shadow-sm shadow-violet/25'
                  : 'text-text-muted hover:text-white',
                editingChildCount > 0 && 'opacity-50',
              )}
            >
              <span className="text-xs font-semibold leading-tight">Específica</span>
              <span
                className={clsx(
                  'mt-0.5 text-[10px] leading-tight',
                  level === 'SPECIFIC' ? 'text-white/80' : 'text-text-dim',
                )}
              >
                Subcategoria
              </span>
            </button>
          </div>
        </Field>

        {levelBlockedMsg && (
          <Alert tone="info">{levelBlockedMsg}</Alert>
        )}

        {level === 'SPECIFIC' && (
          <Field
            label="Categoria geral (pai)"
            error={parentError}
            hint={!generalParents.length ? 'Nenhuma categoria geral disponível. Crie ou restaure uma categoria geral primeiro.' : undefined}
          >
            <Select
              value={parentId}
              onChange={(e) => handleParentChange(e.target.value)}
              disabled={!generalParents.length}
              required
            >
              <option value="">Selecione a categoria geral…</option>
              {generalParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.icon ? `${p.icon} ` : ''}
                  {p.name} ({categoryTypeLabel[p.type]})
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Nome" error={nameError}>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (nameError) setNameError('')
            }}
            required
            autoFocus
            className="text-base sm:text-sm"
            placeholder={level === 'GENERAL' ? 'Ex.: Moradia, Transporte, Renda…' : 'Ex.: Aluguel, Energia, Uber…'}
          />
        </Field>

        <Field label="Descrição">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="text-base sm:text-sm"
            placeholder="Descrição opcional…"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Tipo da categoria"
            hint={
              isTypeLockedByParent && selectedParent
                ? `Sincronizado com "${selectedParent.name}" (${categoryTypeLabel[selectedParent.type]}).`
                : level === 'SPECIFIC' && selectedParent?.type === 'BOTH'
                  ? 'A categoria geral aceita ambos os tipos; escolha Despesa, Receita ou Ambos.'
                  : undefined
            }
          >
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as CategoryType)}
              disabled={isTypeLockedByParent}
            >
              {Object.entries(categoryTypeLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Ícone (emoji)">
            <Input
              value={icon}
              maxLength={4}
              className="text-base sm:text-sm"
              placeholder={level === 'GENERAL' ? '🏠' : '🔑'}
              onChange={(e) => setIcon(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Cor">
          <div className="grid grid-cols-4 justify-items-start gap-3 pt-1 sm:flex sm:flex-wrap sm:gap-2.5">
            {PALETTE.map((c) => {
              const isSelected = color.toLowerCase() === c.toLowerCase()
              return (
                <button
                  type="button"
                  key={c}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setColor(c)
                    setColorTouched(true)
                  }}
                  style={{ background: c }}
                  className={clsx(
                    'size-10 rounded-full transition-transform cursor-pointer sm:size-8',
                    isSelected
                      ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-surface-1'
                      : 'hover:scale-105',
                  )}
                  aria-label={`Cor ${c}`}
                />
              )
            })}
          </div>
        </Field>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={save.isPending}
            className="w-full sm:w-auto sm:min-w-28"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="w-full sm:flex-1"
            loading={save.isPending}
            disabled={level === 'SPECIFIC' && !generalParents.length}
          >
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** Lista hierárquica de 2 níveis (Gerais + Específicas) e CRUD de categorias (pessoais ou de um grupo). */
export default function CategoryManager({
  categories,
  groupId,
  canEdit = true,
}: {
  categories: Category[]
  groupId?: string
  canEdit?: boolean
}) {
  const [form, setForm] = useState<{
    open: boolean
    category?: Category
    initialLevel?: CategoryLevel
    initialParentId?: string
  }>({ open: false })
  const [deleting, setDeleting] = useState<{ category: Category; childCount: number }>()
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL')
  const [search, setSearch] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())

  const seedDefaults = useSeedDefaultCategories(groupId)

  const scopedCategories = useMemo(
    () => (groupId ? categories.filter((c) => c.groupId === groupId) : categories),
    [categories, groupId],
  )

  const del = useAction((id: string) => api.delete(`/categories/${id}`), {
    invalidate: categoryKeys(groupId),
    success: 'Categoria excluída',
    onSuccess: () => setDeleting(undefined),
  })

  const tree = useMemo(() => buildCategoryTree(scopedCategories), [scopedCategories])
  const hasGeneral = useMemo(() => scopedCategories.some((c) => isGeneralCategory(c)), [scopedCategories])

  const filteredTree = useMemo(() => {
    const term = search.trim().toLowerCase()

    const matchesType = (cat: Category) => {
      if (typeFilter === 'ALL') return true
      if (typeFilter === 'BOTH') return cat.type === 'BOTH'
      return cat.type === typeFilter || cat.type === 'BOTH'
    }

    return tree
      .map((node) => {
        const typeChildren = node.children.filter(matchesType)
        const generalMatchesType = matchesType(node.general)

        if (typeFilter !== 'ALL' && !generalMatchesType && typeChildren.length === 0) {
          return null
        }

        if (!term) {
          return {
            general: node.general,
            children: typeChildren,
            autoExpand: false,
          }
        }

        const generalMatchesSearch =
          node.general.name.toLowerCase().includes(term) ||
          (node.general.description ?? '').toLowerCase().includes(term)

        const searchChildren = typeChildren.filter(
          (sub) =>
            sub.name.toLowerCase().includes(term) ||
            (sub.description ?? '').toLowerCase().includes(term),
        )

        if (!generalMatchesSearch && searchChildren.length === 0) {
          return null
        }

        return {
          general: node.general,
          children: generalMatchesSearch && searchChildren.length === 0 ? typeChildren : searchChildren,
          autoExpand: searchChildren.length > 0,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  }, [tree, typeFilter, search])

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allExpanded =
    filteredTree.length > 0 && filteredTree.every((n) => expandedIds.has(n.general.id) || n.autoExpand)

  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedIds(new Set())
    } else {
      setExpandedIds(new Set(filteredTree.map((n) => n.general.id)))
    }
  }

  const openNewSpecific = (parentId?: string) => {
    if (!hasGeneral) {
      toast.error('Crie uma categoria geral primeiro (ou restaure os padrões).')
      return
    }
    setForm({
      open: true,
      initialLevel: 'SPECIFIC',
      initialParentId: parentId,
    })
  }

  const seedButtonLabel = groupId ? 'Gerar padrões do grupo' : 'Restaurar padrões'

  return (
    <div className="min-w-0 space-y-4">
      {/* Barra de ações no topo */}
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2 lg:justify-between">
          <Button
            size="sm"
            onClick={() => setForm({ open: true, initialLevel: 'GENERAL' })}
            className="h-10 min-h-10 flex-1 whitespace-nowrap px-3 lg:order-3 lg:h-9 lg:min-h-9 lg:flex-initial"
          >
            <Plus className="size-4 shrink-0" />
            <span>Nova categoria geral</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openNewSpecific()}
            className="h-10 min-h-10 flex-1 whitespace-nowrap px-3 lg:order-2 lg:h-9 lg:min-h-9 lg:flex-initial"
          >
            <Plus className="size-4 shrink-0" />
            <span>Nova específica</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            loading={seedDefaults.isPending}
            onClick={() => seedDefaults.mutate()}
            className="h-10 min-h-10 w-full whitespace-nowrap px-3 lg:order-1 lg:mr-auto lg:h-9 lg:min-h-9 lg:w-auto"
          >
            <RotateCcw className="size-3.5 shrink-0" />
            <span>{seedButtonLabel}</span>
          </Button>
        </div>
      ) : (
        groupId &&
        scopedCategories.length > 0 && (
          <Alert tone="neutral">
            Apenas administradores do grupo podem criar, editar ou excluir categorias.
          </Alert>
        )
      )}

      {/* Barra de filtro por tipo + busca por nome */}
      {scopedCategories.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:order-2 lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-dim" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar categoria…"
                aria-label="Buscar categoria"
                className="h-10 min-h-10 pl-9 pr-10 text-base sm:h-9 sm:min-h-9 sm:text-xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Limpar busca"
                  className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-text-dim hover:bg-surface-2 hover:text-white transition cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <div
              role="group"
              aria-label="Filtrar por tipo de categoria"
              className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center lg:order-1"
            >
              {(
                [
                  { key: 'ALL', label: 'Todas' },
                  { key: 'EXPENSE', label: 'Despesas' },
                  { key: 'INCOME', label: 'Receitas' },
                  { key: 'BOTH', label: 'Ambos' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  aria-pressed={typeFilter === opt.key}
                  className={filterChip(typeFilter === opt.key)}
                  onClick={() => setTypeFilter(opt.key)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {filteredTree.length > 0 && (
            <div className="flex items-center justify-between gap-2 px-0.5">
              <p className="text-xs text-text-dim tabular-nums">
                {filteredTree.length} {filteredTree.length === 1 ? 'categoria geral' : 'categorias gerais'}
              </p>
              {filteredTree.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={toggleExpandAll}
                  className="!h-8 !min-h-8 px-2.5 text-xs"
                >
                  {allExpanded ? 'Recolher tudo' : 'Expandir tudo'}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Conteúdo */}
      {!scopedCategories.length ? (
        <Card className="p-4 sm:p-6">
          <Empty
            title="Nenhuma categoria cadastrada."
            icon={<Tags className="size-8" />}
          >
            <p className="mb-4 text-xs text-text-dim">
              Organize seus lançamentos em categorias gerais (ex.: Moradia, Renda) e subcategorias específicas (ex.: Aluguel, Energia).
            </p>
            {canEdit && (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
                <Button
                  size="sm"
                  variant="outline"
                  loading={seedDefaults.isPending}
                  onClick={() => seedDefaults.mutate()}
                  className="h-10 min-h-10 w-full sm:h-9 sm:min-h-9 sm:w-auto"
                >
                  <RotateCcw className="size-3.5" /> {seedButtonLabel}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setForm({ open: true, initialLevel: 'GENERAL' })}
                  className="h-10 min-h-10 w-full sm:h-9 sm:min-h-9 sm:w-auto"
                >
                  <Plus className="size-4" /> Criar categoria geral
                </Button>
              </div>
            )}
          </Empty>
        </Card>
      ) : !filteredTree.length ? (
        <Card className="p-4">
          <Empty
            title="Nenhuma categoria encontrada com esses filtros."
            icon={<FolderTree className="size-7" />}
          >
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setTypeFilter('ALL')
                setSearch('')
              }}
            >
              Limpar filtros
            </Button>
          </Empty>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTree.map(({ general, children, autoExpand }) => {
            const catColor = normalizeCategoryColor(general.color)
            const isExpanded = autoExpand || expandedIds.has(general.id)
            const totalChildrenInStore = scopedCategories.filter((c) => c.parentId === general.id).length
            const isSyntheticOrphan = general.id === '__orphan__'

            return (
              <Card key={general.id} className="overflow-hidden">
                <div className="p-3.5 transition-colors hover:bg-surface-2/35 sm:p-4">
                  <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center">
                      <button
                        type="button"
                        onClick={() => toggleExpand(general.id)}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? `Recolher ${general.name}` : `Expandir ${general.name}`}
                        className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl text-text-dim hover:bg-surface-2 hover:text-white transition cursor-pointer sm:mt-0 sm:size-8"
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-4 transition-transform duration-150" />
                        ) : (
                          <ChevronRight className="size-4 transition-transform duration-150" />
                        )}
                      </button>

                      <Link
                        to={isSyntheticOrphan ? '#' : `/categorias/${general.id}`}
                        className="flex min-w-0 flex-1 items-start gap-3 sm:items-center"
                        onClick={(e) => {
                          if (isSyntheticOrphan) e.preventDefault()
                        }}
                      >
                        <div
                          className="grid size-10 shrink-0 place-items-center rounded-xl text-lg"
                          style={{ background: `${catColor}25` }}
                        >
                          {general.icon || <span className="size-3 rounded-full" style={{ background: catColor }} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="min-w-0 break-words text-sm font-semibold leading-snug text-white">
                              {general.name}
                            </p>
                            {general.isDefault && (
                              <Badge tone="neutral" className="shrink-0 text-[10px] px-2 py-0">
                                Padrão
                              </Badge>
                            )}
                            <Badge
                              tone={general.type === 'INCOME' ? 'income' : general.type === 'BOTH' ? 'primary' : 'default'}
                              className="shrink-0 lg:hidden"
                            >
                              {categoryTypeLabel[general.type]}
                            </Badge>
                          </div>
                          <p className="mt-0.5 break-words text-xs text-text-dim tabular-nums line-clamp-2 sm:line-clamp-1">
                            {children.length} {children.length === 1 ? 'específica' : 'específicas'}
                            {general.description ? ` · ${general.description}` : ''}
                          </p>
                        </div>
                      </Link>
                    </div>

                    <div
                      className={clsx(
                        'flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2.5 lg:shrink-0 lg:justify-end lg:border-t-0 lg:pt-0',
                        isSyntheticOrphan ? 'hidden lg:flex' : 'flex',
                      )}
                    >
                      <Badge
                        tone={general.type === 'INCOME' ? 'income' : general.type === 'BOTH' ? 'primary' : 'default'}
                        className="hidden lg:inline-flex"
                      >
                        {categoryTypeLabel[general.type]}
                      </Badge>

                      {!isSyntheticOrphan && (
                        <>
                          {canEdit ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openNewSpecific(general.id)}
                                className="!h-9 !min-h-9 px-2.5 text-xs text-violet-hover hover:text-white lg:border-transparent lg:bg-transparent lg:shadow-none lg:hover:bg-surface-2"
                                title={`Adicionar específica em ${general.name}`}
                              >
                                <Plus className="size-3.5 shrink-0" />
                                <span>Específica</span>
                              </Button>

                              <div className="flex items-center gap-1">
                                <Link
                                  to={`/categorias/${general.id}`}
                                  className="grid size-9 place-items-center rounded-xl text-text-dim hover:bg-surface-2 hover:text-white transition lg:size-8"
                                  aria-label={`Ver detalhes de ${general.name}`}
                                  title="Ver detalhes"
                                >
                                  <ExternalLink className="size-4" />
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => setForm({ open: true, category: general })}
                                  className="grid size-9 place-items-center rounded-xl text-text-dim hover:bg-surface-2 hover:text-white transition cursor-pointer lg:size-8"
                                  aria-label={`Editar ${general.name}`}
                                  title="Editar"
                                >
                                  <Pencil className="size-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleting({ category: general, childCount: totalChildrenInStore })}
                                  className="grid size-9 place-items-center rounded-xl text-text-dim hover:bg-surface-2 hover:text-expense transition cursor-pointer lg:size-8"
                                  aria-label={`Excluir ${general.name}`}
                                  title="Excluir"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </div>
                            </>
                          ) : (
                            <Link
                              to={`/categorias/${general.id}`}
                              className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-text-muted hover:bg-surface-2 hover:text-white transition"
                            >
                              <span>Ver detalhes</span>
                              <ExternalLink className="size-3.5" />
                            </Link>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Lista indentada de subcategorias específicas */}
                {isExpanded && (
                  <div className="border-t border-border/70 bg-surface/60">
                    {!children.length ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-3 pl-4 text-xs text-text-dim sm:pl-12">
                        <span className="min-w-0">Nenhuma categoria específica vinculada a {general.name}.</span>
                        {canEdit && !isSyntheticOrphan && (
                          <button
                            type="button"
                            onClick={() => openNewSpecific(general.id)}
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 py-1 font-medium text-lime hover:bg-surface-2 hover:underline cursor-pointer"
                          >
                            <Plus className="size-3.5 shrink-0" /> Adicionar específica
                          </button>
                        )}
                      </div>
                    ) : (
                      <ul className="divide-y divide-border/50">
                        {children.map((sub) => {
                          const subColor = normalizeCategoryColor(sub.color ?? general.color)
                          return (
                            <li
                              key={sub.id}
                              className="flex flex-col gap-2 py-3 pl-3 pr-3 transition-colors hover:bg-surface-2/40 sm:flex-row sm:items-center sm:justify-between sm:gap-2.5 sm:py-2.5 sm:pl-8 md:flex-col md:items-stretch lg:flex-row lg:items-center lg:pl-12 lg:pr-4"
                            >
                              <div className="flex min-w-0 flex-1 items-start gap-2 sm:items-center sm:gap-2.5">
                                <CornerDownRight
                                  className="mt-2 size-3.5 shrink-0 text-text-faint sm:mt-0"
                                  aria-hidden="true"
                                />
                                <Link
                                  to={`/categorias/${sub.id}`}
                                  className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center"
                                >
                                  <div
                                    className="grid size-8 shrink-0 place-items-center rounded-lg text-sm"
                                    style={{ background: `${subColor}22` }}
                                  >
                                    {sub.icon || <span className="size-2.5 rounded-full" style={{ background: subColor }} />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <p className="min-w-0 break-words text-sm font-medium leading-snug text-white">
                                        {sub.name}
                                      </p>
                                      {sub.isDefault && (
                                        <Badge tone="neutral" className="shrink-0 text-[10px] px-2 py-0">
                                          Padrão
                                        </Badge>
                                      )}
                                    </div>
                                    {sub.description && (
                                      <p className="mt-0.5 break-words text-xs text-text-dim line-clamp-2 sm:line-clamp-1">
                                        {sub.description}
                                      </p>
                                    )}
                                  </div>
                                </Link>
                              </div>

                              <div className="flex items-center justify-between gap-2 pl-6 sm:shrink-0 sm:justify-end sm:pl-0 md:shrink md:justify-between md:pl-6 lg:shrink-0 lg:justify-end lg:pl-0">
                                <Badge
                                  tone={sub.type === 'INCOME' ? 'income' : sub.type === 'BOTH' ? 'primary' : 'default'}
                                  className="shrink-0"
                                >
                                  {categoryTypeLabel[sub.type]}
                                </Badge>

                                <div className="flex items-center gap-1">
                                  <Link
                                    to={`/categorias/${sub.id}`}
                                    className="grid size-9 place-items-center rounded-xl text-text-dim hover:bg-surface-2 hover:text-white transition sm:size-8 md:size-9 lg:size-8"
                                    aria-label={`Ver detalhes de ${sub.name}`}
                                    title="Ver lançamentos"
                                  >
                                    <ExternalLink className="size-4 lg:size-3.5" />
                                  </Link>
                                  {canEdit && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => setForm({ open: true, category: sub })}
                                        className="grid size-9 place-items-center rounded-xl text-text-dim hover:bg-surface-2 hover:text-white transition cursor-pointer sm:size-8 md:size-9 lg:size-8"
                                        aria-label={`Editar ${sub.name}`}
                                        title="Editar"
                                      >
                                        <Pencil className="size-4 lg:size-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeleting({ category: sub, childCount: 0 })}
                                        className="grid size-9 place-items-center rounded-xl text-text-dim hover:bg-surface-2 hover:text-expense transition cursor-pointer sm:size-8 md:size-9 lg:size-8"
                                        aria-label={`Excluir ${sub.name}`}
                                        title="Excluir"
                                      >
                                        <Trash2 className="size-4 lg:size-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <CategoryForm
        open={form.open}
        category={form.category}
        categories={scopedCategories}
        groupId={groupId}
        initialLevel={form.initialLevel}
        initialParentId={form.initialParentId}
        onClose={() => setForm({ open: false })}
        onSaved={(saved) => {
          const targetExpand = saved.parentId ?? (isGeneralCategory(saved) ? saved.id : undefined)
          if (targetExpand) {
            setExpandedIds((prev) => new Set(prev).add(targetExpand))
          }
        }}
      />

      {deleting && deleting.childCount > 0 ? (
        <Modal
          open
          onClose={() => setDeleting(undefined)}
          title="Não é possível excluir esta categoria"
        >
          <div className="space-y-4">
            <Alert tone="info">
              A categoria geral <b className="text-white">{deleting.category.name}</b> possui{' '}
              <b className="text-white tabular-nums">{deleting.childCount}</b> categoria(s) específica(s) vinculada(s).
              Exclua ou reatribua todas as subcategorias antes de remover a categoria geral.
            </Alert>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setExpandedIds((prev) => new Set(prev).add(deleting.category.id))
                setDeleting(undefined)
              }}
            >
              Entendi, mostrar subcategorias
            </Button>
          </div>
        </Modal>
      ) : (
        <ConfirmDialog
          open={!!deleting}
          onClose={() => setDeleting(undefined)}
          title="Excluir categoria"
          message={
            deleting && !isGeneralCategory(deleting.category)
              ? (() => {
                  const parentName =
                    deleting.category.parent?.name ??
                    scopedCategories.find((c) => c.id === deleting.category.parentId)?.name
                  return `Excluir "${deleting.category.name}"? As transações vinculadas manterão a categoria geral${parentName ? ` "${parentName}"` : ' pai'}.`
                })()
              : `Excluir "${deleting?.category.name}"?`
          }
          confirmLabel="Excluir"
          loading={del.isPending}
          onConfirm={() => deleting && del.mutate(deleting.category.id)}
        />
      )}
    </div>
  )
}
