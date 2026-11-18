import type { SelectOption } from '@/components/ui/Select'
import type {
  Category,
  CategoryLevel,
  CategoryParentSummary,
  CategorySummary,
  CategoryType,
  Transaction,
  TransactionType,
} from './types'

export interface CategoryTreeNode {
  general: Category
  children: Category[]
}

export interface ResolvedTransactionCategory {
  specific?: Category | CategorySummary
  general?: Category | CategoryParentSummary
  label: string
  shortLabel: string
  color?: string | null
  icon?: string | null
}

export const categoryLevelLabel: Record<CategoryLevel, string> = {
  GENERAL: 'Geral',
  SPECIFIC: 'Específica',
}

export function isGeneralCategory(c: Pick<Category, 'level' | 'parentId'>): boolean {
  if (c.level) return c.level === 'GENERAL'
  return !c.parentId
}

export function isTypeCompatibleWithTransaction(categoryType: CategoryType, txType: TransactionType): boolean {
  return txType === 'TRANSFER' || categoryType === 'BOTH' || categoryType === txType
}

export function isChildTypeAllowed(childType: CategoryType, parentType: CategoryType): boolean {
  return parentType === 'BOTH' || childType === parentType
}

export function synthesizeGeneralCategory(
  parent: CategoryParentSummary,
  sampleChild?: Partial<Pick<Category, 'userId' | 'groupId'>>,
): Category {
  return {
    id: parent.id,
    name: parent.name,
    description: null,
    userId: sampleChild?.userId ?? null,
    groupId: sampleChild?.groupId ?? null,
    type: parent.type,
    level: 'GENERAL',
    parentId: null,
    parent: null,
    color: parent.color ?? null,
    icon: parent.icon ?? null,
    createdAt: '',
    updatedAt: '',
  }
}

const byNamePtBr = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt-BR')

/**
 * Organiza categorias em árvore de 2 níveis (Gerais ordenadas -> Específicas ordenadas).
 * Também sintetiza nós gerais quando uma categoria específica referencia um `parent` não presente na lista.
 */
export function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  const nodeMap = new Map<string, CategoryTreeNode>()

  categories.forEach((c) => {
    if (isGeneralCategory(c)) {
      nodeMap.set(c.id, { general: c, children: [] })
    }
  })

  categories.forEach((c) => {
    if (isGeneralCategory(c)) return

    const parentId = c.parentId ?? c.parent?.id ?? null
    if (parentId && nodeMap.has(parentId)) {
      nodeMap.get(parentId)!.children.push(c)
      return
    }

    if (c.parent) {
      const virtualGeneral = synthesizeGeneralCategory(c.parent, c)
      nodeMap.set(virtualGeneral.id, { general: virtualGeneral, children: [c] })
      return
    }

    if (parentId) {
      const fallbackGeneral: Category = {
        id: parentId,
        name: 'Categoria geral',
        description: null,
        userId: c.userId,
        groupId: c.groupId,
        type: c.type,
        level: 'GENERAL',
        parentId: null,
        parent: null,
        color: c.color,
        icon: c.icon,
        createdAt: '',
        updatedAt: '',
      }
      nodeMap.set(parentId, { general: fallbackGeneral, children: [c] })
      return
    }

    const orphanKey = '__orphan__'
    if (!nodeMap.has(orphanKey)) {
      nodeMap.set(orphanKey, {
        general: {
          id: orphanKey,
          name: 'Outras categorias',
          description: null,
          userId: c.userId,
          groupId: c.groupId,
          type: 'BOTH',
          level: 'GENERAL',
          parentId: null,
          parent: null,
          color: null,
          icon: null,
          createdAt: '',
          updatedAt: '',
        },
        children: [],
      })
    }
    nodeMap.get(orphanKey)!.children.push(c)
  })

  return [...nodeMap.values()]
    .map((node) => ({
      general: node.general,
      children: [...node.children].sort(byNamePtBr),
    }))
    .sort((a, b) => byNamePtBr(a.general, b.general))
}

/**
 * Avalia se a categoria de uma transação corresponde ao filtro selecionado.
 * Quando o filtro é uma categoria GENERAL, casa todas as subcategorias filhas.
 */
