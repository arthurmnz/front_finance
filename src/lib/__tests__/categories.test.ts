import { describe, expect, it } from 'vitest'
import {
  buildCategoryTree,
  buildGroupedCategoryFilterOptions,
  matchesCategoryFilter,
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

  it('resolveTransactionCategory resolve hierarquia completa pelo catMap e por tx.category em grupo', () => {
    const catMap = new Map([genMoradia, specAluguel, specEnergia].map((c) => [c.id, c]))

    // Filha sem ícone/cor herda do pai
    const resEnergia = resolveTransactionCategory(
      makeTx({ categoryId: 'spec_energia' }),
      catMap,
    )
    expect(resEnergia.label).toBe('Moradia › Energia')
    expect(resEnergia.shortLabel).toBe('Energia')
    expect(resEnergia.icon).toBe('🏠')
    expect(resEnergia.color).toBe('#7D39EB')

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
    expect(resThirdParty.general?.name).toBe('Saúde')
    expect(resThirdParty.specific?.name).toBe('Farmácia')

    // Sem categoria
    const resNone = resolveTransactionCategory(makeTx({ categoryId: null }), catMap)
    expect(resNone.label).toBe('Sem categoria')
    expect(resNone.specific).toBeUndefined()
    expect(resNone.general).toBeUndefined()
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
    expect(aluguel.momVariationPct).toBe(0)

    const luz = moradia.children![1]
    expect(luz.name).toBe('Energia')
    expect(luz.currentAmount).toBe(30000)
    expect(luz.percentageOfTotal).toBe(15)
    expect(luz.isNew).toBe(true)

    const semCat = result[1]
    expect(semCat.name).toBe('Sem categoria')
    expect(semCat.currentAmount).toBe(20000)
    expect(semCat.percentageOfTotal).toBe(10)
  })
})
