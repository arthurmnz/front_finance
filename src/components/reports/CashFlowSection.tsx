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
          <ArrowLeftRight className="size-4 text-lime" />
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
              <CartesianGrid stroke="#20202d" strokeDasharray="3 3" vertical={false} />
              <ReferenceLine y={0} stroke="#323246" strokeWidth={1.5} />
              <XAxis dataKey="name" stroke="#8E8EA0" fontSize={11} tickLine={false} />
              <YAxis
                stroke="#8E8EA0"
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
                  background: '#0e0e13',
                  border: '1px solid #20202d',
                  borderRadius: 12,
                  color: '#ffffff',
                }}
                itemStyle={{ color: '#ffffff' }}
              />
              <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />
              <Bar dataKey="Receitas" fill="#C6FF33" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Despesas" fill="#FF4D6A" radius={[0, 0, 4, 4]} maxBarSize={32} />
              <Line
                type="monotone"
                dataKey="Saldo Líquido"
                stroke="#7D39EB"
                strokeWidth={2.5}
                dot={{ fill: '#7D39EB', r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}
