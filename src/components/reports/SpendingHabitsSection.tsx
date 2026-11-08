import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Activity, CalendarDays } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import { Card } from '@/components/ui'
import type { CumulativeSpendingPoint, SpendingByDayOfWeek } from './types'

interface SpendingHabitsSectionProps {
  cumulativePoints: CumulativeSpendingPoint[]
  byDayOfWeek: SpendingByDayOfWeek[]
}

export default function SpendingHabitsSection({
  cumulativePoints,
  byDayOfWeek,
}: SpendingHabitsSectionProps) {
  const lineData = cumulativePoints.map((p) => ({
    dia: `Dia ${p.day}`,
    'Mês Atual': p.currentMonthAmount / 100,
    'Mês Anterior': p.previousMonthAmount / 100,
  }))

  const barData = byDayOfWeek.map((d) => ({
    name: d.dayName,
    Total: d.amount / 100,
  }))

  // Identifica o dia da semana com maior gasto
  const peakDay = byDayOfWeek.reduce(
    (max, cur) => (cur.amount > max.amount ? cur : max),
    byDayOfWeek[0] || { dayName: '-', amount: 0 },
  )

  return (
    <div className="space-y-4 mb-8">
      <div>
        <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
          <Activity className="size-4 text-lime" />
          Hábitos e Padrões de Consumo
        </h2>
        <p className="text-xs text-text-dim">
          Ritmo acumulado de gastos em relação ao mês anterior e distribuição de despesas por dia da semana
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfico 1: Ritmo Acumulado de Gastos */}
        <Card className="p-4 bg-surface-1 border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Ritmo Acumulado de Despesas</h3>
              <p className="text-xs text-text-dim">Evolução dia a dia vs. mês anterior</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={lineData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="curMonthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C6FF33" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#C6FF33" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#20202d" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="dia"
                  stroke="#8E8EA0"
                  fontSize={10}
                  tickLine={false}
                  interval={4}
                />
                <YAxis
                  stroke="#8E8EA0"
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={(v) => `R$ ${v.toLocaleString('pt-BR')}`}
                />
                <Tooltip
                  formatter={(v) => formatMoney(Math.round(Number(v) * 100))}
                  contentStyle={{
                    background: '#0e0e13',
                    border: '1px solid #20202d',
                    borderRadius: 12,
                    color: '#ffffff',
                  }}
                  itemStyle={{ color: '#ffffff' }}
                />
                <Legend wrapperStyle={{ paddingTop: 8, fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="Mês Atual"
                  stroke="#C6FF33"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#curMonthGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="Mês Anterior"
                  stroke="#8E8EA0"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Gráfico 2: Despesas por Dia da Semana */}
        <Card className="p-4 bg-surface-1 border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <CalendarDays className="size-3.5 text-text-muted" />
                Gastos por Dia da Semana
              </h3>
              <p className="text-xs text-text-dim">
                {peakDay && peakDay.amount > 0 ? (
                  <>
                    Dia com maior concentração:{' '}
                    <span className="text-white font-medium">{peakDay.dayName}</span> (
                    {formatMoney(peakDay.amount)})
                  </>
                ) : (
                  'Concentração de despesas ao longo da semana'
                )}
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#20202d" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="#8E8EA0" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#8E8EA0"
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={(v) => `R$ ${v.toLocaleString('pt-BR')}`}
                />
                <Tooltip
                  formatter={(v) => formatMoney(Math.round(Number(v) * 100))}
                  contentStyle={{
                    background: '#0e0e13',
                    border: '1px solid #20202d',
                    borderRadius: 12,
                    color: '#ffffff',
                  }}
                  itemStyle={{ color: '#ffffff' }}
                />
                <Bar dataKey="Total" fill="#7D39EB" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}
