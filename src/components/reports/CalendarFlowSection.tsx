import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  CreditCard as CardIcon,
  TrendingDown,
  TrendingUp,
  Calendar as CalendarIcon,
  Sparkles,
  Trash2,
  RotateCcw,
  Clock,
} from 'lucide-react'
import clsx from 'clsx'
import type { Account, Category } from '@/lib/types'
import { formatCompact, formatMoney, toISODate } from '@/lib/format'
import { Badge, Button, Card, Empty, Field, InfoTooltip, Input, Modal, MoneyInput } from '@/components/ui'
import TransactionList from '@/components/TransactionList'
import type { CalendarProjection, DayProjection, ReportPeriod, SimulatedTransaction } from './types'
import { parseDateParts, useSimulations } from './useReportsData'

export type { DayProjection }

export interface CalendarFlowSectionProps {
  period: ReportPeriod
  projection: CalendarProjection
  threshold: number
  accounts: Account[]
  categories: Category[]
  accountIdFilter?: string
  simulations?: SimulatedTransaction[]
  onAddSimulation?: (sim: Omit<SimulatedTransaction, 'id'>) => void
  onRemoveSimulation?: (id: string) => void
  onClearSimulations?: () => void
}

type Level = 'positive' | 'warning' | 'negative'
const levelOf = (balance: number, threshold: number): Level =>
  balance < 0 ? 'negative' : balance < threshold ? 'warning' : 'positive'

