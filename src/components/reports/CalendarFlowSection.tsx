import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, CreditCard as CardIcon, TrendingDown, TrendingUp, Calendar as CalendarIcon } from 'lucide-react'
import clsx from 'clsx'
import type { Account, Category, Transaction } from '@/lib/types'
import { formatCompact, formatMoney, toISODate } from '@/lib/format'
import { Badge, Card, Empty, InfoTooltip } from '@/components/ui'
import TransactionList from '@/components/TransactionList'

interface DayProjection {
  day: number
  date: string
  txs: Transaction[]
  invoices: { cardId: string; cardName: string; remainingAmount: number }[]
  delta: number
  balance: number
}

interface CalendarFlowSectionProps {
  period: { month: number; year: number }
  projection: {
    days: DayProjection[]
    opening: number
    closing: number
    min: DayProjection
    firstNegative?: DayProjection
  }
  threshold: number
  accounts: Account[]
  categories: Category[]
  accountIdFilter?: string
}

type Level = 'positive' | 'warning' | 'negative'
const levelOf = (balance: number, threshold: number): Level =>
  balance < 0 ? 'negative' : balance < threshold ? 'warning' : 'positive'

const levelCell: Record<Level, string> = {
  positive: 'bg-lime-subtle border-lime/25 text-lime hover:border-lime/60',
  warning: 'bg-violet-subtle border-violet/30 text-white hover:border-violet/60',
  negative: 'bg-surface-2 border-white/20 text-white hover:border-white/50',
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function CalendarFlowSection({
  period,
  projection,
  threshold,
  accounts,
  categories,
  accountIdFilter,
}: CalendarFlowSectionProps) {
  const [selected, setSelected] = useState<string>()

  const offset = new Date(period.year, period.month - 1, 1).getDay()
  const today = toISODate(new Date())
  const sel = projection.days.find((d) => d.date === selected)
  const accountNames = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])

  return (
    <div className="space-y-4 mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <CalendarIcon className="size-4 text-violet" />
            <span>Previsibilidade Diária — Calendário Financeiro</span>
            <InfoTooltip
              title="Calendário Financeiro"
              content="Projeção diária do saldo bancário considerando receitas, despesas agendadas e faturas de cartão ao longo do mês. Dias destacados em amarelo estão abaixo do limite configurado e em vermelho indicam saldo negativo."
              align="start"
            />
          </h2>
          <p className="text-xs text-text-dim">
            Saldo projetado dia a dia na sua conta, integrando transações agendadas e vencimentos de fatura
          </p>
        </div>
      </div>

      {/* Cards de Resumo da Previsão */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3.5 bg-surface-1 border-border">
          <p className="text-xs text-text-dim flex items-center gap-1">
            Início do mês
            <InfoTooltip
              content="Saldo consolidado em contas no primeiro dia do mês antes das movimentações."
              align="start"
            />
          </p>
          <p className="text-sm font-semibold sm:text-base text-white tabular-nums">
            {formatMoney(projection.opening)}
          </p>
        </Card>
        <Card className="p-3.5 bg-surface-1 border-border">
          <p className="text-xs text-text-dim flex items-center gap-1">
            Fim do mês
            <InfoTooltip
              content="Saldo projetado em conta bancária para o último dia do mês, após todas as entradas e saídas previstas."
              align="center"
            />
          </p>
          <p
            className={clsx(
              'flex items-center gap-1 text-sm font-semibold sm:text-base tabular-nums',
              projection.closing >= projection.opening ? 'text-lime' : 'text-white',
            )}
          >
            {projection.closing < projection.opening ? (
              <TrendingDown className="size-4 shrink-0 text-white" />
            ) : (
              <TrendingUp className="size-4 shrink-0 text-lime" />
            )}
            {formatMoney(projection.closing)}
          </p>
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
              projection.min.balance < 0 ? 'text-rose-400' : 'text-white',
            )}
          >
            {formatMoney(projection.min.balance)}
          </p>
          <p className="text-[11px] text-text-dim">dia {projection.min.day}</p>
        </Card>
      </div>

      {/* Alerta de Caixa Negativo */}
      {projection.firstNegative && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-white/15 bg-surface-2 p-3.5 text-xs text-white">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-lime" />
          <span>
            Atenção: o saldo projetado em conta fica negativo a partir do <b>dia {projection.firstNegative.day}</b> (
            {formatMoney(projection.firstNegative.balance)}). Planeje reforço de caixa ou postergue pagamentos antes
            desta data.
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
                'flex min-h-16 flex-col items-center justify-between rounded-xl border p-1 text-center transition cursor-pointer select-none sm:min-h-20 sm:p-1.5',
                levelCell[levelOf(d.balance, threshold)],
                d.date === selected && '!border-lime ring-2 ring-lime/60',
                d.date === today && 'outline outline-1 outline-lime',
              )}
            >
              <span
                className={clsx(
                  'text-xs font-medium',
                  d.date === today ? 'text-lime font-bold' : 'text-text-muted',
                )}
              >
                {d.day}
              </span>
              {d.delta !== 0 && (
                <span
                  className={clsx(
                    'text-[10px] leading-none tabular-nums font-medium',
                    d.delta > 0 ? 'text-lime' : 'text-white',
                  )}
                >
                  {d.delta > 0 ? '+' : '−'}
                  {formatCompact(Math.abs(d.delta))}
                </span>
              )}
              <span className="text-[11px] font-semibold leading-none sm:text-xs tabular-nums text-white">
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
            <i className="size-2 rounded-full bg-white shrink-0" /> Negativo
          </span>
        </div>
        <p className="mt-1 px-1 text-[11px] text-text-dim">
          Toque em qualquer dia para inspecionar transações e vencimentos de fatura que compõem o saldo.
        </p>
      </Card>

      {/* Painel do Dia Selecionado */}
      {sel && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-semibold text-white">Movimentações do Dia {sel.day}</h3>
            <span className="text-xs text-text-muted">
              Saldo projetado no encerramento: <b className="text-white tabular-nums">{formatMoney(sel.balance)}</b>
            </span>
          </div>

          {/* Vencimentos de faturas no dia */}
          {sel.invoices.length > 0 && (
            <Card className="divide-y divide-border bg-surface-1 border-border">
              {sel.invoices.map((inv) => (
                <Link
                  key={inv.cardId}
                  to={`/cartoes/${inv.cardId}`}
                  className="flex items-center gap-3 p-3 hover:bg-surface-2 transition"
                >
                  <div className="grid size-9 place-items-center rounded-xl bg-violet/15 text-violet">
                    <CardIcon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">Vencimento da fatura {inv.cardName}</p>
                    <p className="text-xs text-text-dim">Débito previsto na conta vinculada</p>
                  </div>
                  <Badge tone="primary">Fatura</Badge>
                  <p className="text-sm font-semibold text-white tabular-nums">−{formatMoney(inv.remainingAmount)}</p>
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
            !sel.invoices.length && <Empty title="Sem movimentações registradas neste dia." />
          )}
        </div>
      )}
    </div>
  )
}
