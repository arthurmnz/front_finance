import { ArrowDownRight, ArrowUpRight, Calendar, CreditCard, PiggyBank, TrendingDown } from 'lucide-react'
import clsx from 'clsx'
import { formatMoney } from '@/lib/format'
import { Badge, Card } from '@/components/ui'
import type { KpiData } from './types'

interface KpiSectionProps {
  kpis: KpiData
}

export default function KpiSection({ kpis }: KpiSectionProps) {
  const isNetPositive = kpis.net >= 0
  const isSavingsPositive = kpis.savingsRate > 0

  return (
    <div className="space-y-4 mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white tracking-tight">Saúde Financeira do Mês</h2>
          <p className="text-xs text-text-dim">Indicadores essenciais de desempenho e previsibilidade</p>
        </div>
      </div>

      {/* Grid com os 4 cards principais */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Resultado do Mês */}
        <Card className="p-4 bg-surface-1 border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-text-dim mb-1">
              <span>Resultado do Mês</span>
              {isNetPositive ? (
                <ArrowUpRight className="size-4 text-lime" />
              ) : (
                <ArrowDownRight className="size-4 text-rose-400" />
              )}
            </div>
            <p
              className={clsx(
                'text-2xl font-bold tabular-nums tracking-tight',
                isNetPositive ? 'text-lime' : 'text-white',
              )}
            >
              {isNetPositive ? '+' : ''}
              {formatMoney(kpis.net)}
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px] text-text-dim">
            <span className="text-lime">Receitas: {formatMoney(kpis.income)}</span>
            <span className="text-white">Despesas: {formatMoney(kpis.expense)}</span>
          </div>
        </Card>

        {/* 2. Taxa de Poupança */}
        <Card className="p-4 bg-surface-1 border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-text-dim mb-1">
              <span>Taxa de Poupança</span>
              <PiggyBank className="size-4 text-violet" />
            </div>
            <div className="flex items-baseline gap-2">
              <p
                className={clsx(
                  'text-2xl font-bold tabular-nums tracking-tight',
                  isSavingsPositive ? 'text-lime' : 'text-white',
                )}
              >
                {kpis.savingsRate}%
              </p>
              <Badge tone={isSavingsPositive ? 'income' : 'neutral'}>
                {isSavingsPositive ? 'Poupando' : 'Sem sobra'}
              </Badge>
            </div>
          </div>
          <p className="mt-3 pt-2.5 border-t border-border/60 text-[11px] text-text-dim">
            {kpis.income > 0
              ? `${kpis.savingsRate}% das receitas líquidas preservadas`
              : 'Sem receitas registradas no período'}
          </p>
        </Card>

        {/* 3. Ritmo Diário & Fechamento Previsto */}
        <Card className="p-4 bg-surface-1 border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-text-dim mb-1">
              <span>Média de Gasto Diário</span>
              <TrendingDown className="size-4 text-white" />
            </div>
            <p className="text-2xl font-bold text-white tabular-nums tracking-tight">
              {formatMoney(kpis.dailyAverage)}
              <span className="text-xs font-normal text-text-dim ml-1">/dia</span>
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px] text-text-dim">
            <span>Previsão mês:</span>
            <span className="font-semibold text-white tabular-nums">{formatMoney(kpis.projectedMonthEnd)}</span>
          </div>
        </Card>

        {/* 4. Menor Saldo no Calendário */}
        <Card className="p-4 bg-surface-1 border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-text-dim mb-1">
              <span>Menor Caixa no Mês</span>
              <Calendar className="size-4 text-lime" />
            </div>
            <p
              className={clsx(
                'text-2xl font-bold tabular-nums tracking-tight',
                kpis.minBalanceAmount < 0 ? 'text-rose-400' : 'text-white',
              )}
            >
              {formatMoney(kpis.minBalanceAmount)}
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px] text-text-dim">
            <span>Ponto crítico:</span>
            <Badge tone={kpis.minBalanceAmount < 0 ? 'primary' : 'neutral'}>Dia {kpis.minBalanceDay}</Badge>
          </div>
        </Card>
      </div>

      {/* 5. Comprometimento Cartão vs. Contas (Barra visual moderna) */}
      <Card className="p-4 bg-surface-1 border-border">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 text-violet" />
            <span className="text-xs font-medium text-white">Composição das Despesas: Cartão vs. Contas</span>
          </div>
          <div className="flex items-center gap-4 text-xs tabular-nums">
            <span className="flex items-center gap-1.5 text-violet">
              <span className="size-2 rounded-full bg-violet" /> Cartão ({kpis.cardSharePct}% · {formatMoney(kpis.cardExpense)})
            </span>
            <span className="flex items-center gap-1.5 text-lime">
              <span className="size-2 rounded-full bg-lime" /> Contas/À vista ({100 - kpis.cardSharePct}% · {formatMoney(kpis.accountExpense)})
            </span>
          </div>
        </div>

        {/* Barra de progresso dupla */}
        <div className="h-3 w-full overflow-hidden rounded-full bg-surface-2 flex">
          <div
            className="h-full bg-violet transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, kpis.cardSharePct))}%` }}
            title={`Cartão: ${kpis.cardSharePct}%`}
          />
          <div
            className="h-full bg-lime transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, 100 - kpis.cardSharePct))}%` }}
            title={`Contas: ${100 - kpis.cardSharePct}%`}
          />
        </div>
      </Card>
    </div>
  )
}
