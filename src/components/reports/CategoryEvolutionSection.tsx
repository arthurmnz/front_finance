import { useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  FolderTree,
  PieChart as PieIcon,
  Sparkles,
  Tags,
} from 'lucide-react'
import clsx from 'clsx'
import { formatMoney } from '@/lib/format'
import { Badge, Card, Empty, InfoTooltip } from '@/components/ui'
import type { CategoryComparison } from './types'

type CategoryReportMode = 'BOTH' | 'GENERAL' | 'SPECIFIC'

interface CategoryEvolutionSectionProps {
  categories: CategoryComparison[]
}

function MomCell({ item }: { item: CategoryComparison }) {
  if (item.isNew) {
    return (
      <Badge tone="primary" className="text-[10px] gap-1 inline-flex items-center">
        <Sparkles className="size-2.5 text-lime" /> Novo
      </Badge>
    )
  }
  if (item.momVariationPct !== null) {
    return (
      <span
        className={clsx(
          'inline-flex items-center gap-0.5 font-medium tabular-nums',
          item.momVariationPct > 0 ? 'text-expense' : 'text-income',
        )}
      >
        {item.momVariationPct > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
        {Math.abs(item.momVariationPct)}%
      </span>
    )
  }
  return <span className="text-text-dim">—</span>
}

interface BreakdownBlockProps {
  title: string
  subtitle: string
  icon: typeof FolderTree
  columnLabel: string
  items: CategoryComparison[]
  expandable?: boolean
  showParentBadge?: boolean
  expandedIds?: Set<string>
  onToggleExpand?: (key: string) => void
}

function CategoryBreakdownBlock({
  title,
  subtitle,
  icon: HeaderIcon,
  columnLabel,
  items,
  expandable = false,
  showParentBadge = false,
  expandedIds,
  onToggleExpand,
}: BreakdownBlockProps) {
  const chartData = useMemo(
    () =>
      items
        .filter((c) => c.currentAmount > 0)
        .map((c) => ({
          name: c.isDirectGeneral
            ? `Sem específica · ${c.parentName ?? 'Geral'}`
            : showParentBadge && c.parentName
              ? `${c.icon ? `${c.icon} ` : ''}${c.name} · ${c.parentName}`
              : c.icon
                ? `${c.icon} ${c.name}`
                : c.name,
          value: c.currentAmount,
          color: c.color,
        })),
    [items, showParentBadge],
  )

  const hasData = chartData.length > 0

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            <HeaderIcon className="size-4 text-violet shrink-0" />
            <span>{title}</span>
          </h3>
          <p className="text-xs text-text-dim">{subtitle}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-12">
        {/* Gráfico de Rosca */}
        <Card className="p-4 bg-surface-1 border-border md:col-span-5 flex flex-col justify-center items-center">
          {!hasData ? (
            <Empty title="Sem despesas categorizadas no mês." />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {chartData.map((c, i) => (
                      <Cell key={`cell-${i}`} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => formatMoney(Number(v))}
                    contentStyle={{
                      background: '#111114',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 12,
                      color: '#f4f4f5',
                    }}
                    itemStyle={{ color: '#f4f4f5' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Tabela/Ranking com Comparativo MoM */}
        <Card className="p-4 bg-surface-1 border-border md:col-span-7">
          <div className="mb-3 flex items-center justify-between border-b border-border/60 pb-2 text-xs font-semibold text-text-dim">
            <span>{columnLabel}</span>
            <div className="flex items-center gap-3 sm:gap-6">
              <span>Atual (% Total)</span>
              <span className="flex items-center gap-1">
                Variação MoM
                <InfoTooltip
                  content="Month-over-Month: variação percentual de gastos nesta categoria em relação ao mês anterior."
                  align="end"
                />
              </span>
            </div>
          </div>

          {!items.length ? (
            <Empty title="Nenhuma categoria para comparar." />
          ) : (
            <ul className="divide-y divide-border/60 max-h-96 overflow-y-auto pr-1">
              {items.map((c, idx) => {
                const rowKey = c.id ?? `cat-${idx}-${c.name}`
                const hasChildren = expandable && Boolean(c.children && c.children.length > 0)
                const isExpanded = Boolean(hasChildren && expandedIds?.has(rowKey))

                return (
                  <li key={rowKey} className="py-1">
                    <div className="py-1.5 flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 min-w-0 pr-1 flex-1">
                        {expandable && (
                          hasChildren ? (
                            <button
                              type="button"
                              onClick={() => onToggleExpand?.(rowKey)}
                              aria-expanded={isExpanded}
                              aria-label={isExpanded ? `Recolher ${c.name}` : `Expandir ${c.name}`}
                              className="grid size-5 shrink-0 place-items-center rounded-md text-text-dim hover:bg-surface-2 hover:text-white transition cursor-pointer"
                            >
                              {isExpanded ? (
                                <ChevronDown className="size-3.5" />
                              ) : (
                                <ChevronRight className="size-3.5" />
                              )}
                            </button>
                          ) : (
                            <span className="size-5 shrink-0" aria-hidden="true" />
                          )
                        )}
                        <span className="size-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                        {!c.isDirectGeneral && c.icon && <span className="shrink-0">{c.icon}</span>}
                        <div className="min-w-0 flex flex-wrap items-center gap-1.5">
                          {c.isDirectGeneral ? (
                            <span className="font-medium italic text-text-muted">Sem específica</span>
                          ) : (
                            <span className={clsx('font-medium truncate', c.isUncategorized ? 'text-text-dim' : 'text-white')}>
                              {c.name}
                            </span>
                          )}

                          {showParentBadge && c.parentName && (
                            <Badge tone="default" className="text-[10px] px-2 py-0 inline-flex items-center gap-1">
                              {c.parentIcon && <span aria-hidden="true">{c.parentIcon}</span>}
                              <span>{c.parentName}</span>
                            </Badge>
                          )}

                          {showParentBadge && c.isUncategorized && (
                            <Badge tone="neutral" className="text-[10px] px-2 py-0">
                              Não categorizada
                            </Badge>
                          )}

                          {hasChildren && (
                            <span className="text-[10px] text-text-dim tabular-nums">
                              ({c.children!.length})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:gap-6 shrink-0 tabular-nums">
                        <div className="text-right">
                          <p className="font-semibold text-white">{formatMoney(c.currentAmount)}</p>
                          <p className="text-[10px] text-text-dim">{c.percentageOfTotal}%</p>
                        </div>

                        <div className="w-16 sm:w-20 text-right">
                          <MomCell item={c} />
                        </div>
                      </div>
                    </div>

                    {isExpanded && c.children && (
                      <ul className="mt-1 mb-1.5 space-y-0.5 rounded-xl bg-surface-2/40 py-1.5 px-2">
                        {c.children.map((sub, subIdx) => (
                          <li
                            key={sub.id ?? `sub-${subIdx}-${sub.name}`}
                            className="flex items-center justify-between gap-2 py-1 pl-3 sm:pl-4 pr-1 text-[11px]"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <CornerDownRight className="size-3 shrink-0 text-text-faint" aria-hidden="true" />
                              <span
                                className="size-2 rounded-full shrink-0"
                                style={{ background: sub.color }}
                              />
                              {!sub.isDirectGeneral && sub.icon && <span className="shrink-0">{sub.icon}</span>}
                              {sub.isDirectGeneral ? (
                                <span className="truncate italic text-text-muted">Sem específica</span>
                              ) : (
                                <span className="truncate text-text-muted">{sub.name}</span>
                              )}
                              {sub.isDirectGeneral && (
                                <Badge tone="default" className="text-[11px] px-1.5 py-0 shrink-0">
                                  Direto na geral
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-3 sm:gap-6 shrink-0 tabular-nums">
                              <div className="text-right">
                                <p className="font-medium text-white">{formatMoney(sub.currentAmount)}</p>
                                <p className="text-[10px] text-text-dim">
                                  {sub.percentageOfTotal}%
                                  {sub.percentageOfParent !== undefined ? ` (${sub.percentageOfParent}% da geral)` : ''}
                                </p>
                              </div>

                              <div className="w-16 sm:w-20 text-right">
                                <MomCell item={sub} />
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

export default function CategoryEvolutionSection({ categories }: CategoryEvolutionSectionProps) {
  const [viewMode, setViewMode] = useState<CategoryReportMode>('BOTH')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())

  const specificItems = useMemo(() => {
    const flat: CategoryComparison[] = []
    categories.forEach((c) => {
      if (c.isUncategorized || (c.name === 'Sem categoria' && (!c.children || c.children.length === 0))) {
        flat.push({ ...c, isUncategorized: true })
        return
      }
      if (c.children && c.children.length > 0) {
        c.children.forEach((sub) => {
          flat.push({
            ...sub,
            parentName: sub.parentName ?? c.name,
            parentIcon: sub.parentIcon ?? c.icon ?? null,
            parentColor: sub.parentColor ?? c.color,
          })
        })
      } else {
        flat.push(c)
      }
    })
    return flat.sort(
      (a, b) =>
        b.currentAmount - a.currentAmount ||
        b.previousAmount - a.previousAmount ||
        a.name.localeCompare(b.name, 'pt-BR'),
    )
  }, [categories])

  const toggleExpand = (key: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-6 mb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <PieIcon className="size-4 text-violet" />
            <span>Evolução por Categoria & Comparativo Mensal (MoM)</span>
            <InfoTooltip
              title="Evolução por Categoria"
              content="Distinção entre Categorias Gerais (visão consolidada) e Categorias Específicas (subcategorias e lançamentos diretos na geral), com variação percentual MoM."
              align="start"
            />
          </h2>
          <p className="text-xs text-text-dim">
            Distribuição dos gastos no mês com distinção entre categorias gerais e específicas
          </p>
        </div>

        <div className="inline-flex flex-wrap gap-1 rounded-xl bg-surface-1 p-1 border border-border card-highlight">
          {(
            [
              { key: 'BOTH', label: 'Ambas (Gerais e Específicas)' },
              { key: 'GENERAL', label: 'Apenas Gerais' },
              { key: 'SPECIFIC', label: 'Apenas Específicas' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setViewMode(opt.key)}
              className={clsx(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer select-none',
                viewMode === opt.key
                  ? 'bg-accent text-canvas font-semibold shadow-sm shadow-accent/25'
                  : 'text-ink-secondary hover:text-ink-primary',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {(viewMode === 'BOTH' || viewMode === 'GENERAL') && (
        <CategoryBreakdownBlock
          title="Categorias Gerais"
          subtitle="Visão macro consolidada (inclui transações diretas na geral e suas subcategorias)"
          icon={FolderTree}
          columnLabel="Categoria geral"
          items={categories}
          expandable
          expandedIds={expandedIds}
          onToggleExpand={toggleExpand}
        />
      )}

      {(viewMode === 'BOTH' || viewMode === 'SPECIFIC') && (
        <CategoryBreakdownBlock
          title="Categorias Específicas"
          subtitle="Visão detalhada por subcategoria, identificando a categoria geral pai"
          icon={Tags}
          columnLabel="Categoria específica"
          items={specificItems}
          showParentBadge
        />
      )}
    </div>
  )
}
