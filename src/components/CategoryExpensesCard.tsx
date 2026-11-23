import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import clsx from 'clsx'
import type { AggregatedCategoryExpense } from '@/lib/categories'
import { formatMoney } from '@/lib/format'
import type { CategoryLevel } from '@/lib/types'
import { Card, Empty, Spinner } from '@/components/ui'

export interface CategoryExpensesCardItem extends AggregatedCategoryExpense {
  isPrivateToOther?: boolean
}

interface CategoryExpensesCardProps {
  items: CategoryExpensesCardItem[]
  categoryView: CategoryLevel
  onCategoryViewChange: (mode: CategoryLevel) => void
  loading?: boolean
}

export default function CategoryExpensesCard({
  items,
  categoryView,
  onCategoryViewChange,
  loading = false,
}: CategoryExpensesCardProps) {
  const chartData = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        displayName: item.subLabel ? `${item.name} · ${item.subLabel}` : item.name,
      })),
    [items],
  )

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-white">Despesas por categoria</h2>
        <div className="inline-flex rounded-lg bg-surface-elevated p-0.5 border border-border-subtle">
          <button
            type="button"
            onClick={() => onCategoryViewChange('GENERAL')}
            className={clsx(
              'rounded-md px-2.5 py-1 text-[11px] font-medium transition cursor-pointer select-none',
              categoryView === 'GENERAL' ? 'bg-accent text-canvas font-semibold' : 'text-ink-secondary hover:text-ink-primary',
            )}
          >
            Gerais
          </button>
          <button
            type="button"
            onClick={() => onCategoryViewChange('SPECIFIC')}
            className={clsx(
              'rounded-md px-2.5 py-1 text-[11px] font-medium transition cursor-pointer select-none',
              categoryView === 'SPECIFIC' ? 'bg-accent text-canvas font-semibold' : 'text-ink-secondary hover:text-ink-primary',
            )}
          >
            Específicas
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : !items.length ? (
        <Empty title="Sem despesas no período." />
      ) : (
        <>
          <div className="h-44">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="displayName"
                  innerRadius={45}
                  outerRadius={75}
                  stroke="none"
                >
                  {chartData.map((c) => (
                    <Cell key={c.key} fill={c.color} />
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
          <ul className="mt-2 space-y-1.5">
            {items.slice(0, 5).map((c) => (
              <li key={c.key} className="flex items-center gap-2 text-xs text-text-muted">
                <span className="size-2 rounded-full shrink-0" style={{ background: c.color }} />
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  {c.isDirectGeneral ? (
                    <span className="truncate italic text-text-muted">Sem específica</span>
                  ) : (
                    <span className="truncate text-white">
                      {c.icon ? `${c.icon} ` : ''}
                      {c.name}
                    </span>
                  )}
                  {categoryView === 'SPECIFIC' && c.subLabel && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface-2 px-1.5 py-0.2 text-[11px] text-text-dim">
                      {c.generalIcon && <span aria-hidden="true">{c.generalIcon}</span>}
                      <span>{c.subLabel}</span>
                    </span>
                  )}
                  {c.isPrivateToOther && (
                    <span className="shrink-0 rounded bg-surface-2 px-1 text-[11px] text-text-dim">
                      privada
                    </span>
                  )}
                </div>
                <span className="ml-auto shrink-0 font-medium text-white tabular-nums">{formatMoney(c.value)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}
