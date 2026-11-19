import type { SelectOption } from '@/components/ui/Select'
import { normalizeCategoryColor } from './palette'
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
  general?: Category | CategorySummary | CategoryParentSummary
  isGeneralOnly: boolean
  label: string
  shortLabel: string
  color?: string | null
  icon?: string | null
}

export type TransactionCategoryFields = Pick<
  Transaction,
  'categoryId' | 'generalCategoryId' | 'specificCategoryId' | 'category' | 'generalCategory' | 'specificCategory'
>

export interface CategoryFilterPairValue {
  generalCategoryId?: string
  specificCategoryId?: string
}

export interface AggregatedCategoryExpense {
  key: string
  id?: string
  generalId?: string
  specificId?: string
  name: string
  subLabel?: string
  icon?: string | null
  generalIcon?: string | null
  value: number
  color: string
  isDirectGeneral?: boolean
  isUncategorized?: boolean
  count: number
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

export function synthesizeCategoryFromSummary(
  summary: CategorySummary,
  overrides?: { userId?: string | null; groupId?: string | null },
): Category {
  return {
    id: summary.id,
    name: summary.name,
    description: null,
    userId: overrides?.userId ?? null,
    groupId: overrides?.groupId ?? null,
    type: summary.type,
    level: summary.level ?? (summary.parentId || summary.parent ? 'SPECIFIC' : 'GENERAL'),
    parentId: summary.parentId ?? summary.parent?.id ?? null,
    parent: summary.parent ?? null,
    color: summary.color ?? null,
    icon: summary.icon ?? null,
    createdAt: '',
    updatedAt: '',
  }
}

/**
 * Popula categorias ausentes (inclusive categorias de terceiros/grupos) a partir dos
 * resumos `generalCategory`, `specificCategory` e `category` embutidos nas transações.
 */
export function addMissingTransactionCategories(
  map: Map<string, Category>,
  transactions: Pick<Transaction, 'category' | 'generalCategory' | 'specificCategory'>[],
): void {
  transactions.forEach((t) => {
    if (t.generalCategory && !map.has(t.generalCategory.id)) {
      map.set(
        t.generalCategory.id,
        synthesizeCategoryFromSummary({
          ...t.generalCategory,
          level: 'GENERAL',
          parentId: null,
          parent: null,
        }),
      )
    }

    if (t.specificCategory?.parent && !map.has(t.specificCategory.parent.id)) {
      map.set(t.specificCategory.parent.id, synthesizeGeneralCategory(t.specificCategory.parent))
    }

    if (t.specificCategory && !map.has(t.specificCategory.id)) {
      const specificParent =
        t.specificCategory.parent ??
        (t.generalCategory
          ? {
              id: t.generalCategory.id,
              name: t.generalCategory.name,
              color: t.generalCategory.color,
              icon: t.generalCategory.icon,
              type: t.generalCategory.type,
            }
          : null)

      map.set(
        t.specificCategory.id,
        synthesizeCategoryFromSummary({
          ...t.specificCategory,
          level: t.specificCategory.level ?? 'SPECIFIC',
          parentId: t.specificCategory.parentId ?? specificParent?.id ?? null,
          parent: specificParent,
        }),
      )
    }

    if (t.category?.parent && !map.has(t.category.parent.id)) {
      map.set(t.category.parent.id, synthesizeGeneralCategory(t.category.parent))
    }
    if (t.category && !map.has(t.category.id)) {
      map.set(t.category.id, synthesizeCategoryFromSummary(t.category))
    }
  })
}

const byNamePtBr = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt-BR')

function isCategoryLikeGeneral(
  cat: Pick<CategorySummary, 'level' | 'parentId' | 'parent'>,
  extraSummary?: Pick<CategorySummary, 'parentId' | 'parent'> | null,
): boolean {
  if (cat.level) return cat.level === 'GENERAL'
  return !cat.parentId && !cat.parent && !extraSummary?.parentId && !extraSummary?.parent
}

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
 * Avalia se a categoria de uma transação corresponde ao filtro selecionado (compatibilidade legada).
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
 * Resolve a categoria geral e a categoria específica (opcional) de uma transação,
 * priorizando o contrato canônico (`generalCategoryId`/`generalCategory` e
 * `specificCategoryId`/`specificCategory`) com fallback para o legado `categoryId`/`category`.
 */
export function resolveTransactionCategory(
  tx: TransactionCategoryFields,
  catMap: Map<string, Category>,
): ResolvedTransactionCategory {
  const explicitGeneralId = tx.generalCategoryId ?? tx.generalCategory?.id ?? null
  const explicitSpecificId = tx.specificCategoryId ?? tx.specificCategory?.id ?? null

  let specific: Category | CategorySummary | undefined
  let general: Category | CategorySummary | CategoryParentSummary | undefined

  if (explicitSpecificId || tx.specificCategory) {
    const mappedSpec = explicitSpecificId ? catMap.get(explicitSpecificId) : undefined
    const fallbackSpec =
      tx.specificCategory ??
      (tx.category && tx.category.id === explicitSpecificId ? tx.category : undefined)
    specific = mappedSpec ?? fallbackSpec
  }

  if (explicitGeneralId || tx.generalCategory) {
    const mappedGen = explicitGeneralId ? catMap.get(explicitGeneralId) : undefined
    const fallbackGen =
      tx.generalCategory ??
      specific?.parent ??
      tx.specificCategory?.parent ??
      (tx.category && tx.category.id === explicitGeneralId ? tx.category : undefined)
    general = mappedGen ?? fallbackGen
  }

  // Fallback legado quando apenas categoryId / category estão presentes
  if (!specific && !general && (tx.categoryId || tx.category)) {
    const mapped = tx.categoryId ? catMap.get(tx.categoryId) : undefined
    const summary = tx.category ?? undefined
    const resolved = mapped ?? summary

    if (resolved) {
      if (isCategoryLikeGeneral(resolved, summary)) {
        general = resolved
      } else {
        specific = resolved
        const parentId =
          resolved.parentId ??
          summary?.parentId ??
          resolved.parent?.id ??
          summary?.parent?.id ??
          null
        const generalFromMap = parentId ? catMap.get(parentId) : undefined
        general = generalFromMap ?? resolved.parent ?? summary?.parent ?? undefined
      }
    }
  } else if (specific && !general) {
    const parentId =
      specific.parentId ??
      tx.specificCategory?.parentId ??
      specific.parent?.id ??
      tx.specificCategory?.parent?.id ??
      null
    const generalFromMap = parentId ? catMap.get(parentId) : undefined
    general = generalFromMap ?? specific.parent ?? tx.specificCategory?.parent ?? undefined
  } else if (
    general &&
    !specific &&
    tx.categoryId &&
    tx.categoryId !== general.id &&
    !tx.specificCategoryId &&
    !tx.specificCategory
  ) {
    const candidate =
      catMap.get(tx.categoryId) ??
      (tx.category && tx.category.id === tx.categoryId ? tx.category : undefined)
    if (candidate && !isCategoryLikeGeneral(candidate, tx.category)) {
      specific = candidate
    }
  }

  if (!general && !specific) {
    return {
      isGeneralOnly: false,
      label: 'Sem categoria',
      shortLabel: 'Sem categoria',
      color: null,
      icon: null,
    }
  }

  if (general && !specific) {
    return {
      general,
      isGeneralOnly: true,
      label: general.name,
      shortLabel: general.name,
      color: general.color ?? null,
      icon: general.icon ?? null,
    }
  }

  if (general && specific) {
    return {
      specific,
      general,
      isGeneralOnly: false,
      label: `${general.name} › ${specific.name}`,
      shortLabel: specific.name,
      color: specific.color ?? general.color ?? null,
      icon: specific.icon ?? general.icon ?? null,
    }
  }

  const onlySpec = specific!
  return {
    specific: onlySpec,
    isGeneralOnly: false,
    label: onlySpec.name,
    shortLabel: onlySpec.name,
    color: onlySpec.color ?? null,
    icon: onlySpec.icon ?? null,
  }
}

/**
 * Avalia se a transação corresponde ao par de filtros coordenados (Categoria geral + Categoria específica).
 * Suporta `generalCategoryId === 'none'`, `generalCategoryId === '<id>'`,
 * `specificCategoryId === '__none_specific__'` e `specificCategoryId === '<id>'`.
 */
export function matchesCategoryFilters(
  tx: TransactionCategoryFields,
  filter: CategoryFilterPairValue,
  catMap: Map<string, Category>,
): boolean {
  const genFilter = filter.generalCategoryId ?? ''
  const specFilter = filter.specificCategoryId ?? ''

  if ((!genFilter || genFilter === 'ALL') && (!specFilter || specFilter === 'ALL')) {
    return true
  }

  const resolved = resolveTransactionCategory(tx, catMap)

  const rawGeneralId =
    resolved.general?.id ??
    tx.generalCategoryId ??
    tx.generalCategory?.id ??
    (tx.category && isCategoryLikeGeneral(tx.category)
      ? tx.category.id
      : (tx.category?.parentId ?? tx.category?.parent?.id ?? null)) ??
    null

  const rawSpecificId =
    resolved.specific?.id ??
    tx.specificCategoryId ??
    tx.specificCategory?.id ??
    (tx.category && !isCategoryLikeGeneral(tx.category) ? tx.category.id : null) ??
    null

  const isCategorized = Boolean(
    resolved.general ||
      resolved.specific ||
      tx.categoryId ||
      tx.generalCategoryId ||
      tx.specificCategoryId ||
      tx.category ||
      tx.generalCategory ||
      tx.specificCategory,
  )

  if (genFilter === 'none') {
    return !isCategorized
  }

  if (genFilter && genFilter !== 'ALL') {
    const matchesGeneral =
      rawGeneralId === genFilter ||
      (!rawSpecificId && tx.categoryId === genFilter)
    if (!matchesGeneral) return false
  }

  if (specFilter === '__none_specific__') {
    return Boolean(rawGeneralId) && !rawSpecificId
  }

  if (specFilter && specFilter !== 'ALL') {
    return rawSpecificId === specFilter
  }

  return true
}

/**
 * Agrega despesas por categoria para os cards de resumo (Dashboard e GroupDetail).
 * - Modo `GENERAL`: consolida diretas + específicas na Categoria Geral pai.
 * - Modo `SPECIFIC`: separa cada Específica com `subLabel = general.name` e
 *   identifica transações lançadas apenas na Geral como `name = 'Sem específica'`
 *   com `subLabel = general.name` (`isDirectGeneral = true`), distintas de `'Sem categoria'`.
 */
export function aggregateExpensesByCategory(
  txs: Pick<
    Transaction,
    'type' | 'amount' | 'categoryId' | 'generalCategoryId' | 'specificCategoryId' | 'category' | 'generalCategory' | 'specificCategory'
  >[],
  catMap: Map<string, Category>,
  mode: CategoryLevel,
): AggregatedCategoryExpense[] {
  const map = new Map<
    string,
    {
      key: string
      id?: string
      generalId?: string
      specificId?: string
      name: string
      subLabel?: string
      icon?: string | null
      generalIcon?: string | null
      value: number
      rawColor?: string | null
      isDirectGeneral: boolean
      isUncategorized: boolean
      count: number
    }
  >()

  txs.forEach((t) => {
    if (t.type !== 'EXPENSE') return
    const resolved = resolveTransactionCategory(t, catMap)
    const isUncategorized = !resolved.general && !resolved.specific

    let key: string
    let id: string | undefined
    let generalId: string | undefined
    let specificId: string | undefined
    let name: string
    let subLabel: string | undefined
    let icon: string | null | undefined
    let generalIcon: string | null | undefined
    let rawColor: string | null | undefined
    let isDirectGeneral = false

    if (isUncategorized) {
      key = 'none'
      name = 'Sem categoria'
      rawColor = '#8E8EA0'
    } else if (mode === 'GENERAL') {
      if (resolved.general) {
        key = `gen:${resolved.general.id}`
        id = resolved.general.id
        generalId = resolved.general.id
        name = resolved.general.name
        icon = resolved.general.icon ?? resolved.icon
        rawColor = resolved.general.color ?? resolved.color
      } else {
        const onlySpec = resolved.specific!
        key = `spec:${onlySpec.id}`
        id = onlySpec.id
        specificId = onlySpec.id
        name = onlySpec.name
        icon = onlySpec.icon
        rawColor = onlySpec.color
      }
    } else if (resolved.specific) {
      key = `spec:${resolved.specific.id}`
      id = resolved.specific.id
      generalId = resolved.general?.id
      specificId = resolved.specific.id
      name = resolved.specific.name
      subLabel = resolved.general?.name
      generalIcon = resolved.general?.icon ?? null
      icon = resolved.specific.icon ?? resolved.general?.icon
      rawColor = resolved.specific.color ?? resolved.general?.color
    } else {
      const gen = resolved.general!
      key = `direct:${gen.id}`
      id = `${gen.id}__direct`
      generalId = gen.id
      name = 'Sem específica'
      subLabel = gen.name
      generalIcon = gen.icon ?? null
      icon = gen.icon ?? null
      rawColor = gen.color ?? null
      isDirectGeneral = true
    }

    const existing = map.get(key)
    if (existing) {
      existing.value += t.amount
      existing.count += 1
    } else {
      map.set(key, {
        key,
        id,
        generalId,
        specificId,
        name,
        subLabel,
        icon,
        generalIcon,
        value: t.amount,
        rawColor,
        isDirectGeneral,
        isUncategorized,
        count: 1,
      })
    }
  })

  return [...map.values()]
    .map((item, idx) => ({
      key: item.key,
      id: item.id,
      generalId: item.generalId,
      specificId: item.specificId,
      name: item.name,
      subLabel: item.subLabel,
      icon: item.icon,
      generalIcon: item.generalIcon,
      value: item.value,
      color: item.isUncategorized && !item.rawColor ? '#8E8EA0' : normalizeCategoryColor(item.rawColor, idx),
      isDirectGeneral: item.isDirectGeneral,
      isUncategorized: item.isUncategorized,
      count: item.count,
    }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'pt-BR'))
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
