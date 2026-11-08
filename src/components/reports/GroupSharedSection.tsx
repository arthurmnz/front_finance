import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronRight, CreditCard, HandCoins, Users } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import { Card } from '@/components/ui'
import type { SharedGroupBalance } from './types'

interface GroupSharedSectionProps {
  data: SharedGroupBalance
}

export default function GroupSharedSection({ data }: GroupSharedSectionProps) {
  const hasActivity =
    data.spentByMeOnSharedCards > 0 ||
    data.spentByOthersOnMyCards > 0 ||
    data.totalOwedByMe > 0 ||
    data.totalReceivableByMe > 0 ||
    data.groups.some(
      (g) =>
        g.owedCurrentMonth > 0 ||
        g.receivableCurrentMonth > 0 ||
        g.owedTotal > 0 ||
        g.receivableTotal > 0,
    )

  return (
    <div className="space-y-4 mb-8">
      <div>
        <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
          <Users className="size-4 text-lime" />
          Balanço Compartilhado & Acertos de Grupos
        </h2>
        <p className="text-xs text-text-dim">
          Gastos cruzados em cartões compartilhados e acertos pendentes entre membros nos grupos
        </p>
      </div>

      {!hasActivity ? (
        <Card className="p-6 bg-surface-1 border-border text-center">
          <div className="mx-auto w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-text-muted mb-3">
            <CheckCircle2 className="size-5 text-lime" />
          </div>
          <h3 className="text-sm font-semibold text-white">Sem pendências ou gastos compartilhados</h3>
          <p className="text-xs text-text-dim mt-1 max-w-md mx-auto">
            Você não possui compras em cartões de terceiros nem acertos pendentes registrados para este período.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Métricas Rápidas de Gastos Cruzados e Acertos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4 bg-surface-1 border-border">
              <div className="flex items-center justify-between text-text-dim mb-1">
                <span className="text-xs font-medium">Gastei em Cartões de Outros</span>
                <CreditCard className="size-3.5 text-lime" />
              </div>
              <p className="text-lg font-bold text-white tracking-tight">
                {formatMoney(data.spentByMeOnSharedCards)}
              </p>
              <p className="text-[11px] text-text-dim mt-1">
                Suas compras em cartões do grupo
              </p>
            </Card>

            <Card className="p-4 bg-surface-1 border-border">
              <div className="flex items-center justify-between text-text-dim mb-1">
                <span className="text-xs font-medium">Outros Gastaram no Meu Cartão</span>
                <CreditCard className="size-3.5 text-purple-400" />
              </div>
              <p className="text-lg font-bold text-white tracking-tight">
                {formatMoney(data.spentByOthersOnMyCards)}
              </p>
              <p className="text-[11px] text-text-dim mt-1">
                Reembolsos devidos ao seu cartão
              </p>
            </Card>

            <Card className="p-4 bg-surface-1 border-border">
              <div className="flex items-center justify-between text-text-dim mb-1">
                <span className="text-xs font-medium">Devo no Mês (Grupos)</span>
                <HandCoins className="size-3.5 text-rose-400" />
              </div>
              <p className="text-lg font-bold text-rose-400 tracking-tight">
                {formatMoney(data.totalOwedByMe)}
              </p>
              <p className="text-[11px] text-text-dim mt-1">
                Pendências a acertar com outros
              </p>
            </Card>

            <Card className="p-4 bg-surface-1 border-border">
              <div className="flex items-center justify-between text-text-dim mb-1">
                <span className="text-xs font-medium">Tenho a Receber (Grupos)</span>
                <HandCoins className="size-3.5 text-lime" />
              </div>
              <p className="text-lg font-bold text-lime tracking-tight">
                {formatMoney(data.totalReceivableByMe)}
              </p>
              <p className="text-[11px] text-text-dim mt-1">
                Valores que devem a você no mês
              </p>
            </Card>
          </div>

          {/* Listagem de Grupos com Pendências ou Gastos */}
          {data.groups.length > 0 && (
            <Card className="bg-surface-1 border-border overflow-hidden">
              <div className="p-3 border-b border-border bg-surface-2/40">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Detalhamento por Grupo
                </h3>
              </div>
              <div className="divide-y divide-border">
                {data.groups.map((g) => (
                  <div
                    key={g.groupId}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-2/20 transition-colors"
                  >
                    <div>
                      <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                        {g.groupName}
                      </h4>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-text-dim">
                        <span>
                          No mês:{' '}
                          {g.owedCurrentMonth > 0 ? (
                            <span className="text-rose-400 font-medium">
                              Devo {formatMoney(g.owedCurrentMonth)}
                            </span>
                          ) : g.receivableCurrentMonth > 0 ? (
                            <span className="text-lime font-medium">
                              Recebo {formatMoney(g.receivableCurrentMonth)}
                            </span>
                          ) : (
                            <span className="text-text-muted">Quadro zerado</span>
                          )}
                        </span>
                        {(g.owedTotal > 0 || g.receivableTotal > 0) && (
                          <span className="text-[11px] text-text-dim">
                            (Total acumulado:{' '}
                            {g.owedTotal > 0
                              ? `Devo ${formatMoney(g.owedTotal)}`
                              : `Recebo ${formatMoney(g.receivableTotal)}`}
                            )
                          </span>
                        )}
                      </div>
                    </div>

                    <Link
                      to={`/grupos/${g.groupId}?tab=settlements`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-lime bg-lime/10 hover:bg-lime/20 rounded-lg transition-colors w-fit"
                    >
                      Ver acertos
                      <ChevronRight className="size-3.5" />
                    </Link>
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