const levelCell: Record<Level, string> = {
  positive: 'bg-lime-subtle border-lime/25 text-lime hover:border-lime/60',
  warning: 'bg-violet-subtle border-violet/30 text-white hover:border-violet/60',
  negative: 'bg-expense-subtle border-expense/40 text-expense hover:border-expense/70',
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function CalendarFlowSection({
  period,
  projection,
  threshold,
  accounts,
  categories,
  accountIdFilter,
  simulations: controlledSimulations,
  onAddSimulation: controlledAddSimulation,
  onRemoveSimulation: controlledRemoveSimulation,
  onClearSimulations: controlledClearSimulations,
}: CalendarFlowSectionProps) {
  const [selected, setSelected] = useState<string>()

  // Fallback para gerenciar simulações localmente se não controlado pelo componente pai
  const localSimManager = useSimulations('local-reports-calendar')
  const simulations = controlledSimulations ?? localSimManager.simulations
  const handleAddSim = controlledAddSimulation ?? localSimManager.addSimulation
  const handleRemoveSim = controlledRemoveSimulation ?? localSimManager.removeSimulation
  const handleClearAll = controlledClearSimulations ?? localSimManager.clearSimulations

  // Modal de Simulação
  const [modalOpen, setModalOpen] = useState(false)
  const [simType, setSimType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE')
  const [simTitle, setSimTitle] = useState('')
  const [simAmount, setSimAmount] = useState<number>(0)
  const [simDate, setSimDate] = useState<string>('')

  const offset = new Date(period.year, period.month - 1, 1).getDay()
  const today = toISODate(new Date())
  const sel = projection.days.find((d) => d.date === selected)
  const accountNames = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])

  // Simulações que incidem no mês exibido
  const monthSimulations = useMemo(() => {
    return simulations.filter((s) => {
      const p = parseDateParts(s.date)
      return p.year === period.year && p.month === period.month
    })
  }, [simulations, period.year, period.month])

  const monthSimNet = useMemo(() => {
    return monthSimulations.reduce(
      (s, sim) => s + (sim.type === 'INCOME' ? sim.amount : -sim.amount),
      0,
    )
  }, [monthSimulations])

  const handleOpenSimModal = (targetDate?: string) => {
    const defaultDate =
      targetDate ||
      selected ||
      (period.year === new Date().getFullYear() && period.month === new Date().getMonth() + 1
        ? toISODate(new Date())
        : toISODate(new Date(period.year, period.month - 1, 1)))
    setSimDate(defaultDate)
    setSimTitle('')
    setSimAmount(0)
    setSimType('EXPENSE')
    setModalOpen(true)
  }

  const handleSaveSimulation = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!simTitle.trim() || simAmount <= 0 || !simDate) return
    handleAddSim({
      title: simTitle.trim(),
      amount: simAmount,
      type: simType,
      date: simDate,
      accountId: accountIdFilter || undefined,
    })
    setModalOpen(false)
  }

  return (
    <div className="space-y-4 mb-8">
      {/* Cabeçalho da Seção com Ação de Simular */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <CalendarIcon className="size-4 text-violet" />
            <span>Previsibilidade Diária — Calendário Financeiro</span>
            <InfoTooltip
              title="Calendário Financeiro"
              content="Projeção contínua do saldo bancário considerando histórico consolidado, receitas, despesas agendadas, faturas de cartão e simulações hipotéticas futuras."
              align="start"
            />
          </h2>
          <p className="text-xs text-text-dim">
            Saldo encadeado dia a dia na sua conta, integrando transações agendadas e vencimentos de fatura
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handleOpenSimModal()}
            className="flex items-center gap-1.5 border-violet/40 bg-violet/10 hover:bg-violet/20 text-violet"
          >
            <Sparkles className="size-3.5 text-violet" />
            Simular Lançamento
          </Button>

          {simulations.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleClearAll}
              title="Limpar todas as simulações"
              className="text-text-muted hover:text-white text-xs flex items-center gap-1"
            >
              <RotateCcw className="size-3" />
              Limpar ({simulations.length})
            </Button>
          )}
        </div>
      </div>

      {/* Banner de Cenário de Simulação Ativo */}
      {simulations.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet/40 bg-violet-subtle/50 p-3.5 text-xs text-white">
          <div className="flex items-center gap-2.5">
            <div className="grid size-7 place-items-center rounded-lg bg-violet/20 text-violet">
              <Sparkles className="size-4 text-violet" />
            </div>
            <div>
              <span className="font-semibold text-white">Cenário de Simulação Ativo</span>
              <span className="text-text-muted ml-1.5">
                ({simulations.length} lançamento{simulations.length > 1 ? 's' : ''} simulado{simulations.length > 1 ? 's' : ''} na projeção)
              </span>
              {monthSimNet !== 0 && (
                <span
                  className={clsx(
                    'ml-2 font-semibold tabular-nums',
                    monthSimNet > 0 ? 'text-lime' : 'text-expense',
                  )}
                >
                  Impacto líquido no mês: {monthSimNet > 0 ? '+' : ''}
                  {formatMoney(monthSimNet)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenSimModal()}
              className="text-[11px] font-semibold text-violet hover:underline cursor-pointer"
            >
              + Adicionar simulação
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium text-text-muted hover:text-white hover:bg-surface-3 transition cursor-pointer"
            >
              <RotateCcw className="size-3" />
              Resetar projeção
            </button>
          </div>
        </div>
      )}

      {/* Cards de Resumo da Previsão */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3.5 bg-surface-1 border-border">
          <p className="text-xs text-text-dim flex items-center gap-1">
            Início do mês
            <InfoTooltip
              content="Saldo consolidado em contas no primeiro dia do mês antes das movimentações, integrando o fluxo encadeado de meses anteriores."
              align="start"
            />
          </p>
          <p
            className={clsx(
              'text-sm font-semibold sm:text-base tabular-nums',
              projection.opening < 0 ? 'text-expense' : 'text-white',
            )}
          >
            {formatMoney(projection.opening)}
          </p>
          {projection.realOpening != null && projection.realOpening !== projection.opening && (
            <p className="text-[11px] text-text-dim tabular-nums">
              Real: {formatMoney(projection.realOpening)}
            </p>
          )}
        </Card>

        <Card className="p-3.5 bg-surface-1 border-border">
          <p className="text-xs text-text-dim flex items-center gap-1">
            Fim do mês
            <InfoTooltip
              content="Saldo projetado em conta bancária para o último dia do mês, após todas as entradas, saídas previstas e simulações."
              align="center"
            />
          </p>
          <p
            className={clsx(
              'flex items-center gap-1 text-sm font-semibold sm:text-base tabular-nums',
              projection.closing < 0
                ? 'text-expense'
                : projection.closing >= projection.opening
                  ? 'text-lime'
                  : 'text-white',
            )}
          >
            {projection.closing < projection.opening ? (
              <TrendingDown
                className={clsx(
                  'size-4 shrink-0',
                  projection.closing < 0 ? 'text-expense' : 'text-text-muted',
                )}
              />
            ) : (
              <TrendingUp className="size-4 shrink-0 text-lime" />
            )}
            {formatMoney(projection.closing)}
          </p>
          {projection.realClosing != null && projection.realClosing !== projection.closing && (
            <p className="text-[11px] text-text-dim tabular-nums flex items-center gap-1">
              <span>Sem simulação: {formatMoney(projection.realClosing)}</span>
              <span
                className={clsx(
                  'font-medium',
                  projection.closing >= projection.realClosing ? 'text-lime' : 'text-expense',
                )}
              >
                ({projection.closing >= projection.realClosing ? '+' : ''}
                {formatMoney(projection.closing - projection.realClosing)})
              </span>
            </p>
          )}
        </Card>

        <Card className="p-3.5 bg-surface-1 border-border">
          <p className="text-xs text-text-dim flex items-center gap-1">
            Menor saldo previsto
            <InfoTooltip
              content="O dia de menor liquidez bancária ao longo do mês, permitindo antecipar necessidades de cobertura de caixa."
              align="end"
            />
          </p>
          <p
            className={clsx(
              'text-sm font-semibold sm:text-base tabular-nums',
              projection.min.balance < 0 ? 'text-expense' : 'text-white',
            )}
          >
            {formatMoney(projection.min.balance)}
          </p>
          <p className="text-[11px] text-text-dim">
            dia {projection.min.day}
            {projection.realMin != null && projection.realMin.balance !== projection.min.balance && (
              <span className="block sm:inline sm:ml-2">
                (Sem simulação: {formatMoney(projection.realMin.balance)})
              </span>
            )}
          </p>
        </Card>
      </div>

      {/* Alerta de Caixa Negativo */}
      {projection.firstNegative && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-expense/30 bg-expense-subtle p-3.5 text-xs text-expense">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-expense" />
          <span className="text-white">
            Atenção: o saldo projetado em conta fica negativo a partir do <b>dia {projection.firstNegative.day}</b> (
            <span className="text-expense font-semibold">{formatMoney(projection.firstNegative.balance)}</span>). Planeje
            reforço de caixa ou postergue pagamentos antes desta data.
          </span>
        </div>
      )}

      {/* Grid do Calendário */}
      <Card className="p-3 sm:p-4 bg-surface-1 border-border">
        <div className="mb-2 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wider text-text-dim">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: offset }, (_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {projection.days.map((d) => (
            <button
              key={d.date}
              type="button"
              onClick={() => setSelected(d.date === selected ? undefined : d.date)}
              className={clsx(
                'flex min-h-16 flex-col items-center justify-between rounded-xl border p-1 text-center transition cursor-pointer select-none sm:min-h-20 sm:p-1.5 relative',
                levelCell[levelOf(d.balance, threshold)],
                d.date === selected && '!border-lime ring-2 ring-lime/60',
                d.date === today && 'outline outline-1 outline-lime',
                d.simulations && d.simulations.length > 0 && 'ring-1 ring-violet/50',
              )}
            >
              <div className="flex items-center justify-between w-full px-0.5">
                <span
                  className={clsx(
                    'text-xs font-medium',
                    d.date === today
                      ? 'text-lime font-bold'
                      : d.balance < 0
                        ? 'text-expense font-semibold'
                        : 'text-text-muted',
                  )}
                >
                  {d.day}
                </span>
                <div className="flex items-center gap-1">
                  {d.pendingTxs && d.pendingTxs.length > 0 && (
                    <span
                      title={`Lançamentos pendentes/não pagos (${d.pendingTxs.length}): ${
                        (d.pendingDelta ?? 0) > 0 ? '+' : ''
                      }${formatMoney(d.pendingDelta ?? 0)}`}
                      className="flex items-center"
                    >
                      <Clock className="size-3 text-amber-400 shrink-0" />
                    </span>
                  )}
                  {d.simulations && d.simulations.length > 0 && (
                    <span
                      title={`Simulações: ${d.simulations
                        .map((s) => `${s.title} (${s.type === 'INCOME' ? '+' : '−'}${formatMoney(s.amount)})`)
                        .join(', ')}`}
                      className="flex items-center"
                    >
                      <Sparkles className="size-3 text-violet shrink-0" />
                    </span>
                  )}
                  {d.invoices.length > 0 && (
                    <span
                      title={`Vencimento de fatura: ${d.invoices
                        .map((i) => `${i.cardName} (${formatMoney(i.remainingAmount)})${i.isOverdue ? ' [Vencida]' : ''}`)
                        .join(', ')}`}
                      className="flex items-center"
                    >
                      <CardIcon
                        className={clsx(
                          'size-3 shrink-0',
                          d.invoices.some((i) => i.isOverdue) ? 'text-expense' : 'text-violet',
                        )}
                      />
                    </span>
                  )}
                </div>
              </div>
              {d.delta !== 0 ? (
                <span
                  className={clsx(
                    'text-[10px] leading-none tabular-nums font-medium',
                    d.delta > 0 ? 'text-lime' : 'text-expense',
                  )}
                >
                  {d.delta > 0 ? '+' : '−'}
                  {formatCompact(Math.abs(d.delta))}
                </span>
              ) : d.date < today && d.pendingTxs && d.pendingTxs.length > 0 && (d.pendingDelta ?? 0) !== 0 ? (
                <span
                  title={`Lançamento não pago: ${formatMoney(d.pendingDelta ?? 0)}`}
                  className="text-[10px] leading-none tabular-nums font-medium text-amber-400 border-b border-dashed border-amber-400/60"
                >
                  {(d.pendingDelta ?? 0) > 0 ? '+' : '−'}
                  {formatCompact(Math.abs(d.pendingDelta ?? 0))}
                </span>
              ) : null}
              <span
                className={clsx(
                  'text-[11px] font-semibold leading-none sm:text-xs tabular-nums',
                  d.balance < 0 ? 'text-expense' : 'text-white',
                )}
              >
                {formatCompact(d.balance)}
              </span>
            </button>
          ))}
        </div>

        {/* Legenda */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-border pt-3 px-1 text-xs text-text-dim">
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-full bg-lime shrink-0" /> Positivo (≥ {formatMoney(threshold)})
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-full bg-violet shrink-0" /> Atenção (abaixo de {formatMoney(threshold)})
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-full bg-expense shrink-0" /> Negativo
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-3 text-amber-400 shrink-0" /> Lançamento pendente / não pago
          </span>
          <span className="flex items-center gap-1.5">
            <CardIcon className="size-3 text-violet shrink-0" /> Vencimento de fatura
          </span>
          <span className="flex items-center gap-1.5">
            <Sparkles className="size-3 text-violet shrink-0" /> Lançamento simulado
          </span>
        </div>
        <p className="mt-1 px-1 text-[11px] text-text-dim">
          Toque em qualquer dia para inspecionar movimentações, faturas ou simular cenários futuros de caixa.
        </p>
      </Card>

      {/* Painel do Dia Selecionado */}
      {sel && (
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div>
              <h3 className="font-semibold text-white">Movimentações do Dia {sel.day}</h3>
              <p className="text-xs text-text-muted">
                Saldo projetado no encerramento:{' '}
                <b className={clsx('tabular-nums', sel.balance < 0 ? 'text-expense' : 'text-white')}>
                  {formatMoney(sel.balance)}
                </b>
                {sel.realBalance != null && sel.realBalance !== sel.balance && (
                  <span className="text-text-dim ml-2 tabular-nums">
                    (Sem simulações: {formatMoney(sel.realBalance)})
                  </span>
                )}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleOpenSimModal(sel.date)}
              className="flex items-center gap-1.5 text-xs text-violet border-violet/30 hover:border-violet/60"
            >
              <Sparkles className="size-3.5 text-violet" />
              Simular neste dia
            </Button>
          </div>

          {/* Aviso de Lançamentos Pendentes no Dia */}
          {sel.pendingTxs && sel.pendingTxs.length > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-200">
              <Clock className="mt-0.5 size-4 shrink-0 text-amber-400" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-white">
                    {sel.date < today
                      ? `Lançamento${sel.pendingTxs.length > 1 ? 's' : ''} Não Pago${sel.pendingTxs.length > 1 ? 's' : ''} / Vencido${sel.pendingTxs.length > 1 ? 's' : ''} (${sel.pendingTxs.length})`
                      : `Lançamento${sel.pendingTxs.length > 1 ? 's' : ''} Pendente${sel.pendingTxs.length > 1 ? 's' : ''} / Previsto${sel.pendingTxs.length > 1 ? 's' : ''} (${sel.pendingTxs.length})`}
                  </span>
                  <span className="font-semibold tabular-nums text-amber-400">
                    {(sel.pendingDelta ?? 0) > 0 ? '+' : ''}
                    {formatMoney(sel.pendingDelta ?? 0)}
                  </span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  {sel.date < today
                    ? 'Estes lançamentos têm data passada mas não foram pagos. Eles não descontam do saldo bancário real até serem marcados como pagos/concluídos. Para atualizar o saldo da sua conta, use o botão ao lado da transação abaixo.'
                    : 'Estes lançamentos têm data prevista para hoje ou dias futuros e já estão integrados na simulação de fluxo de caixa futuro da conta.'}
                </p>
              </div>
            </div>
          )}

          {/* Lançamentos Simulados do Dia */}
          {sel.simulations && sel.simulations.length > 0 && (
            <Card className="divide-y divide-border bg-surface-1 border-violet/30">
              <div className="p-2.5 bg-violet-subtle/30 px-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-violet flex items-center gap-1.5">
                  <Sparkles className="size-3.5" />
                  Lançamentos Simulados (Cenário Hipotético)
                </span>
                <span className="text-[11px] text-text-dim">
                  Impacto no dia:{' '}
                  <b
                    className={clsx(
                      'tabular-nums font-semibold',
                      (sel.simulatedDelta ?? 0) >= 0 ? 'text-lime' : 'text-expense',
                    )}
                  >
                    {(sel.simulatedDelta ?? 0) >= 0 ? '+' : ''}
                    {formatMoney(sel.simulatedDelta ?? 0)}
                  </b>
                </span>
              </div>
              {sel.simulations.map((sim) => (
                <div
                  key={sim.id}
                  className="flex items-center justify-between gap-3 p-3 hover:bg-surface-2 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={clsx(
                        'grid size-8 place-items-center rounded-lg text-xs font-bold shrink-0',
                        sim.type === 'INCOME' ? 'bg-lime/15 text-lime' : 'bg-expense/15 text-expense',
                      )}
                    >
                      {sim.type === 'INCOME' ? '+' : '−'}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{sim.title}</p>
                      <p className="text-[11px] text-text-dim">Lançamento hipotético</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge tone={sim.type === 'INCOME' ? 'income' : 'expense'}>
                      {sim.type === 'INCOME' ? 'Receita Simulada' : 'Despesa Simulada'}
                    </Badge>
                    <p
                      className={clsx(
                        'text-sm font-semibold tabular-nums',
                        sim.type === 'INCOME' ? 'text-lime' : 'text-expense',
                      )}
                    >
                      {sim.type === 'INCOME' ? '+' : '−'}
                      {formatMoney(sim.amount)}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleRemoveSim(sim.id)}
                      title="Remover simulação"
                      className="grid size-7 place-items-center rounded-lg text-text-muted hover:text-expense hover:bg-expense/10 transition cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* Vencimentos de faturas no dia */}
          {sel.invoices.length > 0 && (
            <Card className="divide-y divide-border bg-surface-1 border-border">
              {sel.invoices.map((inv) => (
                <Link
                  key={inv.cardId}
                  to={`/cartoes/${inv.cardId}`}
                  className="flex items-center gap-3 p-3 hover:bg-surface-2 transition"
                >
                  <div
                    className={clsx(
                      'grid size-9 place-items-center rounded-xl',
                      inv.isOverdue ? 'bg-expense/15 text-expense' : 'bg-violet/15 text-violet',
                    )}
                  >
                    <CardIcon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">Vencimento da fatura {inv.cardName}</p>
                    <p className="text-xs text-text-dim">
                      {inv.isOverdue
                        ? 'Pendente de pagamento — impacta projeção a partir de hoje'
                        : 'Débito previsto na conta vinculada'}
                    </p>
                  </div>
                  <Badge tone={inv.isOverdue ? 'danger' : 'primary'}>
                    {inv.isOverdue ? 'Fatura Vencida' : 'Fatura'}
                  </Badge>
                  <p className="text-sm font-semibold text-expense tabular-nums">−{formatMoney(inv.remainingAmount)}</p>
                </Link>
              ))}
            </Card>
          )}

          {/* Transações do dia */}
          {sel.txs.length > 0 ? (
            <TransactionList
              items={sel.txs}
              categories={categories}
              accountNames={accountNames}
              accountId={accountIdFilter || undefined}
            />
          ) : (
            !sel.invoices.length &&
            (!sel.simulations || sel.simulations.length === 0) && (
              <Empty title="Sem movimentações registradas neste dia." />
            )
          )}
        </div>
      )}

      {/* Modal para Adicionar Lançamento Simulado */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Simular Lançamento Futuro"
      >
        <form onSubmit={handleSaveSimulation} className="space-y-4">
          <p className="text-xs text-text-dim">
            Adicione uma receita ou despesa hipotética para projetar o impacto no saldo bancário sem afetar seus lançamentos reais.
          </p>

          {/* Seletor de Tipo */}
          <div>
            <label className="text-xs font-medium text-text-dim mb-1.5 block">Tipo do Lançamento</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSimType('INCOME')}
                className={clsx(
                  'flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer',
                  simType === 'INCOME'
                    ? 'bg-lime/15 border-lime text-lime shadow-sm'
                    : 'bg-surface-2 border-border text-text-muted hover:text-white',
                )}
              >
                <TrendingUp className="size-3.5" />
                Receita (+)
              </button>
              <button
                type="button"
                onClick={() => setSimType('EXPENSE')}
                className={clsx(
                  'flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer',
                  simType === 'EXPENSE'
                    ? 'bg-expense/15 border-expense text-expense shadow-sm'
                    : 'bg-surface-2 border-border text-text-muted hover:text-white',
                )}
              >
                <TrendingDown className="size-3.5" />
                Despesa (−)
              </button>
            </div>
          </div>

          {/* Descrição */}
          <Field label="Descrição da Simulação">
            <Input
              value={simTitle}
              onChange={(e) => setSimTitle(e.target.value)}
              placeholder={
                simType === 'INCOME'
                  ? 'ex.: Freelance extra, Restituição IRPF'
                  : 'ex.: Conserto do carro, Curso, Viagem'
              }
              required
              autoFocus
            />
          </Field>

          {/* Valor */}
          <Field label="Valor">
            <MoneyInput value={simAmount} onChange={setSimAmount} />
          </Field>

          {/* Data */}
          <Field label="Data Prevista">
            <Input
              type="date"
              value={simDate}
              onChange={(e) => setSimDate(e.target.value)}
              required
            />
          </Field>

          <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!simTitle.trim() || simAmount <= 0 || !simDate}>
              Adicionar ao Cenário
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
