import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, FolderTree } from 'lucide-react'
import { useAllCategories, useCategoryTransactions } from '@/lib/hooks'
import { isGeneralCategory } from '@/lib/categories'
import { categoryTypeLabel, formatMoney } from '@/lib/format'
import { normalizeCategoryColor } from '@/lib/palette'
import type { Category, CategoryParentSummary, CategorySummary } from '@/lib/types'
import { Badge, Card, Empty, PageHeader, QueryState } from '@/components/ui'
import { MonthPicker, currentPeriod } from '@/components/MonthPicker'
import TransactionList from '@/components/TransactionList'

interface SubcategoryBreakdownItem {
  id: string
  name: string
  icon?: string | null
  color: string
  amount: number
  percentage: number
  count: number
}

export default function CategoryDetail() {
  const { id } = useParams()
  const [period, setPeriod] = useState(currentPeriod())
  const catsQuery = useAllCategories()
  const cats = catsQuery.data
  const tx = useCategoryTransactions(id, period.month, period.year)

  const txList = useMemo(() => tx.data ?? [], [tx.data])

  const cat: Category | CategorySummary | undefined = useMemo(() => {
    const found = cats.find((c) => c.id === id)
    if (found) return found
    const fromTx = txList.find((t) => t.category?.id === id)?.category
    if (fromTx) return fromTx
    const parentFromTx = txList.find((t) => t.category?.parent?.id === id)?.category?.parent
    if (parentFromTx) {
      return {
        ...parentFromTx,
        level: 'GENERAL' as const,
        parentId: null,
        parent: null,
      }
    }
    return undefined
  }, [cats, id, txList])

  const isGeneral = useMemo(() => {
    if (!cat) return false
    if ('level' in cat && cat.level) return cat.level === 'GENERAL'
    return isGeneralCategory({ level: cat.level ?? 'GENERAL', parentId: cat.parentId })
  }, [cat])

  const parentCat: Category | CategoryParentSummary | undefined = useMemo(() => {
    if (!cat || isGeneral) return undefined
    const pid = cat.parentId ?? cat.parent?.id
    if (pid) {
      const fromList = cats.find((c) => c.id === pid)
      if (fromList) return fromList
    }
    return cat.parent ?? undefined
  }, [cat, isGeneral, cats])

  const total = useMemo(() => txList.reduce((s, t) => s + t.amount, 0), [txList])

  const subcategoryBreakdown: SubcategoryBreakdownItem[] = useMemo(() => {
    if (!cat || !isGeneral) return []

    const subMap = new Map<
      string,
      { id: string; name: string; icon?: string | null; color?: string | null; amount: number; count: number }
    >()

    // Inclui todas as subcategorias filhas conhecidas mesmo com R$ 0,00 no período
    cats
      .filter((c) => c.parentId === cat.id)
      .forEach((sub) => {
        subMap.set(sub.id, {
          id: sub.id,
          name: sub.name,
          icon: sub.icon,
          color: sub.color ?? cat.color,
          amount: 0,
          count: 0,
        })
      })

    // Soma transações do período (inclusive eventuais subcategorias vindas via tx.category)
    txList.forEach((t) => {
      if (!t.categoryId) return
      const existing = subMap.get(t.categoryId)
      if (existing) {
        existing.amount += t.amount
        existing.count += 1
        return
      }
      if (t.categoryId !== cat.id) {
        const subMeta = cats.find((c) => c.id === t.categoryId) ?? t.category
        subMap.set(t.categoryId, {
          id: t.categoryId,
          name: subMeta?.name ?? 'Subcategoria',
          icon: subMeta?.icon ?? null,
          color: subMeta?.color ?? cat.color,
          amount: t.amount,
          count: 1,
        })
      }
    })

    return [...subMap.values()]
      .map((item, idx) => ({
        id: item.id,
        name: item.name,
        icon: item.icon,
        color: normalizeCategoryColor(item.color, idx),
        amount: item.amount,
        percentage: total > 0 ? Math.round((item.amount / total) * 100) : 0,
        count: item.count,
      }))
      .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'pt-BR'))
  }, [cat, isGeneral, cats, txList, total])

  const catColor = cat ? normalizeCategoryColor(cat.color) : undefined
  const description = cat && 'description' in cat && typeof cat.description === 'string' ? cat.description : undefined
  const isDefault = cat && 'isDefault' in cat ? Boolean(cat.isDefault) : false

  return (
    <>
      <PageHeader
        back={
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-dim">
            <Link to="/categorias" className="inline-flex items-center gap-1 hover:text-white transition">
              <ArrowLeft className="size-3" /> Categorias
            </Link>
            {parentCat && (
              <>
                <ChevronRight className="size-3 text-text-faint" />
                <Link
                  to={`/categorias/${parentCat.id}`}
                  className="inline-flex items-center gap-1 text-text-muted hover:text-lime transition"
                >
                  {parentCat.icon && <span>{parentCat.icon}</span>}
                  <span>{parentCat.name}</span>
                </Link>
              </>
            )}
            {cat && (
              <>
                <ChevronRight className="size-3 text-text-faint" />
                <span className="text-white font-medium truncate max-w-48">
                  {cat.icon ? `${cat.icon} ` : ''}
                  {cat.name}
                </span>
              </>
            )}
          </div>
        }
        title={cat ? `${cat.icon ? `${cat.icon} ` : ''}${cat.name}` : 'Categoria'}
        subtitle={description}
        action={
          cat ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={isGeneral ? 'primary' : 'default'}>
                {isGeneral ? 'Categoria Geral' : 'Categoria Específica'}
              </Badge>
              <Badge tone={cat.type === 'INCOME' ? 'income' : 'default'}>
                {categoryTypeLabel[cat.type]}
              </Badge>
              {isDefault && <Badge tone="neutral">Padrão</Badge>}
            </div>
          ) : undefined
        }
      />

      {!isGeneral && parentCat && (
        <div className="mb-4 flex items-center gap-2 text-xs text-text-muted">
          <span>Pertence à categoria geral:</span>
          <Link
            to={`/categorias/${parentCat.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-1 px-2.5 py-1 font-medium text-white hover:border-violet/50 hover:text-lime transition"
          >
            {parentCat.icon && <span>{parentCat.icon}</span>}
            <span>{parentCat.name}</span>
          </Link>
        </div>
      )}

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-text-dim">
              {isGeneral ? 'Total consolidado no período' : 'Total no período'}
            </p>
            <p className="mt-0.5 text-2xl font-bold tracking-tight text-white tabular-nums">
              {formatMoney(total)}
            </p>
            <p className="mt-1 text-xs text-text-dim tabular-nums">
              {txList.length} {txList.length === 1 ? 'lançamento' : 'lançamentos'}
              {isGeneral && subcategoryBreakdown.length > 0
                ? ` · ${subcategoryBreakdown.length} ${subcategoryBreakdown.length === 1 ? 'específica' : 'específicas'}`
                : ''}
            </p>
          </div>
          {catColor && (
            <div
              className="grid size-11 shrink-0 place-items-center rounded-2xl text-xl"
              style={{ background: `${catColor}22` }}
            >
              {cat?.icon || <span className="size-3.5 rounded-full" style={{ background: catColor }} />}
            </div>
          )}
        </div>
      </Card>

      <div className="mb-4">
        <MonthPicker value={period} onChange={setPeriod} />
      </div>

      {isGeneral && (
        <div className="mb-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-dim">
              <FolderTree className="size-3.5 text-violet" />
              Distribuição por categoria específica
            </h2>
          </div>

          {!subcategoryBreakdown.length ? (
            <Card className="p-4">
              <Empty title="Nenhuma categoria específica vinculada a esta categoria geral." />
            </Card>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {subcategoryBreakdown.map((sub) => (
                <Link
                  key={sub.id}
                  to={`/categorias/${sub.id}`}
                  className="group block rounded-2xl border border-border bg-surface-1 p-3.5 card-highlight transition-colors hover:border-violet/45 hover:bg-surface-2/50"
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div
                        className="grid size-8 shrink-0 place-items-center rounded-xl text-sm"
                        style={{ background: `${sub.color}25` }}
                      >
                        {sub.icon || <span className="size-2.5 rounded-full" style={{ background: sub.color }} />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white group-hover:text-lime transition-colors">
                          {sub.name}
                        </p>
                        <p className="text-[11px] text-text-dim tabular-nums">
                          {sub.count} {sub.count === 1 ? 'lançamento' : 'lançamentos'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <p className="text-sm font-semibold text-white">{formatMoney(sub.amount)}</p>
                      <p className="text-[11px] text-text-dim">{sub.percentage}%</p>
                    </div>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, sub.percentage)}%`,
                        background: sub.color,
                      }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <QueryState isLoading={tx.isLoading} error={tx.error}>
        <TransactionList items={txList} categories={cats} />
      </QueryState>
    </>
  )
}
