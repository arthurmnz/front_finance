import { CheckCircle2, AlertTriangle, ShieldCheck, TrendingUp } from 'lucide-react'
import clsx from 'clsx'
import { formatMoney } from '@/lib/format'
import { Badge, Card, InfoTooltip } from '@/components/ui'
import type { FinancialPlanningData } from './types'

interface FinancialPlanningSectionProps {
  data: FinancialPlanningData
  windowMonths: 6 | 12
  onWindowChange: (w: 6 | 12) => void
}

export default function FinancialPlanningSection({
  data,
  windowMonths,
  onWindowChange,
}: FinancialPlanningSectionProps) {
  const hasCoverage = data.averageMonthlyCost > 0
  const isHealthyCoverage = data.savingsCoverageMonths >= 6
  const isModerateCoverage = data.savingsCoverageMonths >= 1 && data.savingsCoverageMonths < 6

  return (
    <div className="space-y-4 mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="size-4 text-lime" />
            <span>Patrimônio Guardado & Custo de Vida</span>
            <InfoTooltip
              title="Patrimônio Guardado & Custo Médio"
              content="Visão consolidada da sua reserva de emergência e investimentos, isolados dos gastos diários de consumo, além do cálculo do seu custo médio mensal estimado (gastos fixos + média variável)."
              align="start"
            />
          </h2>
          <p className="text-xs text-text-dim">
            Valores poupados, investimentos acumulados e estimativa da sua despesa mensal média
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {/* 1. Reserva de Emergência */}
        <Card className="p-4 bg-surface-1 border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-text-dim mb-1">
              <span className="flex items-center gap-1.5 font-medium text-text-muted">
                Reserva de Emergência
                <InfoTooltip
                  title="Reserva de Emergência"
                  content="Soma de todos os saldos em contas do tipo Reserva. Contas de reserva não entram em relatórios sobre despesas mensais operacionais."
                  align="start"
                />
              </span>
              <div className="p-1.5 rounded-lg bg-lime/10 text-lime">
                <ShieldCheck className="size-4" />
              </div>
            </div>

            <p className="text-2xl font-bold text-white tabular-nums tracking-tight">
              {formatMoney(data.totalSavings)}
            </p>

            <div className="mt-2.5">
              {hasCoverage ? (
                <div className="inline-flex items-center gap-1.5">
                  <Badge
                    tone={isHealthyCoverage ? 'income' : isModerateCoverage ? 'neutral' : 'expense'}
                    className="font-medium"
                  >
                    {isHealthyCoverage ? (
                      <CheckCircle2 className="size-3 mr-0.5 inline text-lime" />
                    ) : isModerateCoverage ? (
                      <AlertTriangle className="size-3 mr-0.5 inline text-amber-400" />
                    ) : (
                      <AlertTriangle className="size-3 mr-0.5 inline text-expense" />
                    )}
                    Cobre {data.savingsCoverageMonths.toLocaleString('pt-BR')} meses do seu custo médio
                  </Badge>
                </div>
              ) : (
                <span className="text-[11px] text-text-dim">
                  Cadastre gastos fixos ou movimentações para estimar a cobertura
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px] text-text-dim">
            <span>
              {data.savingsAccountsCount} {data.savingsAccountsCount === 1 ? 'conta reserva' : 'contas reserva'}
            </span>
            <span className="text-text-muted">Isolada de gastos diários</span>
          </div>
        </Card>

        {/* 2. Carteira de Investimentos */}
        <Card className="p-4 bg-surface-1 border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-text-dim mb-1">
              <span className="flex items-center gap-1.5 font-medium text-text-muted">
                Investimentos
                <InfoTooltip
                  title="Investimentos"
                  content="Soma de todas as contas do tipo Investimentos (renda fixa, renda variável, CDBs, etc.). Separados do fluxo de caixa e de previsões de despesas de consumo."
                  align="start"
                />
              </span>
              <div className="p-1.5 rounded-lg bg-violet/15 text-violet">
                <TrendingUp className="size-4" />
              </div>
            </div>

            <p className="text-2xl font-bold text-white tabular-nums tracking-tight">
              {formatMoney(data.totalInvestments)}
            </p>

            <div className="mt-2.5">
              <span className="inline-flex items-center text-[11px] font-medium text-violet px-2 py-0.5 rounded-full bg-violet/10 border border-violet/20">
                Patrimônio investido acumulado
              </span>
            </div>
          </div>

          <div className="mt-4 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px] text-text-dim">
            <span>
              {data.investmentAccountsCount} {data.investmentAccountsCount === 1 ? 'conta' : 'contas'} de investimento
            </span>
            <span className="text-text-muted">Fora de gastos de consumo</span>
          </div>
        </Card>

        {/* 3. Custo Médio Mensal */}
        <Card className="p-4 bg-surface-1 border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-text-dim mb-1">
              <span className="flex items-center gap-1.5 font-medium text-text-muted">
                Custo Médio Mensal
                <InfoTooltip
                  title="Custo Médio Mensal"
                  content="Composto pelos gastos fixos contínuos (aluguel, internet, assinaturas recorrentes) somados à média mensal dos gastos variáveis (avulsos e compras parceladas) no histórico de 6 ou 12 meses."
                  align="end"
                />
              </span>

              {/* Seletor de Janela: 6 meses vs 12 meses */}
              <div className="inline-flex rounded-lg bg-surface-2 p-0.5 border border-border">
                <button
                  type="button"
                  onClick={() => onWindowChange(6)}
                  className={clsx(
                    'px-2 py-0.5 text-[11px] font-semibold rounded-md transition select-none',
                    windowMonths === 6
                      ? 'bg-violet text-white shadow-sm'
                      : 'text-text-dim hover:text-white',
                  )}
                  title="Calcular média variável dos últimos 6 meses"
                >
                  6m
                </button>
                <button
                  type="button"
                  onClick={() => onWindowChange(12)}
                  className={clsx(
                    'px-2 py-0.5 text-[11px] font-semibold rounded-md transition select-none',
                    windowMonths === 12
                      ? 'bg-violet text-white shadow-sm'
                      : 'text-text-dim hover:text-white',
                  )}
                  title="Calcular média variável dos últimos 12 meses"
                >
                  12m
                </button>
              </div>
            </div>

            <p className="text-2xl font-bold text-expense tabular-nums tracking-tight">
              {formatMoney(data.averageMonthlyCost)}
              <span className="text-xs font-normal text-text-dim ml-1">/mês</span>
            </p>

            {/* Detalhamento de Fixos vs Variáveis */}
            <div className="mt-3 space-y-1.5 pt-2 border-t border-border/40 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-text-dim flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-violet" />
                  Gastos Fixos (contínuos):
                </span>
                <span className="font-semibold text-white tabular-nums">
                  {formatMoney(data.fixedMonthlyCost)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-dim flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-lime" />
                  Média Variável ({data.calculationWindowMonths}m):
                </span>
                <span className="font-semibold text-white tabular-nums">
                  {formatMoney(data.variableMonthlyAverage)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px] text-text-dim">
            <span>
              Base: {data.monthsAnalyzedCount} {data.monthsAnalyzedCount === 1 ? 'mês' : 'meses'} com dados
            </span>
            <span className="text-text-muted">Fixos + Média Variável</span>
          </div>
        </Card>
      </div>
    </div>
  )
}
