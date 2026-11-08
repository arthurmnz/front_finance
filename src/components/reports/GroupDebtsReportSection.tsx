import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ChevronRight, HandCoins, Scale } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import { Card, InfoTooltip } from '@/components/ui'
import type { GroupDebtsResponse } from '@/lib/types'
import type { ReportPeriod } from './types'

interface GroupDebtsReportSectionProps {
  groupId: string
  debts?: GroupDebtsResponse
  period: ReportPeriod
}

export default function GroupDebtsReportSection({
  groupId,
  debts,
  period,
}: GroupDebtsReportSectionProps) {
  const currentMonthDebt = debts?.monthlyBalances?.find(
    (b) => b.month === period.month && b.year === period.year,
  )

  const pairBalances = currentMonthDebt?.userBalances ?? []
  const hasDebts = pairBalances.length > 0 || (debts?.totalOwedByMe ?? 0) > 0 || (debts?.totalReceivableByMe ?? 0) > 0

  return (
    <div className="space-y-4 mb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <Scale className="size-4 text-lime" />
            <span>Balanço de Acertos entre Membros</span>
            <InfoTooltip
              title="Acertos do Grupo"
              content="Cálculo compensatório de dívidas e créditos entre os membros do grupo decorrentes de compras individuais realizadas em recursos de terceiros."
              align="start"
            />
          </h2>
          <p className="text-xs text-text-dim">
            Compensação de despesas e saldos líquidos a acertar entre os membros do grupo
          </p>
        </div>

        <Link
          to={`/grupos/${groupId}?tab=settlements`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-lime bg-lime/10 hover:bg-lime/20 rounded-lg transition-colors"
        >
          Ir para acertos do grupo
          <ChevronRight className="size-3.5" />
        </Link>
      </div>

      {!hasDebts ? (
        <Card className="p-6 bg-surface-1 border-border text-center">
          <div className="mx-auto w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-text-muted mb-3">
            <CheckCircle2 className="size-5 text-lime" />
          </div>
          <p className="text-sm font-semibold text-white">Contas e acertos equilibrados</p>
          <p className="text-xs text-text-dim mt-1 max-w-md mx-auto">
            Não existem pendências financeiras registradas entre os membros deste grupo para o período selecionado.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Métricas rápidas de dívidas para o usuário logado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card className="p-4 bg-surface-1 border-border">
              <div className="flex items-center justify-between text-text-dim mb-1">
                <span className="text-xs font-medium flex items-center gap-1.5">
                  Você deve neste grupo
                  <InfoTooltip
                    content="Total que você precisa reembolsar a outros membros pelas compras feitas em contas ou cartões deles."
                    align="start"
                  />
                </span>
                <HandCoins className="size-3.5 text-rose-400" />
              </div>
              <p className="text-xl font-bold text-rose-400 tracking-tight">
                {formatMoney(debts?.totalOwedByMe ?? 0)}
              </p>
              <p className="text-[11px] text-text-dim mt-1">Saldo devedor total acumulado</p>
            </Card>

            <Card className="p-4 bg-surface-1 border-border">
              <div className="flex items-center justify-between text-text-dim mb-1">
                <span className="text-xs font-medium flex items-center gap-1.5">
                  Você tem a receber neste grupo
                  <InfoTooltip
                    content="Total que outros membros precisam lhe reembolsar pelas compras que eles fizeram em suas contas ou cartões."
                    align="end"
                  />
                </span>
                <HandCoins className="size-3.5 text-lime" />
              </div>
              <p className="text-xl font-bold text-lime tracking-tight">
                {formatMoney(debts?.totalReceivableByMe ?? 0)}
              </p>
              <p className="text-[11px] text-text-dim mt-1">Saldo credor total acumulado</p>
            </Card>
          </div>

          {/* Lista de Saldos entre Pares no Mês */}
          {pairBalances.length > 0 && (
            <Card className="bg-surface-1 border-border overflow-hidden">
              <div className="p-3 border-b border-border bg-surface-2/40">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Saldos Líquidos a Compensar ({period.month}/{period.year})
                </h3>
              </div>
              <div className="divide-y divide-border">
                {pairBalances.map((pair, idx) => (
                  <div
                    key={`${pair.debtor.id}-${pair.creditor.id}-${idx}`}
                    className="p-3.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-white truncate">
                        {pair.debtor.firstName} {pair.debtor.lastName}
                      </span>
                      <ArrowRight className="size-3.5 text-text-dim shrink-0" />
                      <span className="font-semibold text-text-muted truncate">
                        {pair.creditor.firstName} {pair.creditor.lastName}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-bold text-rose-400 text-sm">
                        {formatMoney(pair.netAmount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
