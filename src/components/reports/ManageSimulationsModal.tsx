import { useState, useMemo } from 'react'
import {
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  CreditCard as CardIcon,
  Repeat,
  RotateCcw,
  Plus,
  AlertTriangle,
} from 'lucide-react'
import clsx from 'clsx'
import type { Account, CreditCard } from '@/lib/types'
import { formatMoney } from '@/lib/format'
import { Button, Empty, Modal } from '@/components/ui'
import type { SimulatedTransaction } from './types'

export interface ManageSimulationsModalProps {
  open: boolean
  onClose: () => void
  simulations: SimulatedTransaction[]
  onRemoveSimulation: (id: string) => void
  onClearSimulations: () => void
  onOpenCreate: () => void
  accounts: Account[]
  creditCards?: CreditCard[]
}

type FilterTab = 'ALL' | 'RECURRING' | 'CARD' | 'ACCOUNT' | 'INCOME'

export default function ManageSimulationsModal({
  open,
  onClose,
  simulations,
  onRemoveSimulation,
  onClearSimulations,
  onOpenCreate,
  accounts,
  creditCards = [],
}: ManageSimulationsModalProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL')
  const [confirmClear, setConfirmClear] = useState(false)

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])
  const cardMap = useMemo(() => new Map(creditCards.map((c) => [c.id, c.name])), [creditCards])

  // Contadores por filtro
  const counts = useMemo(() => {
    let recurring = 0
    let card = 0
    let account = 0
    let income = 0

    simulations.forEach((s) => {
      if (s.isRecurring) recurring++
      if (s.sourceMode === 'CARD' || s.creditCardId) card++
      else account++
      if (s.type === 'INCOME') income++
    })

    return { all: simulations.length, recurring, card, account, income }
  }, [simulations])

  // Lista filtrada
  const filteredList = useMemo(() => {
    return simulations.filter((s) => {
      if (activeTab === 'RECURRING') return s.isRecurring
      if (activeTab === 'CARD') return s.sourceMode === 'CARD' || !!s.creditCardId
      if (activeTab === 'ACCOUNT') return s.sourceMode !== 'CARD' && !s.creditCardId
      if (activeTab === 'INCOME') return s.type === 'INCOME'
      return true
    })
  }, [simulations, activeTab])

  // Total líquido das simulações cadastradas
  const totalNet = useMemo(() => {
    return simulations.reduce((s, sim) => {
      const isCardInstallments =
        (sim.sourceMode === 'CARD' || sim.creditCardId) &&
        sim.totalInstallments &&
        sim.totalInstallments > 1
      const totalCost = isCardInstallments ? sim.amount * (sim.totalInstallments || 1) : sim.amount
      return s + (sim.type === 'INCOME' ? sim.amount : -totalCost)
    }, 0)
  }, [simulations])

  const handleClearAllWithConfirm = () => {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    onClearSimulations()
    setConfirmClear(false)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setConfirmClear(false)
        onClose()
      }}
      title={`Gerenciar Simulações (${simulations.length})`}
      className="max-w-2xl"
    >
      <div className="space-y-4 max-h-[80vh] overflow-y-auto px-1 pr-1.5 scrollbar-thin">
        {/* Cabeçalho com Resumo */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-violet/30 bg-violet-subtle/30 p-3.5 text-xs">
          <div>
            <p className="font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="size-4 text-violet" />
              Cenário de Projeção Ativo
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">
              {simulations.length} lançamento{simulations.length > 1 ? 's' : ''} hipotético{simulations.length > 1 ? 's' : ''} registrado{simulations.length > 1 ? 's' : ''}.
            </p>
          </div>
          {simulations.length > 0 && (
            <div className="text-right">
              <span className="text-[10px] text-text-dim block">Impacto no Cenário</span>
              <span
                className={clsx(
                  'text-xs font-semibold tabular-nums',
                  totalNet >= 0 ? 'text-lime' : 'text-expense',
                )}
              >
                {totalNet >= 0 ? '+' : ''}
                {formatMoney(totalNet)}
              </span>
            </div>
          )}
        </div>

        {/* Filtros em Tabs */}
        {simulations.length > 0 && (
          <div className="flex items-center gap-1.5 border-b border-border pb-2 overflow-x-auto scrollbar-none text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={clsx(
                'rounded-lg px-2.5 py-1 font-medium transition cursor-pointer',
                activeTab === 'ALL'
                  ? 'bg-violet/20 text-violet font-semibold'
                  : 'text-text-muted hover:text-white',
              )}
            >
              Todas ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('RECURRING')}
              className={clsx(
                'rounded-lg px-2.5 py-1 font-medium transition cursor-pointer',
                activeTab === 'RECURRING'
                  ? 'bg-violet/20 text-violet font-semibold'
                  : 'text-text-muted hover:text-white',
              )}
            >
              Assinaturas ({counts.recurring})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('CARD')}
              className={clsx(
                'rounded-lg px-2.5 py-1 font-medium transition cursor-pointer',
                activeTab === 'CARD'
                  ? 'bg-violet/20 text-violet font-semibold'
                  : 'text-text-muted hover:text-white',
              )}
            >
              Cartão ({counts.card})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ACCOUNT')}
              className={clsx(
                'rounded-lg px-2.5 py-1 font-medium transition cursor-pointer',
                activeTab === 'ACCOUNT'
                  ? 'bg-violet/20 text-violet font-semibold'
                  : 'text-text-muted hover:text-white',
              )}
            >
              Conta ({counts.account})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('INCOME')}
              className={clsx(
                'rounded-lg px-2.5 py-1 font-medium transition cursor-pointer',
                activeTab === 'INCOME'
                  ? 'bg-violet/20 text-violet font-semibold'
                  : 'text-text-muted hover:text-white',
              )}
            >
              Receitas ({counts.income})
            </button>
          </div>
        )}

        {/* Lista de Simulações */}
        {filteredList.length > 0 ? (
          <div className="divide-y divide-border rounded-2xl border border-border bg-surface-1 overflow-hidden">
            {filteredList.map((sim) => {
              const isCard = sim.sourceMode === 'CARD' || !!sim.creditCardId
              const cardName =
                sim.cardName ||
                (sim.creditCardId ? cardMap.get(sim.creditCardId) : undefined) ||
                'Cartão'
              const accountName = sim.accountId ? accountMap.get(sim.accountId) : undefined
              const isInstallments = isCard && sim.totalInstallments && sim.totalInstallments > 1

              return (
                <div
                  key={sim.id}
                  className="flex items-center justify-between gap-3 p-3 hover:bg-surface-2 transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={clsx(
                        'grid size-8 shrink-0 place-items-center rounded-xl text-xs font-bold',
                        sim.type === 'INCOME'
                          ? 'bg-lime/15 text-lime'
                          : isCard
                            ? 'bg-violet/15 text-violet'
                            : 'bg-expense/15 text-expense',
                      )}
                    >
                      {sim.type === 'INCOME' ? (
                        <TrendingUp className="size-4 text-lime" />
                      ) : isCard ? (
                        <CardIcon className="size-4 text-violet" />
                      ) : (
                        <TrendingDown className="size-4 text-expense" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-sm font-semibold text-white">{sim.title}</p>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-text-dim">
                        <span>A partir de {sim.date.slice(0, 10).split('-').reverse().join('/')}</span>
                        {accountName && <span>• Conta: {accountName}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1">
                        {sim.isRecurring && (
                          <span className="rounded-md bg-violet/20 px-1.5 py-0.5 text-[10px] font-semibold text-violet flex items-center gap-1">
                            <Repeat className="size-2.5" />
                            Assinatura
                          </span>
                        )}
                        {isCard && (
                          <span className="rounded-md bg-violet/15 px-1.5 py-0.5 text-[10px] font-medium text-violet flex items-center gap-1">
                            <CardIcon className="size-2.5" />
                            {cardName}
                            {isInstallments && ` (${sim.totalInstallments}x)`}
                          </span>
                        )}
                      </div>

                      <p
                        className={clsx(
                          'text-xs sm:text-sm font-bold tabular-nums',
                          sim.type === 'INCOME' ? 'text-lime' : 'text-expense',
                        )}
                      >
                        {sim.type === 'INCOME' ? '+' : '−'}
                        {formatMoney(sim.amount)}
                        {isInstallments && (
                          <span className="text-[10px] text-text-dim font-normal block sm:inline sm:ml-1">
                            (Total: {formatMoney(sim.amount * (sim.totalInstallments || 1))})
                          </span>
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveSimulation(sim.id)}
                      title="Excluir simulação"
                      className="grid size-8 place-items-center rounded-lg text-text-muted hover:text-expense hover:bg-expense/10 transition cursor-pointer"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <Empty
            title={
              simulations.length === 0
                ? 'Nenhuma simulação cadastrada'
                : 'Nenhuma simulação corresponde a este filtro'
            }
          />
        )}

        {/* Rodapé de Ações */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
          {simulations.length > 0 ? (
            confirmClear ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={handleClearAllWithConfirm}
                  className="text-xs"
                >
                  <AlertTriangle className="size-3.5" />
                  Confirmar Limpeza Total
                </Button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="text-xs text-text-muted hover:text-white"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-expense transition cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                Limpar Todas ({simulations.length})
              </button>
            )
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onClose()
                onOpenCreate()
              }}
              className="border-violet/40 text-violet hover:bg-violet-subtle text-xs flex items-center gap-1.5"
            >
              <Plus className="size-3.5" />
              Nova Simulação
            </Button>
            <Button type="button" size="sm" onClick={onClose} className="text-xs">
              Concluir
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
