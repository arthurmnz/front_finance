import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { PieChart as PieIcon, ArrowDown, ArrowUp, Sparkles } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import { Badge, Card, Empty, InfoTooltip } from '@/components/ui'
import type { CategoryComparison } from './types'

interface CategoryEvolutionSectionProps {
  categories: CategoryComparison[]
}

export default function CategoryEvolutionSection({ categories }: CategoryEvolutionSectionProps) {
  const chartData = categories
    .filter((c) => c.currentAmount > 0)
    .map((c) => ({
      name: c.name,
      value: c.currentAmount,
      color: c.color,
    }))

  const hasData = chartData.length > 0

  return (
    <div className="space-y-4 mb-8">
      <div>
        <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
          <PieIcon className="size-4 text-violet" />
          <span>Evolução por Categoria & Comparativo Mensal (MoM)</span>
          <InfoTooltip
            title="Evolução por Categoria"
            content="Distribuição proporcional dos gastos do mês por categoria e taxa de variação percentual (MoM) comparada às despesas do mês anterior."
            align="start"
          />
        </h2>
        <p className="text-xs text-text-dim">
          Distribuição dos gastos no mês e variação percentual em relação ao mês anterior
        </p>
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
                      background: '#0e0e13',
                      border: '1px solid #20202d',
                      borderRadius: 12,
                      color: '#ffffff',
                    }}
                    itemStyle={{ color: '#ffffff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Tabela/Ranking com Comparativo MoM */}
        <Card className="p-4 bg-surface-1 border-border md:col-span-7">
          <div className="mb-3 flex items-center justify-between border-b border-border/60 pb-2 text-xs font-semibold text-text-dim">
            <span>Categoria</span>
            <div className="flex items-center gap-6">
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

          {!categories.length ? (
            <Empty title="Nenhuma categoria para comparar." />
          ) : (
            <ul className="divide-y divide-border/60 max-h-72 overflow-y-auto pr-1">
              {categories.map((c, idx) => (
                <li key={c.id ?? `cat-${idx}`} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className="size-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                    <span className="truncate font-medium text-white">{c.name}</span>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 tabular-nums">
                    <div className="text-right">
                      <p className="font-semibold text-white">{formatMoney(c.currentAmount)}</p>
                      <p className="text-[10px] text-text-dim">{c.percentageOfTotal}%</p>
                    </div>

                    <div className="w-20 text-right">
                      {c.isNew ? (
                        <Badge tone="primary" className="text-[10px] gap-1 inline-flex items-center">
                          <Sparkles className="size-2.5 text-lime" /> Novo
                        </Badge>
                      ) : c.momVariationPct !== null ? (
                        <span
                          className={`inline-flex items-center gap-0.5 font-medium ${
                            c.momVariationPct > 0 ? 'text-expense' : 'text-lime'
                          }`}
                        >
                          {c.momVariationPct > 0 ? (
                            <ArrowUp className="size-3" />
                          ) : (
                            <ArrowDown className="size-3" />
                          )}
                          {Math.abs(c.momVariationPct)}%
                        </span>
                      ) : (
                        <span className="text-text-dim">—</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
