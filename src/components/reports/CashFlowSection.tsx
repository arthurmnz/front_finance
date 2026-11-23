import { Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowLeftRight } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import { Card, InfoTooltip } from '@/components/ui'
import type { MonthlyCashFlow } from './types'

interface CashFlowSectionProps {
  data: MonthlyCashFlow[]
}

export default function CashFlowSection({ data }: CashFlowSectionProps) {
  const chartData = data.map((d) => ({
    name: d.label,
    Receitas: d.income / 100,
    Despesas: -Math.abs(d.expense) / 100,
    'Saldo Líquido': d.net / 100,
  }))

  return (
    <div className="space-y-4 mb-8">
      <div>
        <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
          <ArrowLeftRight className="size-4 text-income" />
          <span>Fluxo de Caixa dos Últimos 6 Meses</span>
          <InfoTooltip
            title="Fluxo de Caixa (6 Meses)"
            content="Acompanhamento histórico da receita, despesa e saldo líquido gerado mês a mês para análise de consistência e capacidade de poupança no médio prazo."
            align="start"
          />
        </h2>
        <p className="text-xs text-text-dim">
          Comparação histórica de receitas, despesas e a capacidade líquida de poupança ao longo do tempo
        </p>
      </div>

      <Card className="p-4 bg-surface-1 border-border">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255, 255, 255, 0.1)" strokeDasharray="3 3" vertical={false} />
              <ReferenceLine y={0} stroke="rgba(255, 255, 255, 0.22)" strokeWidth={1.5} />
              <XAxis dataKey="name" stroke="#a1a1aa" fontSize={11} tickLine={false} />
              <YAxis
                stroke="#a1a1aa"
                fontSize={11}
                tickLine={false}
                tickFormatter={(v) => {
                  const num = Number(v)
                  if (num < 0) return `-R$ ${Math.abs(num).toLocaleString('pt-BR')}`
                  return `R$ ${num.toLocaleString('pt-BR')}`
                }}
              />
              <Tooltip
                formatter={(v, name) => [formatMoney(Math.round(Number(v) * 100)), name]}
                contentStyle={{
                  background: '#111114',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 12,
                  color: '#f4f4f5',
                }}
                itemStyle={{ color: '#f4f4f5' }}
              />
              <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />
              <Bar dataKey="Receitas" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Despesas" fill="#FF4D6A" radius={[0, 0, 4, 4]} maxBarSize={32} />
              <Line
                type="monotone"
                dataKey="Saldo Líquido"
                stroke="#fbbf24"
                strokeWidth={2.5}
                dot={{ fill: '#fbbf24', r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}
