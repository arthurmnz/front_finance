import { useState, useEffect, useMemo } from 'react'
import {
  Sparkles,
  TrendingDown,
  TrendingUp,
  CreditCard as CardIcon,
  Building2,
  Plus,
  CheckCircle2,
  Repeat,
} from 'lucide-react'
import clsx from 'clsx'
import type { Account, CreditCard } from '@/lib/types'
import { formatMoney, toISODate } from '@/lib/format'
import { Button, Field, Input, Modal, MoneyInput } from '@/components/ui'
import type { SimulatedTransaction } from './types'
import { getInvoiceForCardPurchase, parseDateParts } from './useReportsData'

export interface SimulationModalProps {
  open: boolean
  onClose: () => void
  onAddSimulation: (sim: Omit<SimulatedTransaction, 'id'>) => void
  accounts: Account[]
  creditCards?: CreditCard[]
  initialDate?: string
  accountIdFilter?: string
}

interface Preset {
  id: string
  label: string
  category: string
  type: 'INCOME' | 'EXPENSE'
  title: string
  amount: number // em centavos
  sourceMode: 'ACCOUNT' | 'CARD'
  isRecurring: boolean
  cardPaymentMode?: 'SINGLE' | 'INSTALLMENTS' | 'RECURRING'
  totalInstallments?: number
}

const PRESETS: Preset[] = [
  {
    id: 'netflix',
    label: 'Netflix',
    category: 'Streaming',
    type: 'EXPENSE',
    title: 'Netflix',
    amount: 5590, // R$ 55,90
    sourceMode: 'CARD',
    isRecurring: true,
    cardPaymentMode: 'RECURRING',
  },
  {
    id: 'spotify',
    label: 'Spotify',
    category: 'Música',
    type: 'EXPENSE',
    title: 'Spotify Família',
    amount: 3490, // R$ 34,90
    sourceMode: 'CARD',
    isRecurring: true,
    cardPaymentMode: 'RECURRING',
  },
  {
    id: 'academia',
    label: 'Academia',
    category: 'Saúde',
    type: 'EXPENSE',
    title: 'Mensalidade Academia',
    amount: 11990, // R$ 119,90
    sourceMode: 'CARD',
    isRecurring: true,
    cardPaymentMode: 'RECURRING',
  },
  {
    id: 'internet',
    label: 'Internet Fibra',
    category: 'Casa',
    type: 'EXPENSE',
    title: 'Internet Fibra Óptica',
    amount: 12990, // R$ 129,90
    sourceMode: 'ACCOUNT',
    isRecurring: true,
  },
  {
    id: 'aluguel',
    label: 'Aluguel / Condomínio',
    category: 'Moradia',
    type: 'EXPENSE',
    title: 'Aluguel & Condomínio',
    amount: 160000, // R$ 1.600,00
    sourceMode: 'ACCOUNT',
    isRecurring: true,
  },
  {
    id: 'luz',
    label: 'Energia Elétrica',
    category: 'Utilidades',
    type: 'EXPENSE',
    title: 'Conta de Energia (Luz)',
    amount: 18000, // R$ 180,00
    sourceMode: 'ACCOUNT',
    isRecurring: true,
  },
  {
    id: 'freela',
    label: 'Freela / Extra',
    category: 'Renda',
    type: 'INCOME',
    title: 'Projeto Freelance',
    amount: 150000, // R$ 1.500,00
    sourceMode: 'ACCOUNT',
    isRecurring: false,
  },
  {
    id: 'parcelado_padrao',
    label: 'Compra Parcelada',
    category: 'Eletrônico',
    type: 'EXPENSE',
    title: 'Compra Parcelada no Cartão',
    amount: 25000, // R$ 250,00/mês
    sourceMode: 'CARD',
    isRecurring: false,
    cardPaymentMode: 'INSTALLMENTS',
    totalInstallments: 6,
  },
]

