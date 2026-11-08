import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarClock, CreditCard, Wallet } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import { Card } from '@/components/ui'
import type { FutureMonthCommitment } from './types'

interface FutureCommitmentsSectionProps {
  commitments: FutureMonthCommitment[]
}

export default function FutureCommitmentsSection({ commitments }: FutureCommitmentsSectionProps) {
  const chartData = commitments.map((c) => ({
    name: c.label,
    'Faturas de Cartão': c.cardCommitted / 100,
    'Contas Pendentes': c.accountPending / 100,
  }))

  const totalFuture = commitments.reduce((s, c) => s + c.totalCommitted, 0)

  return (
    <div className="space-y-4 mb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <CalendarClock className="size-4 text-lime" />
            Projeção de Compromissos Futuros (Próximos 6 Meses)
          </h2>
          <p className="text-xs text-text-dim">
            Parcelas de cartão já contratadas e despesas fixas agendadas em conta
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-text-dim">Total já comprometido nos 6 meses: </span>
          <span className="text-sm font-bold text-white tabular-nums">{formatMoney(totalFuture)}</span>
        </div>
      </div>

      <Card className="p-4 bg-surface-1 border-border">
        <div className="h-64 w-full mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#20202d" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" stroke="#8E8EA0" fontSize={11} tickLine={false} />
              <YAxis
                stroke="#8E8EA0"
                fontSize={11}
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
              <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />
              <Bar dataKey="Faturas de Cartão" stackId="a" fill="#7D39EB" radius={[0, 0, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Contas Pendentes" stackId="a" fill="#C6FF33" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Grade de cartões dos 6 meses */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-3 border-t border-border/60">
          {commitments.map((c) => (
            <div key={c.label} className="rounded-xl bg-surface-2 p-2.5 text-center">
              <span className="text-[11px] font-medium text-text-dim block uppercase">{c.label}</span>
              <p className="mt-1 text-sm font-bold text-white tabular-nums">{formatMoney(c.totalCommitted)}</p>
              <div className="mt-1.5 space-y-0.5 text-[10px] text-text-dim text-left">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <CreditCard className="size-2.5 text-violet" /> Cartão
                  </span>
                  <span className="tabular-nums">{formatMoney(c.cardCommitted)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Wallet className="size-2.5 text-lime" /> Conta
                  </span>
                  <span className="tabular-nums">{formatMoney(c.accountPending)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
