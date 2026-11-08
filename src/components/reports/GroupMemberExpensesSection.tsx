import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { User, Users } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import { PALETTE } from '@/lib/palette'
import { Card, InfoTooltip } from '@/components/ui'
import type { GroupMemberExpense } from './types'

interface GroupMemberExpensesSectionProps {
  memberExpenses: GroupMemberExpense[]
}

const roleLabel: Record<string, string> = {
  OWNER: 'Proprietário',
  ADMIN: 'Administrador',
  MEMBER: 'Membro',
}

export default function GroupMemberExpensesSection({ memberExpenses }: GroupMemberExpensesSectionProps) {
  const activeExpenses = memberExpenses.filter((m) => m.totalExpense > 0)
  const totalGroupExpense = activeExpenses.reduce((s, m) => s + m.totalExpense, 0)

  const chartData = activeExpenses.map((m, idx) => ({
    name: m.name,
    value: m.totalExpense / 100,
    color: PALETTE[idx % PALETTE.length],
  }))

  return (
    <div className="space-y-4 mb-8">
      <div>
        <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
          <Users className="size-4 text-lime" />
          <span>Despesas por Membro Responsável</span>
          <InfoTooltip
            title="Despesas por Membro"
            content="Totalização e participação relativa de compras realizadas por cada membro nas contas e cartões compartilhados do grupo no período."
            align="start"
          />
        </h2>
        <p className="text-xs text-text-dim">
          Participação e volume de gastos de cada membro nas compras do grupo neste mês
        </p>
      </div>

      {activeExpenses.length === 0 ? (
        <Card className="p-6 bg-surface-1 border-border text-center">
          <p className="text-sm font-semibold text-white">Nenhum gasto registrado pelos membros</p>
          <p className="text-xs text-text-dim mt-1">
            Não há despesas realizadas por membros nas contas ou cartões do grupo neste período.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Gráfico de Rosca */}
          <Card className="p-4 bg-surface-1 border-border flex flex-col items-center justify-center">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider self-start mb-2 flex items-center gap-1.5">
              <span>Distribuição Relativa</span>
              <InfoTooltip
                content="Percentual de cada membro sobre o valor total de despesas do grupo neste mês."
                align="start"
              />
            </h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
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
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center mt-1">
              <p className="text-xs text-text-dim">Total de Despesas</p>
              <p className="text-lg font-bold text-expense tracking-tight">
                {formatMoney(totalGroupExpense)}
              </p>
            </div>
          </Card>

          {/* Ranking e Lista de Membros */}
          <div className="lg:col-span-2 space-y-2.5">
            {memberExpenses.map((m, idx) => {
              const color = PALETTE[idx % PALETTE.length]
              const initials = m.name
                .split(' ')
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase() ?? '')
                .join('')

              return (
                <Card
                  key={m.memberId}
                  className="p-3.5 bg-surface-1 border-border hover:bg-surface-2/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white shadow-sm"
                        style={{ backgroundColor: color }}
                      >
                        {initials || <User className="size-4" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-white">{m.name}</p>
                          <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-medium text-text-dim">
                            {roleLabel[m.role] || m.role}
                          </span>
                        </div>
                        <p className="truncate text-xs text-text-dim">
                          {m.txCount} {m.txCount === 1 ? 'compra' : 'compras'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-expense tracking-tight">
                        {formatMoney(m.totalExpense)}
                      </p>
                      <span className="text-xs font-medium text-lime">
                        {m.percentage}% do total
                      </span>
                    </div>
                  </div>

                  {/* Barra de progresso individual */}
                  <div className="mt-2.5 h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${m.percentage}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