export default function SimulationModal({
  open,
  onClose,
  onAddSimulation,
  accounts,
  creditCards = [],
  initialDate,
  accountIdFilter,
}: SimulationModalProps) {
  const todayIso = toISODate(new Date())
  const defaultDate = initialDate || todayIso

  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE')
  const [sourceMode, setSourceMode] = useState<'ACCOUNT' | 'CARD'>('ACCOUNT')
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState<number>(0)
  const [date, setDate] = useState<string>(defaultDate)
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accountIdFilter || accounts[0]?.id || '')
  const [selectedCardId, setSelectedCardId] = useState<string>(creditCards[0]?.id || '')

  // Configurações de Cartão
  const [cardPaymentMode, setCardPaymentMode] = useState<'SINGLE' | 'INSTALLMENTS' | 'RECURRING'>('SINGLE')
  const [installmentsCount, setInstallmentsCount] = useState<number>(3)
  const [installmentAmountMode, setInstallmentAmountMode] = useState<'PER_INSTALLMENT' | 'TOTAL'>('TOTAL')

  // Configurações de Conta (Recorrente)
  const [isRecurringAccount, setIsRecurringAccount] = useState<boolean>(false)
  const recurrenceIntervalMonths = 1
  const [isInfiniteAccount, setIsInfiniteAccount] = useState<boolean>(true)
  const [fixedInstallmentsAccount, setFixedInstallmentsAccount] = useState<number>(12)

  // Feedback de sucesso para "Salvar e Adicionar Outro"
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

  // Atualiza data padrão se initialDate mudar
  useEffect(() => {
    if (open) {
      setDate(initialDate || toISODate(new Date()))
      setFeedbackMessage(null)
      if (accountIdFilter) setSelectedAccountId(accountIdFilter)
      if (!selectedCardId && creditCards[0]) setSelectedCardId(creditCards[0].id)
      if (!selectedAccountId && accounts[0]) setSelectedAccountId(accounts[0].id)
    }
  }, [open, initialDate, accountIdFilter, creditCards, accounts])

  const selectedCard = useMemo(() => {
    return creditCards.find((c) => c.id === selectedCardId) || creditCards[0]
  }, [creditCards, selectedCardId])

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedAccountId) || accounts[0]
  }, [accounts, selectedAccountId])

  // Aplica um Preset
  const handleApplyPreset = (preset: Preset) => {
    setType(preset.type)
    setTitle(preset.title)
    setAmount(preset.amount)
    setSourceMode(preset.sourceMode)

    if (preset.sourceMode === 'CARD') {
      if (creditCards.length > 0 && !selectedCardId) {
        setSelectedCardId(creditCards[0].id)
      }
      setCardPaymentMode(preset.cardPaymentMode || (preset.isRecurring ? 'RECURRING' : 'SINGLE'))
      if (preset.totalInstallments) {
        setInstallmentsCount(preset.totalInstallments)
        setInstallmentAmountMode('PER_INSTALLMENT')
      }
    } else {
      setIsRecurringAccount(preset.isRecurring)
      setIsInfiniteAccount(true)
    }

    setFeedbackMessage(`Preset "${preset.label}" aplicado! Ajuste os dados se desejar.`)
    setTimeout(() => setFeedbackMessage(null), 3500)
  }

  // Atalhos de valor rápido
  const handleAddAmount = (cents: number) => {
    setAmount((prev) => prev + cents)
  }

  // Atalhos de data rápida
  const handleQuickDate = (mode: 'today' | 'tomorrow' | 'day5' | 'day10' | 'day15' | 'endOfMonth') => {
    const base = parseDateParts(date || defaultDate)
    const now = new Date()
    const targetY = base.year || now.getFullYear()
    const targetM = base.month || now.getMonth() + 1
    const daysInM = new Date(targetY, targetM, 0).getDate()

    if (mode === 'today') {
      setDate(toISODate(now))
    } else if (mode === 'tomorrow') {
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      setDate(toISODate(tomorrow))
    } else if (mode === 'day5') {
      setDate(`${targetY}-${String(targetM).padStart(2, '0')}-05`)
    } else if (mode === 'day10') {
      setDate(`${targetY}-${String(targetM).padStart(2, '0')}-10`)
    } else if (mode === 'day15') {
      setDate(`${targetY}-${String(targetM).padStart(2, '0')}-15`)
    } else if (mode === 'endOfMonth') {
      setDate(`${targetY}-${String(targetM).padStart(2, '0')}-${String(daysInM).padStart(2, '0')}`)
    }
  }

  // Monta o payload da simulação para salvar
  const buildSimulationPayload = (): Omit<SimulatedTransaction, 'id'> | null => {
    const cleanTitle = title.trim()
    if (!cleanTitle || !Number.isFinite(amount) || amount <= 0 || !date) return null

    if (sourceMode === 'CARD' && creditCards.length > 0) {
      const card = selectedCard
      const isRecurring = cardPaymentMode === 'RECURRING'
      const isInstallments = cardPaymentMode === 'INSTALLMENTS'
      const totalInstallments = isInstallments
        ? Math.min(48, Math.max(2, Math.floor(installmentsCount || 2)))
        : 1
      const perInstallmentAmount =
        isInstallments && installmentAmountMode === 'TOTAL'
          ? Math.round(amount / totalInstallments)
          : amount

      return {
        title: cleanTitle,
        amount: perInstallmentAmount,
        type: 'EXPENSE',
        date,
        sourceMode: 'CARD',
        creditCardId: card?.id,
        cardName: card?.name,
        accountId: card?.accountId,
        isRecurring,
        isInfinite: isRecurring,
        totalInstallments: isInstallments ? totalInstallments : undefined,
      }
    }

    // Caso Conta Bancária
    return {
      title: cleanTitle,
      amount,
      type,
      date,
      sourceMode: 'ACCOUNT',
      accountId: selectedAccountId || undefined,
      isRecurring: isRecurringAccount,
      recurrenceFrequency: isRecurringAccount ? 'MONTHLY' : undefined,
      recurrenceInterval: isRecurringAccount ? recurrenceIntervalMonths : undefined,
      isInfinite: isRecurringAccount ? isInfiniteAccount : undefined,
      recurrenceInstallments:
        isRecurringAccount && !isInfiniteAccount ? fixedInstallmentsAccount : undefined,
    }
  }

  const handleSave = (keepOpen = false) => {
    const payload = buildSimulationPayload()
    if (!payload) return

    onAddSimulation(payload)

    if (keepOpen) {
      const savedTitle = payload.title
      setFeedbackMessage(`✓ "${savedTitle}" adicionado com sucesso! Lançamento registrado no cenário.`)
      setTitle('')
      setAmount(0)
      setTimeout(() => setFeedbackMessage(null), 4000)
    } else {
      onClose()
    }
  }

  // Preview em tempo real de onde e quando incide o débito/crédito
  const previewInfo = useMemo(() => {
    if (!date || !Number.isFinite(amount) || amount <= 0) return null
    const p = parseDateParts(date)
    const formattedAmount = formatMoney(amount)

    if (sourceMode === 'CARD' && selectedCard) {
      const closing = selectedCard.closingDay || 25
      const due = selectedCard.dueDay || 10
      const inv = getInvoiceForCardPurchase(p.year, p.month, p.day, closing, due)
      const dueFormatted = `${String(inv.dueDay).padStart(2, '0')}/${String(inv.invMonth).padStart(2, '0')}/${inv.invYear}`

      if (cardPaymentMode === 'SINGLE') {
        return {
          title: `À vista no cartão ${selectedCard.name}`,
          headline: `Compra no dia ${String(p.day).padStart(2, '0')}/${String(p.month).padStart(2, '0')} de ${formattedAmount}`,
          detail: `Fatura fecha dia ${closing} e vence dia ${dueFormatted}. O saldo da conta vinculada será debitado no dia ${dueFormatted}.`,
          badge: 'Cartão de Crédito',
        }
      }

      if (cardPaymentMode === 'INSTALLMENTS') {
        const total = Math.min(48, Math.max(2, Math.floor(installmentsCount || 2)))
        const parcAmount =
          installmentAmountMode === 'TOTAL' ? Math.round(amount / total) : amount
        const totalAmountFormatted = formatMoney(
          installmentAmountMode === 'TOTAL' ? amount : amount * total,
        )

        // Última fatura
        const lastAbs = inv.invYear * 12 + (inv.invMonth - 1) + (total - 1)
        const lastY = Math.floor(lastAbs / 12)
        const lastM = (lastAbs % 12) + 1
        const lastDays = new Date(lastY, lastM, 0).getDate()
        const lastSafeDue = Math.min(due, lastDays)
        const lastDueFormatted = `${String(lastSafeDue).padStart(2, '0')}/${String(lastM).padStart(2, '0')}/${lastY}`

        return {
          title: `Compra Parcelada em ${total}x no cartão ${selectedCard.name}`,
          headline: `${total} parcelas de ${formatMoney(parcAmount)} (Total: ${totalAmountFormatted})`,
          detail: `1ª parcela vence na fatura de ${dueFormatted} e a última vence em ${lastDueFormatted}. O saldo bancário sofrerá o débito de cada parcela no dia do vencimento da respectiva fatura.`,
          badge: `Cartão: ${total}x`,
        }
      }

      if (cardPaymentMode === 'RECURRING') {
        return {
          title: `Assinatura recorrente no cartão ${selectedCard.name}`,
          headline: `Cobrança mensal de ${formattedAmount} todo dia ${String(p.day).padStart(2, '0')}`,
          detail: `Cada cobrança entra na fatura do ciclo e debita a conta vinculada no vencimento (1ª fatura em ${dueFormatted}). Continua todo mês na projeção futura.`,
          badge: 'Assinatura no Cartão',
        }
      }
    }

    // Preview em Conta
    if (isRecurringAccount) {
      const durText = isInfiniteAccount
        ? 'Indefinidamente (recorrente contínuo)'
        : `Por ${fixedInstallmentsAccount} meses seguidos`
      return {
        title: `${type === 'INCOME' ? 'Receita' : 'Despesa'} Recorrente em Conta`,
        headline: `${type === 'INCOME' ? '+' : '−'}${formattedAmount} todo dia ${String(p.day).padStart(2, '0')} do mês`,
        detail: `Incide no saldo da conta "${selectedAccount?.name || 'Geral'}" todo mês no dia ${String(p.day).padStart(2, '0')}. Duração: ${durText}.`,
        badge: 'Assinatura em Conta',
      }
    }

    return {
      title: `${type === 'INCOME' ? 'Receita' : 'Despesa'} Pontual em Conta`,
      headline: `${type === 'INCOME' ? '+' : '−'}${formattedAmount} no dia ${String(p.day).padStart(2, '0')}/${String(p.month).padStart(2, '0')}/${p.year}`,
      detail: `Impacta diretamente o saldo disponível na conta "${selectedAccount?.name || 'Geral'}" no dia exato informado.`,
      badge: 'Conta Bancária',
    }
  }, [
    date,
    amount,
    sourceMode,
    type,
    selectedCard,
    selectedAccount,
    cardPaymentMode,
    installmentsCount,
    installmentAmountMode,
    isRecurringAccount,
    isInfiniteAccount,
    fixedInstallmentsAccount,
  ])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova Simulação Financeira"
      className="max-w-2xl"
    >
      <div className="space-y-4 max-h-[82vh] overflow-y-auto px-1 pr-1.5 scrollbar-thin">
        {/* Banner de Feedback de Sucesso */}
        {feedbackMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-lime/40 bg-lime/10 px-3.5 py-2.5 text-xs text-lime transition-all animate-in fade-in">
            <CheckCircle2 className="size-4 shrink-0 text-lime" />
            <span className="font-medium">{feedbackMessage}</span>
          </div>
        )}

        {/* Presets de 1 Clique */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-text-dim">
            <span className="font-medium flex items-center gap-1.5 text-text-muted">
              <Sparkles className="size-3.5 text-violet" />
              Presets de 1 Clique (Atalhos rápidos)
            </span>
            <span className="text-[11px] text-text-dim">Clique para preencher</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {PRESETS.map((pr) => (
              <button
                key={pr.id}
                type="button"
                onClick={() => handleApplyPreset(pr)}
                className="group flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-muted hover:border-violet/50 hover:bg-violet-subtle/30 hover:text-white transition cursor-pointer"
              >
                <span className="font-semibold text-white group-hover:text-violet transition">
                  {pr.label}
                </span>
                <span className="text-[10px] tabular-nums text-text-dim group-hover:text-text-muted">
                  {formatMoney(pr.amount)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tipo do Lançamento: Receita vs Despesa */}
        <div>
          <label className="text-xs font-medium text-text-dim mb-1.5 block">Tipo da Operação</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setType('INCOME')
                setSourceMode('ACCOUNT')
              }}
              className={clsx(
                'flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer',
                type === 'INCOME'
                  ? 'bg-lime/15 border-lime text-lime shadow-sm'
                  : 'bg-surface-2 border-border text-text-muted hover:text-white',
              )}
            >
              <TrendingUp className="size-3.5" />
              Receita (+)
            </button>
            <button
              type="button"
              onClick={() => setType('EXPENSE')}
              className={clsx(
                'flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer',
                type === 'EXPENSE'
                  ? 'bg-expense/15 border-expense text-expense shadow-sm'
                  : 'bg-surface-2 border-border text-text-muted hover:text-white',
              )}
            >
              <TrendingDown className="size-3.5" />
              Despesa (−)
            </button>
          </div>
        </div>

        {/* Seletor de Origem: Conta Bancária vs Cartão de Crédito */}
        {type === 'EXPENSE' && (
          <div>
            <label className="text-xs font-medium text-text-dim mb-1.5 block">Origem do Lançamento</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSourceMode('ACCOUNT')}
                className={clsx(
                  'flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-medium transition cursor-pointer',
                  sourceMode === 'ACCOUNT'
                    ? 'bg-violet/15 border-violet text-white shadow-sm'
                    : 'bg-surface-2 border-border text-text-muted hover:text-white',
                )}
              >
                <Building2 className="size-3.5 text-violet" />
                Conta Bancária (Saldo em Conta)
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('CARD')}
                className={clsx(
                  'flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-medium transition cursor-pointer',
                  sourceMode === 'CARD'
                    ? 'bg-violet/15 border-violet text-white shadow-sm'
                    : 'bg-surface-2 border-border text-text-muted hover:text-white',
                )}
              >
                <CardIcon className="size-3.5 text-violet" />
                Cartão de Crédito (Fatura)
              </button>
            </div>
          </div>
        )}

        {/* Se for Cartão de Crédito */}
        {sourceMode === 'CARD' && type === 'EXPENSE' && (
          <div className="rounded-2xl border border-violet/30 bg-surface-2 p-3.5 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <CardIcon className="size-3.5 text-violet" />
                Configurações do Cartão de Crédito
              </span>
              {selectedCard && (
                <span className="text-[11px] text-text-dim">
                  Fecha dia <b>{selectedCard.closingDay || 25}</b> • Vence dia <b>{selectedCard.dueDay || 10}</b>
                </span>
              )}
            </div>

            {/* Seleção do Cartão */}
            {creditCards.length > 0 ? (
              <Field label="Escolha o Cartão">
                <select
                  value={selectedCardId}
                  onChange={(e) => setSelectedCardId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-1 px-3 py-2 text-xs text-white focus:border-violet focus:outline-none"
                >
                  {creditCards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Fecha dia {c.closingDay || 25}, Vence dia {c.dueDay || 10})
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <p className="text-xs text-amber-300">
                Nenhum cartão cadastrado. A simulação usará fechamento dia 25 e vencimento dia 10 como padrão.
              </p>
            )}

            {/* Modalidade no Cartão */}
            <div>
              <label className="text-xs font-medium text-text-dim mb-1.5 block">Modalidade de Cobrança</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCardPaymentMode('SINGLE')}
                  className={clsx(
                    'flex flex-col items-center justify-center py-2 px-2 rounded-xl border text-[11px] font-medium transition cursor-pointer',
                    cardPaymentMode === 'SINGLE'
                      ? 'bg-violet/20 border-violet text-white'
                      : 'bg-surface-1 border-border text-text-muted hover:text-white',
                  )}
                >
                  <span className="font-semibold">À Vista</span>
                  <span className="text-[10px] text-text-dim">Fatura única</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCardPaymentMode('INSTALLMENTS')}
                  className={clsx(
                    'flex flex-col items-center justify-center py-2 px-2 rounded-xl border text-[11px] font-medium transition cursor-pointer',
                    cardPaymentMode === 'INSTALLMENTS'
                      ? 'bg-violet/20 border-violet text-white'
                      : 'bg-surface-1 border-border text-text-muted hover:text-white',
                  )}
                >
                  <span className="font-semibold">Parcelado</span>
                  <span className="text-[10px] text-text-dim">N faturas futuras</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCardPaymentMode('RECURRING')}
                  className={clsx(
                    'flex flex-col items-center justify-center py-2 px-2 rounded-xl border text-[11px] font-medium transition cursor-pointer',
                    cardPaymentMode === 'RECURRING'
                      ? 'bg-violet/20 border-violet text-white'
                      : 'bg-surface-1 border-border text-text-muted hover:text-white',
                  )}
                >
                  <span className="font-semibold">Assinatura</span>
                  <span className="text-[10px] text-text-dim">Todo mês no cartão</span>
                </button>
              </div>
            </div>

            {/* Detalhes do Parcelamento se for Parcelado */}
            {cardPaymentMode === 'INSTALLMENTS' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border">
                <Field label="Número de Parcelas">
                  <select
                    value={installmentsCount}
                    onChange={(e) => setInstallmentsCount(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-surface-1 px-3 py-2 text-xs text-white focus:border-violet focus:outline-none"
                  >
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24, 36].map((n) => (
                      <option key={n} value={n}>
                        {n}x parcelas
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="O valor digitado abaixo é:">
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setInstallmentAmountMode('TOTAL')}
                      className={clsx(
                        'py-1.5 px-2 rounded-lg border text-[11px] font-medium transition cursor-pointer',
                        installmentAmountMode === 'TOTAL'
                          ? 'bg-violet/25 border-violet text-white'
                          : 'bg-surface-1 border-border text-text-muted hover:text-white',
                      )}
                    >
                      Valor Total
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstallmentAmountMode('PER_INSTALLMENT')}
                      className={clsx(
                        'py-1.5 px-2 rounded-lg border text-[11px] font-medium transition cursor-pointer',
                        installmentAmountMode === 'PER_INSTALLMENT'
                          ? 'bg-violet/25 border-violet text-white'
                          : 'bg-surface-1 border-border text-text-muted hover:text-white',
                      )}
                    >
                      Por Parcela
                    </button>
                  </div>
                </Field>
              </div>
            )}
          </div>
        )}

        {/* Se for Conta Bancária: Opção de Recorrência / Assinatura */}
        {sourceMode === 'ACCOUNT' && (
          <div className="rounded-2xl border border-border bg-surface-2 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRecurringAccount}
                  onChange={(e) => setIsRecurringAccount(e.target.checked)}
                  className="rounded border-border text-violet focus:ring-violet size-4"
                />
                <Repeat className="size-3.5 text-violet" />
                <span>Transação Recorrente / Assinatura em Conta</span>
              </label>
              {isRecurringAccount && (
                <span className="text-[11px] text-lime font-medium">Repete todo mês</span>
              )}
            </div>

            {isRecurringAccount && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
                <Field label="Duração da Recorrência">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsInfiniteAccount(true)}
                      className={clsx(
                        'py-1.5 px-2 rounded-lg border text-[11px] font-medium transition cursor-pointer',
                        isInfiniteAccount
                          ? 'bg-violet/25 border-violet text-white'
                          : 'bg-surface-1 border-border text-text-muted hover:text-white',
                      )}
                    >
                      Indefinida (Contínua)
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsInfiniteAccount(false)}
                      className={clsx(
                        'py-1.5 px-2 rounded-lg border text-[11px] font-medium transition cursor-pointer',
                        !isInfiniteAccount
                          ? 'bg-violet/25 border-violet text-white'
                          : 'bg-surface-1 border-border text-text-muted hover:text-white',
                      )}
                    >
                      Prazo Fixo
                    </button>
                  </div>
                </Field>

                {!isInfiniteAccount && (
                  <Field label="Quantidade de Meses">
                    <select
                      value={fixedInstallmentsAccount}
                      onChange={(e) => setFixedInstallmentsAccount(Number(e.target.value))}
                      className="w-full rounded-xl border border-border bg-surface-1 px-3 py-2 text-xs text-white focus:border-violet focus:outline-none"
                    >
                      {[2, 3, 6, 12, 18, 24, 36].map((m) => (
                        <option key={m} value={m}>
                          {m} meses
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
            )}
          </div>
        )}

        {/* Título / Descrição */}
        <Field label="Título / Descrição da Simulação">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder={
              sourceMode === 'CARD'
                ? 'ex.: Compra Notebook, Netflix, Jantar Especial'
                : type === 'INCOME'
                  ? 'ex.: Freelance extra, Bônus, Restituição'
                  : 'ex.: Internet Fibra, Aluguel, Reforma'
            }
            required
            autoFocus
          />
        </Field>

        {/* Valor com Atalhos Rápidos */}
        <div className="space-y-1.5">
          <Field
            label={
              sourceMode === 'CARD' && cardPaymentMode === 'INSTALLMENTS' && installmentAmountMode === 'TOTAL'
                ? `Valor Total da Compra (será dividido em ${installmentsCount}x de ${formatMoney(Math.round(amount / installmentsCount))})`
                : 'Valor'
            }
          >
            <MoneyInput value={amount} onChange={setAmount} />
          </Field>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] text-text-dim mr-1">Atalhos:</span>
            {[5000, 10000, 20000, 50000, 100000].map((cents) => (
              <button
                key={cents}
                type="button"
                onClick={() => handleAddAmount(cents)}
                className="rounded-lg border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-text-muted hover:border-violet/40 hover:text-white transition cursor-pointer"
              >
                +{formatMoney(cents)}
              </button>
            ))}
            {amount > 0 && (
              <button
                type="button"
                onClick={() => setAmount(0)}
                className="rounded-lg border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-text-dim hover:text-expense hover:border-expense/40 transition cursor-pointer"
              >
                Zerar
              </button>
            )}
          </div>
        </div>

        {/* Data com Chips Rápidos */}
        <div className="space-y-1.5">
          <Field label={sourceMode === 'CARD' ? 'Data da Compra / Cobrança' : 'Data Prevista'}>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </Field>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] text-text-dim mr-1">Data rápida:</span>
            <button
              type="button"
              onClick={() => handleQuickDate('today')}
              className="rounded-lg border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-text-muted hover:border-violet/40 hover:text-white transition cursor-pointer"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => handleQuickDate('tomorrow')}
              className="rounded-lg border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-text-muted hover:border-violet/40 hover:text-white transition cursor-pointer"
            >
              Amanhã
            </button>
            <button
              type="button"
              onClick={() => handleQuickDate('day5')}
              className="rounded-lg border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-text-muted hover:border-violet/40 hover:text-white transition cursor-pointer"
            >
              Dia 05
            </button>
            <button
              type="button"
              onClick={() => handleQuickDate('day10')}
              className="rounded-lg border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-text-muted hover:border-violet/40 hover:text-white transition cursor-pointer"
            >
              Dia 10
            </button>
            <button
              type="button"
              onClick={() => handleQuickDate('day15')}
              className="rounded-lg border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-text-muted hover:border-violet/40 hover:text-white transition cursor-pointer"
            >
              Dia 15
            </button>
            <button
              type="button"
              onClick={() => handleQuickDate('endOfMonth')}
              className="rounded-lg border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-text-muted hover:border-violet/40 hover:text-white transition cursor-pointer"
            >
              Fim do Mês
            </button>
          </div>
        </div>

        {/* Live Preview do Impacto Financeiro */}
        {previewInfo && (
          <div className="rounded-2xl border border-violet/40 bg-violet-subtle/30 p-3.5 space-y-1.5 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-violet flex items-center gap-1.5">
                <Sparkles className="size-3.5" />
                {previewInfo.title}
              </span>
              <span className="rounded-md bg-violet/20 px-2 py-0.5 text-[10px] font-medium text-violet">
                {previewInfo.badge}
              </span>
            </div>
            <p className="text-xs font-semibold text-white">{previewInfo.headline}</p>
            <p className="text-[11px] text-text-muted leading-relaxed">{previewInfo.detail}</p>
          </div>
        )}

        {/* Ações no Rodapé */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!title.trim() || !Number.isFinite(amount) || amount <= 0 || !date}
              onClick={() => handleSave(true)}
              className="border-violet/40 text-violet hover:bg-violet-subtle"
            >
              <Plus className="size-3.5" />
              Salvar e Adicionar Outro
            </Button>
            <Button
              type="button"
              disabled={!title.trim() || !Number.isFinite(amount) || amount <= 0 || !date}
              onClick={() => handleSave(false)}
            >
              Adicionar ao Cenário
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