export function matchesCategoryFilter(
  txCategoryId: string | null | undefined,
  filterCategoryId: string,
  categories: Category[],
  txCategorySummary?: CategorySummary | null,
): boolean {
  if (!filterCategoryId || filterCategoryId === 'ALL') return true
  if (filterCategoryId === 'none') return !txCategoryId
  if (!txCategoryId) return false
  if (txCategoryId === filterCategoryId) return true

  const filterCat = categories.find((c) => c.id === filterCategoryId)
  const hasChildrenInList = categories.some((c) => c.parentId === filterCategoryId)
  if (filterCat && !isGeneralCategory(filterCat) && !hasChildrenInList) {
    return false
  }

  const txCat = categories.find((c) => c.id === txCategoryId)
  const txParentId =
    txCat?.parentId ??
    txCat?.parent?.id ??
    txCategorySummary?.parentId ??
    txCategorySummary?.parent?.id ??
    null

  return txParentId === filterCategoryId
}

/**
 * Resolve a categoria específica e sua respectiva categoria geral a partir do mapa local
 * com fallback para o objeto `tx.category` embutido na resposta da API.
 */
export function resolveTransactionCategory(
  tx: Pick<Transaction, 'categoryId' | 'category'>,
  catMap: Map<string, Category>,
): ResolvedTransactionCategory {
  if (!tx.categoryId && !tx.category) {
    return {
      label: 'Sem categoria',
      shortLabel: 'Sem categoria',
      color: null,
      icon: null,
    }
  }

  const mapped = tx.categoryId ? catMap.get(tx.categoryId) : undefined
  const summary = tx.category ?? undefined
  const resolved = mapped ?? summary

  if (!resolved) {
    return {
      label: 'Sem categoria',
      shortLabel: 'Sem categoria',
      color: null,
      icon: null,
    }
  }

  const isGeneral =
    resolved.level === 'GENERAL' ||
    (!resolved.level && !resolved.parentId && !resolved.parent && !summary?.parentId && !summary?.parent)

  if (isGeneral) {
    return {
      general: resolved,
      label: resolved.name,
      shortLabel: resolved.name,
      color: resolved.color ?? null,
      icon: resolved.icon ?? null,
    }
  }

  const parentId =
    resolved.parentId ??
    summary?.parentId ??
    resolved.parent?.id ??
    summary?.parent?.id ??
    null

  const generalFromMap = parentId ? catMap.get(parentId) : undefined
  const general = generalFromMap ?? resolved.parent ?? summary?.parent ?? undefined
  const label = general ? `${general.name} › ${resolved.name}` : resolved.name

  return {
    specific: resolved,
    general,
    label,
    shortLabel: resolved.name,
    color: resolved.color ?? general?.color ?? null,
    icon: resolved.icon ?? general?.icon ?? null,
  }
}

export interface GroupedCategoryFilterOptionsConfig {
  includeAll?: boolean
  allLabel?: string
  includeNone?: boolean
  noneLabel?: string
}

/**
 * Gera opções agrupadas para `<Select>` de filtros:
 * cada categoria geral aparece com "(todas)" seguida de suas específicas indentadas com "↳ ".
 */
export function buildGroupedCategoryFilterOptions(
  categories: Category[],
  config?: GroupedCategoryFilterOptionsConfig,
): SelectOption[] {
  const options: SelectOption[] = []

  if (config?.includeAll) {
    options.push({ value: '', label: config.allLabel ?? 'Todas as categorias' })
  }
  if (config?.includeNone) {
    options.push({ value: 'none', label: config.noneLabel ?? 'Sem categoria' })
  }

  const tree = buildCategoryTree(categories)
  tree.forEach((node) => {
    const groupLabel = `${node.general.icon ? `${node.general.icon} ` : ''}${node.general.name}`
    if (node.general.id !== '__orphan__') {
      options.push({
        value: node.general.id,
        label: `${groupLabel} (todas)`,
        group: groupLabel,
      })
    }
    node.children.forEach((sub) => {
      options.push({
        value: sub.id,
        label: `↳ ${sub.icon ? `${sub.icon} ` : ''}${sub.name}`,
        group: groupLabel,
      })
    })
  })

  return options
}
