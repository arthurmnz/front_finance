import { describe, expect, it } from 'vitest'
import {
  aggregateExpensesByCategory,
  buildCategoryTree,
  buildGroupedCategoryFilterOptions,
  matchesCategoryFilter,
  matchesCategoryFilters,
  resolveTransactionCategory,
} from '@/lib/categories'
import { buildCategoryEvolution } from '@/components/reports/useReportsData'
import type { Category, CategorySummary, Transaction } from '@/lib/types'

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat_1',
    name: 'Moradia',
    description: null,
    userId: 'user_1',
    groupId: null,
    type: 'EXPENSE',
    level: 'GENERAL',
    parentId: null,
    parent: null,
    isDefault: false,
    color: '#7D39EB',
    icon: '🏠',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx_${Math.random().toString(36).slice(2, 8)}`,
    title: 'Lançamento',
    amount: 10000,
    date: '2026-11-10T12:00:00Z',
    responsibleId: 'user_1',
    accountId: 'acc_1',
    type: 'EXPENSE',
    destinationAccountId: null,
    categoryId: null,
    status: 'COMPLETED',
    recurrenceGroupId: null,
    recurrenceFrequency: null,
    recurrenceInterval: null,
    isInfinite: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('Hierarquia de Categorias (src/lib/categories.ts)', () => {
  const genMoradia = makeCategory({ id: 'gen_moradia', name: 'Moradia', icon: '🏠', color: '#7D39EB' })
  const genAlimentacao = makeCategory({ id: 'gen_alim', name: 'Alimentação', icon: '🍽️', color: '#C6FF33' })
  const specAluguel = makeCategory({
    id: 'spec_aluguel',
    name: 'Aluguel',
    icon: '🔑',
    color: '#7D39EB',
    level: 'SPECIFIC',
    parentId: 'gen_moradia',
  })
  const specEnergia = makeCategory({
    id: 'spec_energia',
    name: 'Energia',
    icon: null,
    color: null,
    level: 'SPECIFIC',
    parentId: 'gen_moradia',
  })
  const specMercado = makeCategory({
    id: 'spec_mercado',
    name: 'Mercado',
    icon: '🛒',
    color: '#C6FF33',
    level: 'SPECIFIC',
    parentId: 'gen_alim',
  })

  it('buildCategoryTree ordena gerais e específicas em pt-BR e sintetiza pai embutido ausente', () => {
    const externalSpecific = makeCategory({
      id: 'spec_uber',
      name: 'Uber',
      icon: '🚗',
      level: 'SPECIFIC',
      parentId: 'gen_transporte',
      parent: {
        id: 'gen_transporte',
        name: 'Transporte',
        icon: '🚌',
        color: '#B285FF',
        type: 'EXPENSE',
      },
    })

    const tree = buildCategoryTree([specEnergia, genMoradia, specAluguel, genAlimentacao, specMercado, externalSpecific])

    expect(tree.map((n) => n.general.name)).toEqual(['Alimentação', 'Moradia', 'Transporte'])
    expect(tree[0].children.map((c) => c.name)).toEqual(['Mercado'])
    expect(tree[1].children.map((c) => c.name)).toEqual(['Aluguel', 'Energia'])
    expect(tree[2].general.id).toBe('gen_transporte')
    expect(tree[2].children.map((c) => c.name)).toEqual(['Uber'])
  })

  it('matchesCategoryFilter trata vazio, ALL, none, categoria GENERAL e categoria SPECIFIC (incluindo fallback tx.category)', () => {
    const categories = [genMoradia, specAluguel, specEnergia, genAlimentacao, specMercado]

    expect(matchesCategoryFilter(null, '', categories)).toBe(true)
    expect(matchesCategoryFilter('spec_aluguel', 'ALL', categories)).toBe(true)
    expect(matchesCategoryFilter(null, 'none', categories)).toBe(true)
    expect(matchesCategoryFilter('spec_aluguel', 'none', categories)).toBe(false)
    expect(matchesCategoryFilter(null, 'gen_moradia', categories)).toBe(false)

    // Filtro por GENERAL casa todas as específicas filhas
    expect(matchesCategoryFilter('spec_aluguel', 'gen_moradia', categories)).toBe(true)
    expect(matchesCategoryFilter('spec_energia', 'gen_moradia', categories)).toBe(true)
    expect(matchesCategoryFilter('spec_mercado', 'gen_moradia', categories)).toBe(false)

    // Filtro por SPECIFIC casa apenas ela mesma
    expect(matchesCategoryFilter('spec_aluguel', 'spec_aluguel', categories)).toBe(true)
    expect(matchesCategoryFilter('spec_energia', 'spec_aluguel', categories)).toBe(false)
    expect(matchesCategoryFilter('gen_moradia', 'spec_aluguel', categories)).toBe(false)

    // Fallback com tx.category quando a categoria pessoal de outro membro não está em `categories`
    const thirdPartySummary: CategorySummary = {
      id: 'spec_terceiro',
      name: 'Condomínio',
      type: 'EXPENSE',
      level: 'SPECIFIC',
      parentId: 'gen_moradia',
      parent: { id: 'gen_moradia', name: 'Moradia', type: 'EXPENSE' },
    }
    expect(matchesCategoryFilter('spec_terceiro', 'gen_moradia', categories, thirdPartySummary)).toBe(true)
    expect(matchesCategoryFilter('spec_terceiro', 'gen_alim', categories, thirdPartySummary)).toBe(false)
  })

  it('resolveTransactionCategory resolve só Geral, Geral+Específica, formato canônico e legados', () => {
    const catMap = new Map([genMoradia, specAluguel, specEnergia].map((c) => [c.id, c]))

    // Filha sem ícone/cor herda do pai (legado categoryId)
    const resEnergia = resolveTransactionCategory(
      makeTx({ categoryId: 'spec_energia' }),
      catMap,
    )
    expect(resEnergia.label).toBe('Moradia › Energia')
    expect(resEnergia.shortLabel).toBe('Energia')
    expect(resEnergia.isGeneralOnly).toBe(false)
    expect(resEnergia.icon).toBe('🏠')
    expect(resEnergia.color).toBe('#7D39EB')

    // Legado apontando diretamente para GENERAL
    const resLegacyGeneralOnly = resolveTransactionCategory(
      makeTx({ categoryId: 'gen_moradia' }),
      catMap,
    )
    expect(resLegacyGeneralOnly.general?.id).toBe('gen_moradia')
    expect(resLegacyGeneralOnly.specific).toBeUndefined()
    expect(resLegacyGeneralOnly.isGeneralOnly).toBe(true)
    expect(resLegacyGeneralOnly.label).toBe('Moradia')

    // Contrato canônico: apenas Geral (generalCategoryId + categoryId=G, specificCategoryId=null)
    const resCanonicalGeneralOnly = resolveTransactionCategory(
      makeTx({
        categoryId: 'gen_moradia',
        generalCategoryId: 'gen_moradia',
        specificCategoryId: null,
        generalCategory: {
          id: 'gen_moradia',
          name: 'Moradia',
          icon: '🏠',
          color: '#7D39EB',
          type: 'EXPENSE',
          level: 'GENERAL',
        },
        specificCategory: null,
      }),
      new Map(),
    )
    expect(resCanonicalGeneralOnly.general?.name).toBe('Moradia')
    expect(resCanonicalGeneralOnly.specific).toBeUndefined()
    expect(resCanonicalGeneralOnly.isGeneralOnly).toBe(true)
    expect(resCanonicalGeneralOnly.label).toBe('Moradia')

    // Contrato canônico: Geral + Específica
    const resCanonicalBoth = resolveTransactionCategory(
      makeTx({
        categoryId: 'spec_ext',
        generalCategoryId: 'gen_saude',
        specificCategoryId: 'spec_ext',
        generalCategory: {
          id: 'gen_saude',
          name: 'Saúde',
          icon: '🩺',
          color: '#E4FF8F',
          type: 'EXPENSE',
          level: 'GENERAL',
        },
        specificCategory: {
          id: 'spec_ext',
          name: 'Farmácia',
          icon: '💊',
          color: '#E4FF8F',
          type: 'EXPENSE',
          level: 'SPECIFIC',
          parentId: 'gen_saude',
          parent: { id: 'gen_saude', name: 'Saúde', icon: '🩺', color: '#E4FF8F', type: 'EXPENSE' },
        },
      }),
      new Map(),
    )
    expect(resCanonicalBoth.general?.name).toBe('Saúde')
    expect(resCanonicalBoth.specific?.name).toBe('Farmácia')
    expect(resCanonicalBoth.isGeneralOnly).toBe(false)
    expect(resCanonicalBoth.label).toBe('Saúde › Farmácia')

    // Categoria de outro membro via tx.category embutido
    const resThirdParty = resolveTransactionCategory(
      makeTx({
        categoryId: 'spec_ext',
        category: {
          id: 'spec_ext',
          name: 'Farmácia',
          icon: '💊',
          color: '#E4FF8F',
          type: 'EXPENSE',
          level: 'SPECIFIC',
          parentId: 'gen_saude',
          parent: { id: 'gen_saude', name: 'Saúde', icon: '🩺', color: '#E4FF8F', type: 'EXPENSE' },
        },
      }),
      catMap,
    )
    expect(resThirdParty.label).toBe('Saúde › Farmácia')
    expect(resThirdParty.shortLabel).toBe('Farmácia')
    expect(resThirdParty.isGeneralOnly).toBe(false)
    expect(resThirdParty.general?.name).toBe('Saúde')
    expect(resThirdParty.specific?.name).toBe('Farmácia')

    // Sem categoria
    const resNone = resolveTransactionCategory(makeTx({ categoryId: null }), catMap)
    expect(resNone.label).toBe('Sem categoria')
    expect(resNone.isGeneralOnly).toBe(false)
    expect(resNone.specific).toBeUndefined()
    expect(resNone.general).toBeUndefined()
  })

  it('matchesCategoryFilters suporta none, geral (direta + específicas), __none_specific__ e específica', () => {
    const catMap = new Map([genMoradia, specAluguel, specEnergia, genAlimentacao, specMercado].map((c) => [c.id, c]))

    const txDirectMoradia = makeTx({
      categoryId: 'gen_moradia',
      generalCategoryId: 'gen_moradia',
      specificCategoryId: null,
    })
    const txAluguel = makeTx({
      categoryId: 'spec_aluguel',
      generalCategoryId: 'gen_moradia',
      specificCategoryId: 'spec_aluguel',
    })
    const txDirectAlim = makeTx({
      categoryId: 'gen_alim',
      generalCategoryId: 'gen_alim',
      specificCategoryId: null,
    })
    const txMercado = makeTx({ categoryId: 'spec_mercado' })
    const txUncategorized = makeTx({ categoryId: null, generalCategoryId: null, specificCategoryId: null })

    // Sem filtros
    expect(matchesCategoryFilters(txUncategorized, {}, catMap)).toBe(true)
    expect(matchesCategoryFilters(txDirectMoradia, {}, catMap)).toBe(true)

    // Apenas sem categoria ('none')
    expect(matchesCategoryFilters(txUncategorized, { generalCategoryId: 'none' }, catMap)).toBe(true)
    expect(matchesCategoryFilters(txDirectMoradia, { generalCategoryId: 'none' }, catMap)).toBe(false)
    expect(matchesCategoryFilters(txAluguel, { generalCategoryId: 'none' }, catMap)).toBe(false)

    // Geral 'gen_moradia': casa direta na Geral E suas específicas
    expect(matchesCategoryFilters(txDirectMoradia, { generalCategoryId: 'gen_moradia' }, catMap)).toBe(true)
    expect(matchesCategoryFilters(txAluguel, { generalCategoryId: 'gen_moradia' }, catMap)).toBe(true)
    expect(matchesCategoryFilters(txMercado, { generalCategoryId: 'gen_moradia' }, catMap)).toBe(false)
    expect(matchesCategoryFilters(txUncategorized, { generalCategoryId: 'gen_moradia' }, catMap)).toBe(false)

    // Específica '__none_specific__' sem geral: casa todas as diretas em qualquer Geral, mas não específicas nem sem categoria
    expect(matchesCategoryFilters(txDirectMoradia, { specificCategoryId: '__none_specific__' }, catMap)).toBe(true)
    expect(matchesCategoryFilters(txDirectAlim, { specificCategoryId: '__none_specific__' }, catMap)).toBe(true)
    expect(matchesCategoryFilters(txAluguel, { specificCategoryId: '__none_specific__' }, catMap)).toBe(false)
    expect(matchesCategoryFilters(txMercado, { specificCategoryId: '__none_specific__' }, catMap)).toBe(false)
    expect(matchesCategoryFilters(txUncategorized, { specificCategoryId: '__none_specific__' }, catMap)).toBe(false)

    // Geral 'gen_moradia' + '__none_specific__': casa apenas direta em Moradia
    expect(
      matchesCategoryFilters(
        txDirectMoradia,
        { generalCategoryId: 'gen_moradia', specificCategoryId: '__none_specific__' },
        catMap,
      ),
    ).toBe(true)
    expect(
      matchesCategoryFilters(
        txAluguel,
        { generalCategoryId: 'gen_moradia', specificCategoryId: '__none_specific__' },
        catMap,
      ),
    ).toBe(false)
    expect(
      matchesCategoryFilters(
        txDirectAlim,
        { generalCategoryId: 'gen_moradia', specificCategoryId: '__none_specific__' },
        catMap,
      ),
    ).toBe(false)

    // Específica específica
    expect(
      matchesCategoryFilters(
        txAluguel,
        { generalCategoryId: 'gen_moradia', specificCategoryId: 'spec_aluguel' },
        catMap,
      ),
    ).toBe(true)
    expect(
      matchesCategoryFilters(
        txDirectMoradia,
        { generalCategoryId: 'gen_moradia', specificCategoryId: 'spec_aluguel' },
        catMap,
      ),
    ).toBe(false)
  })

  it('aggregateExpensesByCategory consolida no modo GENERAL e distingue Sem específica vs Sem categoria no modo SPECIFIC', () => {
    const catMap = new Map([genMoradia, specAluguel, specEnergia, genAlimentacao, specMercado].map((c) => [c.id, c]))

    const txs = [
      makeTx({ amount: 150000, generalCategoryId: 'gen_moradia', specificCategoryId: 'spec_aluguel', categoryId: 'spec_aluguel' }),
      makeTx({ amount: 40000, generalCategoryId: 'gen_moradia', specificCategoryId: null, categoryId: 'gen_moradia' }),
      makeTx({ amount: 30000, generalCategoryId: 'gen_alim', specificCategoryId: null, categoryId: 'gen_alim' }),
      makeTx({ amount: 25000, categoryId: 'spec_mercado' }),
      makeTx({ amount: 10000, categoryId: null }),
      makeTx({ type: 'INCOME', amount: 500000, categoryId: null }),
    ]

    const generalAgg = aggregateExpensesByCategory(txs, catMap, 'GENERAL')
    expect(generalAgg.map((i) => ({ name: i.name, value: i.value }))).toEqual([
      { name: 'Moradia', value: 190000 },
      { name: 'Alimentação', value: 55000 },
      { name: 'Sem categoria', value: 10000 },
    ])

    const specificAgg = aggregateExpensesByCategory(txs, catMap, 'SPECIFIC')
    expect(
      specificAgg.map((i) => ({
        name: i.name,
        subLabel: i.subLabel,
        value: i.value,
        isDirectGeneral: i.isDirectGeneral,
        isUncategorized: i.isUncategorized,
      })),
    ).toEqual([
      { name: 'Aluguel', subLabel: 'Moradia', value: 150000, isDirectGeneral: false, isUncategorized: false },
      { name: 'Sem específica', subLabel: 'Moradia', value: 40000, isDirectGeneral: true, isUncategorized: false },
      { name: 'Sem específica', subLabel: 'Alimentação', value: 30000, isDirectGeneral: true, isUncategorized: false },
      { name: 'Mercado', subLabel: 'Alimentação', value: 25000, isDirectGeneral: false, isUncategorized: false },
      { name: 'Sem categoria', subLabel: undefined, value: 10000, isDirectGeneral: false, isUncategorized: true },
    ])
  })

  it('buildGroupedCategoryFilterOptions gera opções agrupadas com labels string pesquisáveis', () => {
    const options = buildGroupedCategoryFilterOptions(
      [genMoradia, specAluguel, specEnergia],
      { includeAll: true, includeNone: true },
    )

    expect(options[0]).toEqual({ value: '', label: 'Todas as categorias' })
    expect(options[1]).toEqual({ value: 'none', label: 'Sem categoria' })
    expect(options[2]).toEqual({
      value: 'gen_moradia',
      label: '🏠 Moradia (todas)',
      group: '🏠 Moradia',
    })
    expect(options[3]).toEqual({
      value: 'spec_aluguel',
      label: '↳ 🔑 Aluguel',
      group: '🏠 Moradia',
    })
    expect(options[4]).toEqual({
      value: 'spec_energia',
      label: '↳ Energia',
      group: '🏠 Moradia',
    })
  })
})

describe('buildCategoryEvolution hierárquico', () => {
  const genMoradia = makeCategory({ id: 'gen_moradia', name: 'Moradia', icon: '🏠', color: '#7D39EB' })
  const specAluguel = makeCategory({
    id: 'spec_aluguel',
    name: 'Aluguel',
    icon: '🔑',
    color: '#7D39EB',
    level: 'SPECIFIC',
    parentId: 'gen_moradia',
  })
  const specLuz = makeCategory({
    id: 'spec_luz',
    name: 'Energia',
    icon: '⚡',
    color: '#B285FF',
    level: 'SPECIFIC',
    parentId: 'gen_moradia',
  })

  it('agrupa despesas na categoria Geral com detalhamento de Específicas filhas e cálculo MoM', () => {
    const currentTxs = [
      makeTx({ amount: 150000, categoryId: 'spec_aluguel' }),
      makeTx({ amount: 30000, categoryId: 'spec_luz' }),
      makeTx({ amount: 20000, categoryId: null }),
    ]
    const prevTxs = [
      makeTx({ amount: 150000, categoryId: 'spec_aluguel' }),
    ]

    const result = buildCategoryEvolution(currentTxs, prevTxs, [genMoradia, specAluguel, specLuz])

    expect(result).toHaveLength(2)
    const moradia = result[0]
    expect(moradia.id).toBe('gen_moradia')
    expect(moradia.name).toBe('Moradia')
    expect(moradia.currentAmount).toBe(180000)
    expect(moradia.previousAmount).toBe(150000)
    expect(moradia.percentageOfTotal).toBe(90)
    expect(moradia.momVariationPct).toBe(20)
    expect(moradia.isNew).toBe(false)
    expect(moradia.children).toHaveLength(2)

    const aluguel = moradia.children![0]
    expect(aluguel.name).toBe('Aluguel')
    expect(aluguel.currentAmount).toBe(150000)
    expect(aluguel.percentageOfTotal).toBe(75)
    expect(aluguel.percentageOfParent).toBe(83)
    expect(aluguel.momVariationPct).toBe(0)

    const luz = moradia.children![1]
    expect(luz.name).toBe('Energia')
    expect(luz.currentAmount).toBe(30000)
    expect(luz.percentageOfTotal).toBe(15)
    expect(luz.percentageOfParent).toBe(17)
    expect(luz.isNew).toBe(true)

    const semCat = result[1]
    expect(semCat.name).toBe('Sem categoria')
    expect(semCat.isUncategorized).toBe(true)
    expect(semCat.currentAmount).toBe(20000)
    expect(semCat.percentageOfTotal).toBe(10)
  })

  it('inclui item sintético "Sem específica (direto em <Geral>)" mantendo invariante de soma entre Geral e Específicas', () => {
    const currentTxs = [
      makeTx({ amount: 120000, generalCategoryId: 'gen_moradia', specificCategoryId: 'spec_aluguel', categoryId: 'spec_aluguel' }),
      makeTx({ amount: 50000, generalCategoryId: 'gen_moradia', specificCategoryId: null, categoryId: 'gen_moradia' }),
      makeTx({ amount: 30000, categoryId: null }),
    ]
    const prevTxs = [
      makeTx({ amount: 120000, generalCategoryId: 'gen_moradia', specificCategoryId: 'spec_aluguel', categoryId: 'spec_aluguel' }),
      makeTx({ amount: 25000, generalCategoryId: 'gen_moradia', specificCategoryId: null, categoryId: 'gen_moradia' }),
    ]

    const result = buildCategoryEvolution(currentTxs, prevTxs, [genMoradia, specAluguel, specLuz])
    const moradia = result.find((c) => c.id === 'gen_moradia')!

    expect(moradia.currentAmount).toBe(170000)
    expect(moradia.previousAmount).toBe(145000)
    expect(moradia.children).toHaveLength(2)

    const directChild = moradia.children!.find((c) => c.isDirectGeneral)!
    expect(directChild.id).toBe('gen_moradia__direct')
    expect(directChild.name).toBe('Sem específica (direto em Moradia)')
    expect(directChild.parentId).toBe('gen_moradia')
    expect(directChild.parentName).toBe('Moradia')
    expect(directChild.parentIcon).toBe('🏠')
    expect(directChild.parentColor).toBe('#7D39EB')
    expect(directChild.currentAmount).toBe(50000)
    expect(directChild.previousAmount).toBe(25000)
    expect(directChild.percentageOfTotal).toBe(25)
    expect(directChild.percentageOfParent).toBe(29)
    expect(directChild.momVariationPct).toBe(100)
    expect(directChild.isNew).toBe(false)

    // Invariante: soma exata dos filhos igual ao total da Geral nos dois períodos
    const childrenCurrentSum = moradia.children!.reduce((sum, ch) => sum + ch.currentAmount, 0)
    const childrenPreviousSum = moradia.children!.reduce((sum, ch) => sum + ch.previousAmount, 0)
    expect(childrenCurrentSum).toBe(moradia.currentAmount)
    expect(childrenPreviousSum).toBe(moradia.previousAmount)
  })
})
