import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  useAccounts,
  useAllCategories,
  useCreditCards,
  useGroup,
  useGroupAccounts,
  useGroupCategories,
  useGroupCreditCards,
  useGroupDebts,
  useGroupUsedCategories,
  useUserDebtsSummary,
} from '@/lib/hooks'
import { useAuth } from '@/lib/auth'
import {
  addMissingTransactionCategories,
  matchesCategoryFilters,
  resolveTransactionCategory,
  synthesizeGeneralCategory,
} from '@/lib/categories'
import { normalizeGroupAccount } from '@/lib/jointAccounts'
import type {
  Account,
  Category,
  CreditCard,
  CreditCardInvoice,
  GroupDebtsResponse,
  GroupMember,
  Transaction,
} from '@/lib/types'
import { monthLabel, toISODate } from '@/lib/format'
import { normalizeCategoryColor } from '@/lib/palette'
import type {
  CalendarProjection,
  CategoryComparison,
  CumulativeSpendingPoint,
  DayProjection,
  DaySimulationItem,
  FinancialPlanningData,
  FutureMonthCommitment,
  GroupMemberExpense,
  KpiData,
  MonthlyCashFlow,
  ReportFiltersState,
  ReportPeriod,
  SharedGroupBalance,
  SimulatedTransaction,
  SpendingByDayOfWeek,
} from './types'

const DEFAULT_WARNING = 10000 // R$ 100,00

export function useWarningThreshold(userId?: string) {
  const key = `finance:calendar-warning:${userId ?? 'anon'}`
  const [value, setValue] = useState(() => {
    const raw = localStorage.getItem(key)
    return raw !== null && !Number.isNaN(Number(raw)) ? Number(raw) : DEFAULT_WARNING
  })
  const save = (v: number) => {
    localStorage.setItem(key, String(v))
    setValue(v)
  }
  return [value, save] as const
}

export function useSimulations(userId?: string) {
  const key = `finance:calendar-simulations:${userId ?? 'anon'}`
  const [simulations, setSimulations] = useState<SimulatedTransaction[]>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(
        (item): item is SimulatedTransaction =>
          Boolean(
            item &&
              typeof item === 'object' &&
              item.id &&
              item.title &&
              Number.isFinite(item.amount) &&
              item.date,
          ),
      )
    } catch {
      return []
    }
  })

  const addSimulation = (sim: Omit<SimulatedTransaction, 'id'>) => {
    const newSim: SimulatedTransaction = {
      ...sim,
      id: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    }
    setSimulations((prev) => {
      const next = [...prev, newSim]
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {}
      return next
    })
    return newSim
  }

  const removeSimulation = (id: string) => {
    setSimulations((prev) => {
      const next = prev.filter((s) => s.id !== id)
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const clearSimulations = () => {
    setSimulations([])
    try {
      localStorage.removeItem(key)
    } catch {}
  }

  return { simulations, addSimulation, removeSimulation, clearSimulations }
}

export const parseDateParts = (dateStr?: string) => {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.length < 10) {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
  }
  const parts = dateStr.slice(0, 10).split('-')
  const y = Number(parts[0])
  const m = Number(parts[1])
  const d = Number(parts[2])
  return {
    year: Number.isFinite(y) ? y : new Date().getFullYear(),
    month: Number.isFinite(m) ? m : new Date().getMonth() + 1,
    day: Number.isFinite(d) ? d : 1,
  }
}

/**
 * Calcula a fatura e o vencimento em que uma compra no cartão incidirá,
 * baseado na data da compra, dia de fechamento e dia de vencimento.
 * Espelha `CreditCardEntity.defaultInvoiceMonthYear` e `format.ts:defaultInvoicePeriod`.
 */
export function getInvoiceForCardPurchase(
  yc: number,
  mc: number,
  dc: number,
  closingDay: number,
  dueDay: number,
) {
  const safeClosing = closingDay || 25
  const safeDueInput = dueDay || 10
  const offset = (dc >= safeClosing ? 1 : 0) + (safeDueInput < safeClosing ? 1 : 0)
  const d = new Date(yc, mc - 1 + offset, 1)
  const invM = d.getMonth() + 1
  const invY = d.getFullYear()
  const daysInInvM = new Date(invY, invM, 0).getDate()
  const safeDue = Math.min(Math.max(1, safeDueInput), daysInInvM)
  const dueIso = `${invY}-${String(invM).padStart(2, '0')}-${String(safeDue).padStart(2, '0')}`
  return { invMonth: invM, invYear: invY, dueIso, dueDay: safeDue }
}

/**
 * Resolve o período de fatura (mês, ano) ao qual uma transação de cartão pertence.
 */
export function resolveTransactionInvoicePeriod(
  t: Transaction,
  cardsMap: Map<string, CreditCard>,
): { month: number; year: number } {
  if (t.invoiceMonth != null && t.invoiceYear != null) {
    return { month: t.invoiceMonth, year: t.invoiceYear }
  }
  const p = parseDateParts(t.date)
  const card = t.creditCardId ? cardsMap.get(t.creditCardId) : undefined
  const inv = getInvoiceForCardPurchase(
    p.year,
    p.month,
    p.day,
    card?.closingDay ?? 25,
    card?.dueDay ?? 10,
  )
  return { month: inv.invMonth, year: inv.invYear }
}

/**
 * Expande o conjunto de simulações cadastradas para o mês específico (month, year).
 * Trata:
 * - Lançamentos simples em conta
 * - Assinaturas / recorrências em conta (isInfinite ou repetições)
 * - Compras à vista no cartão (exibição no dia da compra + débito no vencimento da fatura)
 * - Compras parceladas no cartão (exibição no dia da compra + N parcelas nas faturas seguintes)
 * - Assinaturas recorrentes no cartão (exibição mensal no dia da cobrança + débito na fatura correspondente)
 */
export function expandSimulationsForMonth(
  simulations: SimulatedTransaction[],
  month: number,
  year: number,
  cardsMap?: Map<string, CreditCard>,
  _accountIdFilter?: string,
): Map<string, DaySimulationItem[]> {
  const result = new Map<string, DaySimulationItem[]>()
  const addItem = (dateIso: string, item: DaySimulationItem, parentId?: string) => {
    const list = result.get(dateIso) ?? []
    list.push({ ...item, originalId: item.originalId || parentId })
    result.set(dateIso, list)
  }

  const daysInCurrentMonth = new Date(year, month, 0).getDate()
  const currentMonthIdx = year * 12 + (month - 1)

  simulations.forEach((sim) => {
    const p = parseDateParts(sim.date)
    const isCard = sim.sourceMode === 'CARD' || !!sim.creditCardId
    const card = isCard && sim.creditCardId ? cardsMap?.get(sim.creditCardId) : undefined
    const closingDay = card?.closingDay ?? 25
    const dueDay = card?.dueDay ?? 10
    const cardName = card?.name ?? sim.cardName ?? 'Cartão'
    const cardAccountId = card?.accountId ?? sim.accountId
    const add = (iso: string, itm: DaySimulationItem) => addItem(iso, itm, sim.id)

    if (!isCard) {
      // -------------------------------------------------------------
      // CASO 1: CONTA BANCÁRIA
      // -------------------------------------------------------------
      if (!sim.isRecurring) {
        if (p.year === year && p.month === month) {
          const safeDay = Math.min(p.day, daysInCurrentMonth)
          const dateIso = `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
          add(dateIso, { ...sim, date: dateIso })
        }
      } else {
        const freq = sim.recurrenceFrequency || 'MONTHLY'
        const simStartIdx = p.year * 12 + (p.month - 1)
        const deltaMonths = currentMonthIdx - simStartIdx

        if (deltaMonths >= 0) {
          if (freq === 'MONTHLY') {
            const interval = sim.recurrenceInterval || 1
            const isDueThisMonth = deltaMonths % interval === 0
            const notExpired = sim.isInfinite || !sim.recurrenceInstallments || deltaMonths < sim.recurrenceInstallments

            if (isDueThisMonth && notExpired) {
              const safeDay = Math.min(p.day, daysInCurrentMonth)
              const dateIso = `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
              add(dateIso, {
                ...sim,
                id: `${sim.id}_m_${year}_${month}`,
                date: dateIso,
                installmentDisplay: 'Assinatura',
              })
            }
          } else if (freq === 'YEARLY') {
            const deltaYears = year - p.year
            if (deltaYears >= 0 && month === p.month) {
              const safeDay = Math.min(p.day, daysInCurrentMonth)
              const dateIso = `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
              add(dateIso, {
                ...sim,
                id: `${sim.id}_y_${year}`,
                date: dateIso,
                installmentDisplay: 'Anual',
              })
            }
          } else if (freq === 'WEEKLY') {
            const startDate = new Date(p.year, p.month - 1, p.day)
            const firstOfMonth = new Date(year, month - 1, 1)
            const lastOfMonth = new Date(year, month - 1, daysInCurrentMonth)
            let curr = new Date(startDate.getTime())
            while (curr <= lastOfMonth) {
              if (curr >= firstOfMonth && curr <= lastOfMonth) {
                const d = curr.getDate()
                const dateIso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                add(dateIso, {
                  ...sim,
                  id: `${sim.id}_w_${dateIso}`,
                  date: dateIso,
                  installmentDisplay: 'Semanal',
                })
              }
              curr.setDate(curr.getDate() + 7)
            }
          }
        }
      }
    } else {
      // -------------------------------------------------------------
      // CASO 2: CARTÃO DE CRÉDITO
      // -------------------------------------------------------------
      const totalInstallments = sim.totalInstallments && sim.totalInstallments > 1 ? sim.totalInstallments : 1

      if (!sim.isRecurring) {
        if (totalInstallments === 1) {
          // Subcaso 2A: Parcela única no cartão
          const inv = getInvoiceForCardPurchase(p.year, p.month, p.day, closingDay, dueDay)

          // 1. Registro visual no dia da compra (apenas se for o mês da compra)
          if (p.year === year && p.month === month) {
            const safeDay = Math.min(p.day, daysInCurrentMonth)
            const purchaseIso = `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
            add(purchaseIso, {
              ...sim,
              id: `${sim.id}_card_buy`,
              date: purchaseIso,
              cardName,
              isCardPurchaseDay: true,
              effectiveDebitDate: inv.dueIso,
              installmentDisplay: 'À vista no cartão',
            })
          }

          // 2. Débito bancário no dia de vencimento da fatura (se for o mês da fatura)
          if (inv.invYear === year && inv.invMonth === month) {
            add(inv.dueIso, {
              ...sim,
              id: `${sim.id}_card_debit`,
              title: `${sim.title} (Fatura ${cardName})`,
              date: inv.dueIso,
              accountId: cardAccountId,
              cardName,
              type: 'EXPENSE',
              isCardInvoiceDebitDay: true,
              installmentDisplay: `Fatura ${cardName}`,
            })
          }
        } else {
          // Subcaso 2B: Compra parcelada no cartão (N parcelas)
          const firstInv = getInvoiceForCardPurchase(p.year, p.month, p.day, closingDay, dueDay)

          // 1. Registro visual no dia da compra (mês da compra original)
          if (p.year === year && p.month === month) {
            const safeDay = Math.min(p.day, daysInCurrentMonth)
            const purchaseIso = `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
            add(purchaseIso, {
              ...sim,
              id: `${sim.id}_card_buy`,
              date: purchaseIso,
              cardName,
              isCardPurchaseDay: true,
              effectiveDebitDate: firstInv.dueIso,
              installmentDisplay: `Parcelado 1/${totalInstallments}`,
            })
          }

          // 2. Débito de cada uma das N parcelas nas faturas subsequentes
          const firstInvMonthIdx = firstInv.invYear * 12 + (firstInv.invMonth - 1)
          for (let k = 0; k < totalInstallments; k++) {
            const parcMonthIdx = firstInvMonthIdx + k
            if (parcMonthIdx === currentMonthIdx) {
              const safeDue = Math.min(Math.max(1, dueDay), daysInCurrentMonth)
              const dueIso = `${year}-${String(month).padStart(2, '0')}-${String(safeDue).padStart(2, '0')}`
              add(dueIso, {
                ...sim,
                id: `${sim.id}_card_parc_${k + 1}`,
                title: `${sim.title} (${k + 1}/${totalInstallments})`,
                date: dueIso,
                accountId: cardAccountId,
                cardName,
                type: 'EXPENSE',
                isCardInvoiceDebitDay: true,
                installmentNumber: k + 1,
                totalInstallments,
                installmentDisplay: `${k + 1}/${totalInstallments}`,
              })
            }
          }
        }
      } else {
        // Subcaso 2C: Assinatura recorrente no cartão
        const simStartIdx = p.year * 12 + (p.month - 1)
        const deltaMonths = currentMonthIdx - simStartIdx

        // 1. Registro visual no dia da cobrança neste mês
        if (deltaMonths >= 0) {
          const notExpired = sim.isInfinite || !sim.recurrenceInstallments || deltaMonths < sim.recurrenceInstallments
          if (notExpired) {
            const safeChargeDay = Math.min(p.day, daysInCurrentMonth)
            const chargeDateIso = `${year}-${String(month).padStart(2, '0')}-${String(safeChargeDay).padStart(2, '0')}`
            const chargeInv = getInvoiceForCardPurchase(year, month, safeChargeDay, closingDay, dueDay)
            add(chargeDateIso, {
              ...sim,
              id: `${sim.id}_card_charge_${year}_${month}`,
              date: chargeDateIso,
              cardName,
              isCardPurchaseDay: true,
              effectiveDebitDate: chargeInv.dueIso,
              installmentDisplay: 'Assinatura Cartão',
            })
          }
        }

        // 2. Débito na fatura que vence neste mês
        for (const k of [0, 1, 2]) {
          const chargeIdx = currentMonthIdx - k
          const chargeDelta = chargeIdx - simStartIdx
          if (chargeDelta < 0) continue

          const chargeNotExpired =
            sim.isInfinite || !sim.recurrenceInstallments || chargeDelta < sim.recurrenceInstallments
          if (!chargeNotExpired) continue

          const cY = Math.floor(chargeIdx / 12)
          const cM = (chargeIdx % 12) + 1
          const daysInChargeMonth = new Date(cY, cM, 0).getDate()
          const safeChargeDay = Math.min(p.day, daysInChargeMonth)
          const chargeInv = getInvoiceForCardPurchase(cY, cM, safeChargeDay, closingDay, dueDay)

          if (chargeInv.invMonth === month && chargeInv.invYear === year) {
            const safeDue = Math.min(Math.max(1, dueDay || 10), daysInCurrentMonth)
            const dueIso = `${year}-${String(month).padStart(2, '0')}-${String(safeDue).padStart(2, '0')}`
            add(dueIso, {
              ...sim,
              id: `${sim.id}_card_inv_debit_${year}_${month}_${cY}_${cM}`,
              title: `${sim.title} (Fatura ${cardName})`,
              date: dueIso,
              accountId: cardAccountId,
              cardName,
              type: 'EXPENSE',
              isCardInvoiceDebitDay: true,
              installmentDisplay: 'Assinatura',
            })
          }
        }
      }
    }
  })

  return result
}

// ----------------------------------------------------------------------
// FUNÇÕES AUXILIARES DE CÁLCULO ANALÍTICO
// ----------------------------------------------------------------------

export interface MonthSimulationParams {
  year: number
  month: number
  opening: number
  realOpening: number
  todayIso: string
  currentYear: number
  currentMonth: number
  accountSource: Transaction[]
  displaySource: Transaction[]
  simulations: SimulatedTransaction[]
  cardsMap?: Map<string, CreditCard>
  accountIdFilter?: string
  getMonthInvoices: (m: number, y: number) => {
    cardId: string
    cardName: string
    remainingAmount: number
    dueIso: string
    status?: string
  }[]
  effect: (t: Transaction) => number
  simEffect: (s: SimulatedTransaction | DaySimulationItem) => number
}

export interface MonthSimulationResult {
  days: DayProjection[]
  closing: number
  realClosing: number
  min: DayProjection
  realMin: DayProjection
  firstNegative?: DayProjection
  totalPendingExpense: number
  totalPendingIncome: number
}

export function simulateMonthDays(params: MonthSimulationParams): MonthSimulationResult {
  const {
    year,
    month,
    opening,
    realOpening,
    todayIso,
    currentYear,
    currentMonth,
    accountSource,
    displaySource,
    simulations,
    cardsMap,
    accountIdFilter,
    getMonthInvoices,
    effect,
    simEffect,
  } = params

  const monthIdx = year * 12 + (month - 1)
  const currentMonthIdx = currentYear * 12 + (currentMonth - 1)
  const isCurrentMonth = monthIdx === currentMonthIdx
  const daysInMonth = new Date(year, month, 0).getDate()

  // 1. Obter faturas apuradas para este mês
  const rawMonthInvoices = getMonthInvoices(month, year)

  // Separar faturas normais e faturas vencidas não pagas do ciclo atual.
  // Regra fundamental: se uma fatura do mês corrente possui vencimento anterior à data de hoje
  // (dueIso < todayIso) e não foi paga (status !== 'PAID' e remainingAmount > 0),
  // ela NÃO pode ser descartada sumariamente; é tratada como pendência ativa de pagamento a partir de todayIso.
  const overdueUnpaidInvoices: typeof rawMonthInvoices = []
  const regularInvoices: typeof rawMonthInvoices = []

  rawMonthInvoices.forEach((inv) => {
    if (isCurrentMonth && inv.dueIso < todayIso && inv.remainingAmount > 0 && inv.status !== 'PAID') {
      overdueUnpaidInvoices.push(inv)
    } else {
      regularInvoices.push(inv)
    }
  })

  // Mapeamento de faturas por dia para exibição no calendário
  const invoicesDisplayByDay = new Map<
    string,
    { cardId: string; cardName: string; remainingAmount: number; isOverdue?: boolean }[]
  >()

  // Faturas regulares no dia de vencimento
  regularInvoices.forEach((inv) => {
    const isPast = inv.dueIso < todayIso
    if (isPast && inv.remainingAmount <= 0) return
    invoicesDisplayByDay.set(inv.dueIso, [
      ...(invoicesDisplayByDay.get(inv.dueIso) ?? []),
      { cardId: inv.cardId, cardName: inv.cardName, remainingAmount: inv.remainingAmount, isOverdue: false },
    ])
  })

  // Faturas vencidas não pagas do ciclo:
  // Exibidas no dia de vencimento original (com flag isOverdue) e também no dia de hoje se todayIso estiver no mês
  overdueUnpaidInvoices.forEach((inv) => {
    invoicesDisplayByDay.set(inv.dueIso, [
      ...(invoicesDisplayByDay.get(inv.dueIso) ?? []),
      { cardId: inv.cardId, cardName: inv.cardName, remainingAmount: inv.remainingAmount, isOverdue: true },
    ])
    if (isCurrentMonth && inv.dueIso !== todayIso && todayIso.startsWith(`${year}-${String(month).padStart(2, '0')}`)) {
      invoicesDisplayByDay.set(todayIso, [
        ...(invoicesDisplayByDay.get(todayIso) ?? []),
        { cardId: inv.cardId, cardName: inv.cardName, remainingAmount: inv.remainingAmount, isOverdue: true },
      ])
    }
  })

  // Mapeamento de débito bancário por dia na projeção da conta
  const bankInvoiceDebitByDay = new Map<string, number>()
  regularInvoices.forEach((inv) => {
    if (inv.dueIso < todayIso) return
    bankInvoiceDebitByDay.set(inv.dueIso, (bankInvoiceDebitByDay.get(inv.dueIso) ?? 0) + inv.remainingAmount)
  })

  // Faturas vencidas não pagas entram no débito bancário exatamente no dia de hoje (ou no último dia do mês corrente)
  if (isCurrentMonth && overdueUnpaidInvoices.length > 0) {
    const totalOverdue = overdueUnpaidInvoices.reduce((s, inv) => s + inv.remainingAmount, 0)
    const effectiveTargetDay = todayIso.startsWith(`${year}-${String(month).padStart(2, '0')}`)
      ? todayIso
      : toISODate(new Date(year, month - 1, daysInMonth))

    bankInvoiceDebitByDay.set(
      effectiveTargetDay,
      (bankInvoiceDebitByDay.get(effectiveTargetDay) ?? 0) + totalOverdue,
    )
  }

  // 2. Mapeamento de transações bancárias e simulações por dia
  const accountByDay = new Map<string, Transaction[]>()
  accountSource.forEach((t) => {
    const p = parseDateParts(t.date)
    if (p.year === year && p.month === month && effect(t) !== 0) {
      const k = t.date.slice(0, 10)
      accountByDay.set(k, [...(accountByDay.get(k) ?? []), t])
    }
  })

  const displayByDay = new Map<string, Transaction[]>()
  displaySource.forEach((t) => {
    const p = parseDateParts(t.date)
    if (p.year === year && p.month === month) {
      const k = t.date.slice(0, 10)
      displayByDay.set(k, [...(displayByDay.get(k) ?? []), t])
    }
  })

  const simsByDay = expandSimulationsForMonth(
    simulations,
    month,
    year,
    cardsMap,
    accountIdFilter,
  )

  let runningReal = realOpening
  let runningSim = opening
  let totalPendingExpense = 0
  let totalPendingIncome = 0

  const days: DayProjection[] = []

  for (let i = 1; i <= daysInMonth; i++) {
    const date = toISODate(new Date(year, month - 1, i))
    const displayTxs = displayByDay.get(date) ?? []
    const acTxs = accountByDay.get(date) ?? []
    const dayInvoices = invoicesDisplayByDay.get(date) ?? []
    const daySims = simsByDay.get(date) ?? []

    const isPast = date < todayIso

    // Transações visíveis no dia
    const completedDisplayTxs = displayTxs.filter((t) => t.status === 'COMPLETED')
    const pendingDisplayTxs = displayTxs.filter((t) => t.status === 'PENDING')
    const completedDelta = completedDisplayTxs.reduce((s, t) => s + effect(t), 0)
    const pendingDelta = pendingDisplayTxs.reduce((s, t) => s + effect(t), 0)

    pendingDisplayTxs.forEach((t) => {
      if (t.type === 'EXPENSE') totalPendingExpense += t.amount
      else if (t.type === 'INCOME') totalPendingIncome += t.amount
    })

    // Movimentação na conta bancária:
    // Em dias passados (date < todayIso), transações PENDING e faturas não pagas não saíram da conta bancária.
    // Em dias presentes e futuros (date >= todayIso), a projeção inclui PENDING e faturas.
    const acCompletedDelta = acTxs.filter((t) => t.status === 'COMPLETED').reduce((s, t) => s + effect(t), 0)
    const acPendingDelta = acTxs.filter((t) => t.status === 'PENDING').reduce((s, t) => s + effect(t), 0)
    const dayInvoiceDebit = bankInvoiceDebitByDay.get(date) ?? 0

    const bankRealDelta = isPast
      ? acCompletedDelta
      : acCompletedDelta + acPendingDelta - dayInvoiceDebit

    const simulatedDelta = daySims.reduce((s, sim) => s + simEffect(sim), 0)
    const bankTotalDelta = bankRealDelta + simulatedDelta

    runningReal += bankRealDelta
    runningSim += bankTotalDelta

    // Delta diário exibido no card
    const dayDisplayDelta = isPast
      ? completedDelta + simulatedDelta
      : completedDelta + pendingDelta - dayInvoiceDebit + simulatedDelta

    days.push({
      day: i,
      date,
      txs: displayTxs,
      pendingTxs: pendingDisplayTxs,
      pendingDelta,
      completedDelta,
      invoices: dayInvoices,
      delta: dayDisplayDelta,
      balance: runningSim,
      simulations: daySims,
      simulatedDelta,
      realBalance: runningReal,
    })
  }

  const min = days.reduce(
    (m, d) => (d.balance < m.balance ? d : m),
    days[0] || { balance: 0, day: 1, date: '', txs: [], invoices: [], delta: 0 },
  )
  const realMin = days.reduce(
    (m, d) => ((d.realBalance ?? d.balance) < (m.realBalance ?? m.balance) ? d : m),
    days[0] || { balance: 0, day: 1, date: '', txs: [], invoices: [], delta: 0 },
  )
  const firstNegative = days.find((d) => d.balance < 0)

  return {
    days,
    closing: runningSim,
    realClosing: runningReal,
    min,
    realMin,
    firstNegative,
    totalPendingExpense,
    totalPendingIncome,
  }
}

export function buildCalendarProjection(
  accounts: Account[],
  transactions: Transaction[],
  invoices: {
    card: CreditCard
    invoice: Partial<CreditCardInvoice>
    month?: number
    year?: number
  }[],
  period: ReportPeriod,
  accountIdFilter?: string,
  allTransactions?: Transaction[],
  simulations: SimulatedTransaction[] = [],
  cards?: CreditCard[],
  referenceDate: Date = new Date(),
): CalendarProjection {
  const accs = accounts.filter((a) => !accountIdFilter || a.id === accountIdFilter)
  const ids = new Set(accs.map((a) => a.id))

  const cardsMap = new Map<string, CreditCard>()
  if (cards) {
    cards.forEach((c) => cardsMap.set(c.id, c))
  }
  invoices.forEach(({ card }) => cardsMap.set(card.id, card))

  const effect = (t: Transaction) => {
    if (t.creditCardId) return 0
    let v = 0
    if (t.type === 'INCOME' && ids.has(t.accountId)) v += t.amount
    if (t.type === 'EXPENSE' && ids.has(t.accountId)) v -= t.amount
    if (t.type === 'TRANSFER') {
      if (ids.has(t.accountId)) v -= t.amount
      if (t.destinationAccountId && ids.has(t.destinationAccountId)) v += t.amount
    }
    return v
  }

  const simEffect = (s: SimulatedTransaction | DaySimulationItem) => {
    if ('isCardPurchaseDay' in s && s.isCardPurchaseDay) return 0
    if (accountIdFilter && s.accountId && s.accountId !== accountIdFilter) return 0
    return s.type === 'INCOME' ? s.amount : -s.amount
  }

  const displaySource = transactions
  const accountSource = allTransactions || transactions

  const now = referenceDate
  const todayIso = toISODate(now)
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentMonthIdx = currentYear * 12 + (currentMonth - 1)
  const targetMonthIdx = period.year * 12 + (period.month - 1)

  // Ponto de partida real: saldo bancário confirmado hoje nas contas ativas selecionadas
  const realCurrentBalance = accs.reduce(
    (s, a) => s + (a.balance != null ? a.balance : (a.startBalance ?? 0)),
    0,
  )

  // Apuração de faturas de cartão para qualquer mês (m, y)
  const getMonthInvoices = (m: number, y: number) => {
    const daysInM = new Date(y, m, 0).getDate()
    const result: {
      cardId: string
      cardName: string
      remainingAmount: number
      dueIso: string
      status?: string
    }[] = []

    // Agrupa cartões únicos presentes na lista de faturas ou contas
    const cardMap = new Map<string, CreditCard>()
    invoices.forEach(({ card }) => cardMap.set(card.id, card))

    cardMap.forEach((card) => {
      if (accountIdFilter && card.accountId && card.accountId !== accountIdFilter) return

      // 1. Procura na lista de faturas carregadas da API correspondente a este cartão e a este mês/ano,
      // priorizando itens com valores reais sobre objetos vazios {}
      const matchingInvoices = invoices.filter(
        (item) =>
          item.card.id === card.id &&
          ((item.month === m && item.year === y) ||
            (item.invoice?.month === m && item.invoice?.year === y)),
      )
      const matched =
        matchingInvoices.find(
          (item) =>
            item.invoice != null &&
            (item.invoice.remainingAmount != null || item.invoice.totalAmount != null),
        ) ?? matchingInvoices[0]

      let remaining = 0
      let totalAmount = 0
      let paidAmount = 0
      let dueDateStr: string | undefined = undefined
      let status: string | undefined = undefined

      if (
        matched?.invoice &&
        (matched.invoice.remainingAmount != null || matched.invoice.totalAmount != null)
      ) {
        const inv = matched.invoice
        totalAmount = inv.totalAmount ?? 0
        paidAmount = inv.paidAmount ?? 0
        remaining =
          inv.remainingAmount != null ? inv.remainingAmount : Math.max(0, totalAmount - paidAmount)
        dueDateStr = inv.dueDate
        status = inv.status
      } else if (
        card.currentInvoiceAmount != null &&
        m === card.currentInvoiceMonth &&
        y === card.currentInvoiceYear
      ) {
        remaining = Math.max(0, card.currentInvoiceAmount)
      } else {
        // Fallback analítico: somatório líquido de compras e estornos do cartão que vencem nesta fatura
        const rawCardPurchases = accountSource
          .filter((t) => {
            if (
              t.creditCardId !== card.id ||
              (t.type !== 'EXPENSE' && t.type !== 'INCOME') ||
              isInvoicePaymentTx(t)
            ) {
              return false
            }
            const invPeriod = resolveTransactionInvoicePeriod(t, cardsMap)
            return invPeriod.month === m && invPeriod.year === y
          })
          .reduce((s, t) => s + (t.type === 'INCOME' ? -t.amount : t.amount), 0)

        const cardPurchases = Math.max(0, rawCardPurchases)

        const matchedInvoiceId =
          matched?.invoice && 'id' in matched.invoice
            ? (matched.invoice as { id?: string }).id
            : undefined

        const alreadyPaid = accountSource
          .filter((t) => isInvoicePaymentForCardPeriod(t, card, m, y, matchedInvoiceId))
          .reduce((s, t) => s + t.amount, 0)

        remaining = Math.max(0, cardPurchases - alreadyPaid)
      }

      if (remaining <= 0) return

      let dueIso: string
      if (dueDateStr) {
        const rawIso = dueDateStr.slice(0, 10)
        const p = parseDateParts(rawIso)
        if (p.year === y && p.month === m) {
          dueIso = rawIso
        } else {
          const safeDay = Math.min(Math.max(1, card.dueDay || p.day || 10), daysInM)
          dueIso = toISODate(new Date(y, m - 1, safeDay))
        }
      } else {
        const safeDay = Math.min(Math.max(1, card.dueDay || 10), daysInM)
        dueIso = toISODate(new Date(y, m - 1, safeDay))
      }

      result.push({
        cardId: card.id,
        cardName: card.name,
        remainingAmount: remaining,
        dueIso,
        status,
      })
    })

    return result
  }

  // No backend, o saldo da conta reflete apenas transações com status COMPLETED.
  // Transações PENDING nunca alteram o saldo bancário da conta.
  const completedAccountTxs = accountSource.filter((t) => t.status === 'COMPLETED' && effect(t) !== 0)

  // Saldo de abertura do mês corrente: reverte as transações COMPLETED a partir do primeiro dia do mês corrente
  const firstIsoOfCurrentMonth = toISODate(new Date(currentYear, currentMonth - 1, 1))
  const completedTxsFromCurrentMonth = completedAccountTxs.filter((t) => t.date.slice(0, 10) >= firstIsoOfCurrentMonth)
  const deltaFromCurrentMonth = completedTxsFromCurrentMonth.reduce((s, t) => s + effect(t), 0)
  const openingCurrentMonth = realCurrentBalance - deltaFromCurrentMonth

  let targetOpening = openingCurrentMonth
  let targetRealOpening = openingCurrentMonth
  let targetResult: MonthSimulationResult

  if (targetMonthIdx < currentMonthIdx) {
    // 1. Para meses passados:
    // Reverte todas as transações COMPLETED a partir do primeiro dia do mês selecionado.
    const targetMonthFirstIso = toISODate(new Date(period.year, period.month - 1, 1))
    const completedTxsFromTarget = completedAccountTxs.filter((t) => t.date.slice(0, 10) >= targetMonthFirstIso)
    const deltaFromTarget = completedTxsFromTarget.reduce((s, t) => s + effect(t), 0)
    targetRealOpening = realCurrentBalance - deltaFromTarget
    targetOpening = targetRealOpening

    targetResult = simulateMonthDays({
      year: period.year,
      month: period.month,
      opening: targetOpening,
      realOpening: targetRealOpening,
      todayIso,
      currentYear,
      currentMonth,
      accountSource,
      displaySource,
      simulations,
      cardsMap,
      accountIdFilter,
      getMonthInvoices,
      effect,
      simEffect,
    })
  } else if (targetMonthIdx === currentMonthIdx) {
    // 2. Para o mês corrente:
    targetRealOpening = openingCurrentMonth
    targetOpening = openingCurrentMonth

    targetResult = simulateMonthDays({
      year: currentYear,
      month: currentMonth,
      opening: targetOpening,
      realOpening: targetRealOpening,
      todayIso,
      currentYear,
      currentMonth,
      accountSource,
      displaySource,
      simulations,
      cardsMap,
      accountIdFilter,
      getMonthInvoices,
      effect,
      simEffect,
    })
  } else {
    // 3. Para meses futuros:
    // Encadeamento estrito via simulateMonthDays:
    // Simula o mês corrente (inclusive faturas ativas e simulações do mês corrente),
    // depois simula todos os meses intermediários em cascata garantindo que
    // opening(M+1) === closing(M) rigorosamente.
    const curMonthResult = simulateMonthDays({
      year: currentYear,
      month: currentMonth,
      opening: openingCurrentMonth,
      realOpening: openingCurrentMonth,
      todayIso,
      currentYear,
      currentMonth,
      accountSource,
      displaySource,
      simulations,
      cardsMap,
      accountIdFilter,
      getMonthInvoices,
      effect,
      simEffect,
    })

    let cascadeSim = curMonthResult.closing
    let cascadeReal = curMonthResult.realClosing
    const maxCascadeIdx = Math.min(targetMonthIdx, currentMonthIdx + MAX_CASCADE_INVOICE_MONTHS)

    for (let idx = currentMonthIdx + 1; idx < maxCascadeIdx; idx++) {
      const intYear = Math.floor(idx / 12)
      const intMonth = (idx % 12) + 1

      const intResult = simulateMonthDays({
        year: intYear,
        month: intMonth,
        opening: cascadeSim,
        realOpening: cascadeReal,
        todayIso,
        currentYear,
        currentMonth,
        accountSource,
        displaySource,
        simulations,
        cardsMap,
        accountIdFilter,
        getMonthInvoices,
        effect,
        simEffect,
      })

      cascadeSim = intResult.closing
      cascadeReal = intResult.realClosing
    }

    targetOpening = cascadeSim
    targetRealOpening = cascadeReal

    targetResult = simulateMonthDays({
      year: period.year,
      month: period.month,
      opening: targetOpening,
      realOpening: targetRealOpening,
      todayIso,
      currentYear,
      currentMonth,
      accountSource,
      displaySource,
      simulations,
      cardsMap,
      accountIdFilter,
      getMonthInvoices,
      effect,
      simEffect,
    })
  }

  return {
    days: targetResult.days,
    opening: targetOpening,
    closing: targetResult.closing,
    min: targetResult.min,
    firstNegative: targetResult.firstNegative,
    realOpening: targetRealOpening,
    realClosing: targetResult.realClosing,
    realMin: targetResult.realMin,
    hasSimulations: simulations.length > 0,
    totalPendingExpense: targetResult.totalPendingExpense,
    totalPendingIncome: targetResult.totalPendingIncome,
  }
}

export const isInvoicePaymentTx = (t: Transaction) =>
  !t.creditCardId &&
  Boolean(t.creditCardInvoiceId || t.title.trim().toLowerCase().startsWith('pagamento fatura'))

const INVOICE_PAYMENT_TITLE_REGEX = /^pagamento fatura (.+) \((0?[1-9]|1[0-2])\/(\d{4})\)$/i

/**
 * Verifica se uma transação representa um pagamento concluído pertencente à fatura
 * específica de (card, month, year), evitando que pagamentos de outros meses ou
 * cartões com nome semelhante sejam abatidos no fallback analítico.
 */
export function isInvoicePaymentForCardPeriod(
  t: Transaction,
  card: CreditCard,
  month: number,
  year: number,
  matchedInvoiceId?: string,
): boolean {
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    return false
  }
  if (t.creditCardId || t.type !== 'EXPENSE' || t.status !== 'COMPLETED' || !isInvoicePaymentTx(t)) {
    return false
  }
  if (matchedInvoiceId && t.creditCardInvoiceId === matchedInvoiceId) {
    return true
  }
  if (matchedInvoiceId && t.creditCardInvoiceId && t.creditCardInvoiceId !== matchedInvoiceId) {
    return false
  }
  const match = INVOICE_PAYMENT_TITLE_REGEX.exec(t.title.trim())
  if (!match) return false
  const [, rawCardName, rawMonth, rawYear] = match
  return (
    rawCardName.trim().toLowerCase() === card.name.trim().toLowerCase() &&
    Number(rawMonth) === month &&
    Number(rawYear) === year
  )
}

export function buildKpis(
  currentMonthTxs: Transaction[],
  projection: { days: { day: number; balance: number }[]; closing: number; min: { day: number; balance: number } },
  period: ReportPeriod,
  hasCardsIncluded: boolean = true,
): KpiData {
  const income = currentMonthTxs
    .filter((t) => t.type === 'INCOME')
    .reduce((s, t) => s + t.amount, 0)

  const expenseTxs = currentMonthTxs.filter(
    (t) => t.type === 'EXPENSE' && (!hasCardsIncluded || !isInvoicePaymentTx(t)),
  )
  const expense = expenseTxs.reduce((s, t) => s + t.amount, 0)
  const net = income - expense

  const cardExpense = expenseTxs
    .filter((t) => !!t.creditCardId)
    .reduce((s, t) => s + t.amount, 0)
  const accountExpense = expense - cardExpense
  const cardSharePct = expense > 0 ? Math.round((cardExpense / expense) * 100) : 0

  const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0

  const today = new Date()
  const daysInMonth = new Date(period.year, period.month, 0).getDate()
  const isCurrentMonth = today.getFullYear() === period.year && today.getMonth() + 1 === period.month
  const daysPassed = isCurrentMonth ? Math.max(1, today.getDate()) : daysInMonth
  const dailyAverage = Math.round(expense / daysPassed)

  return {
    income,
    expense,
    net,
    savingsRate,
    dailyAverage,
    projectedMonthEnd: projection.closing,
    cardExpense,
    accountExpense,
    cardSharePct,
    minBalanceDay: projection.min.day,
    minBalanceAmount: projection.min.balance,
  }
}

export function buildCashFlowHistory(
  allTxs: Transaction[],
  period: ReportPeriod,
  hasCardsIncluded: boolean = true,
): MonthlyCashFlow[] {
  const list: MonthlyCashFlow[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(period.year, period.month - 1 - i, 1)
    const m = d.getMonth() + 1
    const y = d.getFullYear()

    const txs = allTxs.filter((t) => {
      const p = parseDateParts(t.date)
      return p.year === y && p.month === m
    })

    const inc = txs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0)
    const exp = txs
      .filter((t) => t.type === 'EXPENSE' && (!hasCardsIncluded || !isInvoicePaymentTx(t)))
      .reduce((s, t) => s + t.amount, 0)

    list.push({
      label: `${monthLabel(m, y).slice(0, 3)}/${String(y).slice(-2)}`,
      month: m,
      year: y,
      income: inc,
      expense: exp,
      net: inc - exp,
    })
  }
  return list
}

export function buildCategoryEvolution(
  currentMonthTxs: Transaction[],
  prevMonthTxs: Transaction[],
  categories: Category[],
  hasCardsIncluded: boolean = true,
): CategoryComparison[] {
  const catInfoMap = new Map(categories.map((c) => [c.id, c]))

  interface ChildAccumulator {
    id: string
    name: string
    icon?: string | null
    rawColor?: string | null
    parentId?: string | null
    parentName?: string
    currentAmount: number
    previousAmount: number
  }

  interface GeneralAccumulator {
    key: string
    id?: string
    name: string
    icon?: string | null
    rawColor?: string | null
    level?: 'GENERAL' | 'SPECIFIC'
    currentAmount: number
    previousAmount: number
    directCurrentAmount: number
    directPreviousAmount: number
    children: Map<string, ChildAccumulator>
  }

  const buckets = new Map<string, GeneralAccumulator>()
  let totalCurrentExpense = 0

  const accumulate = (t: Transaction, periodKind: 'current' | 'previous') => {
    if (t.type !== 'EXPENSE' || (hasCardsIncluded && isInvoicePaymentTx(t))) return
    if (periodKind === 'current') totalCurrentExpense += t.amount

    const resolved = resolveTransactionCategory(t, catInfoMap)
    const isUncategorized = !resolved.general && !resolved.specific

    let key: string
    let id: string | undefined
    let name: string
    let icon: string | null | undefined
    let rawColor: string | null | undefined
    let level: 'GENERAL' | 'SPECIFIC' | undefined

    if (isUncategorized) {
      key = 'none'
      name = 'Sem categoria'
      rawColor = '#8E8EA0'
    } else if (resolved.general) {
      key = resolved.general.id
      id = resolved.general.id
      name = resolved.general.name
      icon = resolved.general.icon ?? resolved.icon
      rawColor = resolved.general.color ?? resolved.color
      level = 'GENERAL'
    } else {
      const onlySpec = resolved.specific!
      key = onlySpec.id
      id = onlySpec.id
      name = onlySpec.name
      icon = onlySpec.icon
      rawColor = onlySpec.color
      level = 'SPECIFIC'
    }

    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = {
        key,
        id,
        name,
        icon,
        rawColor,
        level,
        currentAmount: 0,
        previousAmount: 0,
        directCurrentAmount: 0,
        directPreviousAmount: 0,
        children: new Map(),
      }
      buckets.set(key, bucket)
    }

    if (periodKind === 'current') bucket.currentAmount += t.amount
    else bucket.previousAmount += t.amount

    if (resolved.general && resolved.specific) {
      const childKey = resolved.specific.id
      let child = bucket.children.get(childKey)
      if (!child) {
        child = {
          id: resolved.specific.id,
          name: resolved.specific.name,
          icon: resolved.specific.icon ?? resolved.general.icon,
          rawColor: resolved.specific.color ?? resolved.general.color,
          parentId: resolved.general.id,
          parentName: resolved.general.name,
          currentAmount: 0,
          previousAmount: 0,
        }
        bucket.children.set(childKey, child)
      }
      if (periodKind === 'current') child.currentAmount += t.amount
      else child.previousAmount += t.amount
    } else if (resolved.general && !resolved.specific) {
      if (periodKind === 'current') bucket.directCurrentAmount += t.amount
      else bucket.directPreviousAmount += t.amount
    }
  }

  currentMonthTxs.forEach((t) => accumulate(t, 'current'))
  prevMonthTxs.forEach((t) => accumulate(t, 'previous'))

  const comparisons: CategoryComparison[] = []
  let colorIdx = 0

  buckets.forEach((bucket) => {
    if (bucket.currentAmount === 0 && bucket.previousAmount === 0) return

    const color =
      bucket.key === 'none' ? '#8E8EA0' : normalizeCategoryColor(bucket.rawColor, colorIdx)
    colorIdx++

    const pctOfTotal =
      totalCurrentExpense > 0 ? Math.round((bucket.currentAmount / totalCurrentExpense) * 100) : 0
    const isNew = bucket.previousAmount === 0 && bucket.currentAmount > 0
    const momVariation =
      bucket.previousAmount > 0
        ? Math.round(((bucket.currentAmount - bucket.previousAmount) / bucket.previousAmount) * 100)
        : null

    let childColorIdx = 0
    const children: CategoryComparison[] = [...bucket.children.values()]
      .filter((ch) => ch.currentAmount > 0 || ch.previousAmount > 0)
      .map((ch) => {
        const chColor = normalizeCategoryColor(ch.rawColor ?? bucket.rawColor, childColorIdx++)
        const chPct =
          totalCurrentExpense > 0 ? Math.round((ch.currentAmount / totalCurrentExpense) * 100) : 0
        const chPctOfParent =
          bucket.currentAmount > 0 ? Math.round((ch.currentAmount / bucket.currentAmount) * 100) : 0
        const chIsNew = ch.previousAmount === 0 && ch.currentAmount > 0
        const chMom =
          ch.previousAmount > 0
            ? Math.round(((ch.currentAmount - ch.previousAmount) / ch.previousAmount) * 100)
            : null
        return {
          id: ch.id,
          name: ch.name,
          icon: ch.icon,
          color: chColor,
          level: 'SPECIFIC' as const,
          parentId: ch.parentId,
          parentName: ch.parentName,
          parentIcon: bucket.icon ?? null,
          parentColor: color,
          isDirectGeneral: false,
          currentAmount: ch.currentAmount,
          previousAmount: ch.previousAmount,
          percentageOfTotal: chPct,
          percentageOfParent: chPctOfParent,
          momVariationPct: chMom,
          isNew: chIsNew,
        }
      })

    if (bucket.level === 'GENERAL' && bucket.id && (bucket.directCurrentAmount > 0 || bucket.directPreviousAmount > 0)) {
      const dirPctTotal =
        totalCurrentExpense > 0 ? Math.round((bucket.directCurrentAmount / totalCurrentExpense) * 100) : 0
      const dirPctParent =
        bucket.currentAmount > 0 ? Math.round((bucket.directCurrentAmount / bucket.currentAmount) * 100) : 0
      const dirMom =
        bucket.directPreviousAmount > 0
          ? Math.round(
              ((bucket.directCurrentAmount - bucket.directPreviousAmount) / bucket.directPreviousAmount) * 100,
            )
          : null

      children.push({
        id: `${bucket.id}__direct`,
        name: `Sem específica (direto em ${bucket.name})`,
        icon: bucket.icon ?? null,
        color,
        level: 'SPECIFIC' as const,
        parentId: bucket.id,
        parentName: bucket.name,
        parentIcon: bucket.icon ?? null,
        parentColor: color,
        isDirectGeneral: true,
        currentAmount: bucket.directCurrentAmount,
        previousAmount: bucket.directPreviousAmount,
        percentageOfTotal: dirPctTotal,
        percentageOfParent: dirPctParent,
        momVariationPct: dirMom,
        isNew: bucket.directPreviousAmount === 0 && bucket.directCurrentAmount > 0,
      })
    }

    children.sort(
      (a, b) =>
        b.currentAmount - a.currentAmount ||
        b.previousAmount - a.previousAmount ||
        a.name.localeCompare(b.name, 'pt-BR'),
    )

    comparisons.push({
      id: bucket.id,
      name: bucket.name,
      icon: bucket.icon,
      color,
      level: bucket.level,
      isUncategorized: bucket.key === 'none',
      currentAmount: bucket.currentAmount,
      previousAmount: bucket.previousAmount,
      percentageOfTotal: pctOfTotal,
      momVariationPct: momVariation,
      isNew,
      children,
    })
  })

  return comparisons.sort(
    (a, b) =>
      b.currentAmount - a.currentAmount ||
      b.previousAmount - a.previousAmount ||
      a.name.localeCompare(b.name, 'pt-BR'),
  )
}

export function buildFutureCommitments(
  allTxs: Transaction[],
  cards: CreditCard[],
  period: ReportPeriod,
  hideCreditCards: boolean,
): FutureMonthCommitment[] {
  const cardsMap = new Map(cards.map((c) => [c.id, c]))
  const list: FutureMonthCommitment[] = []

  for (let i = 1; i <= 6; i++) {
    const d = new Date(period.year, period.month - 1 + i, 1)
    const m = d.getMonth() + 1
    const y = d.getFullYear()

    let cardCommitted = 0
    if (!hideCreditCards) {
      allTxs
        .filter((t) => !!t.creditCardId && t.type === 'EXPENSE')
        .forEach((t) => {
          const invPeriod = resolveTransactionInvoicePeriod(t, cardsMap)
          if (invPeriod.month === m && invPeriod.year === y) {
            cardCommitted += t.amount
          }
        })
    }

    const accountPending = allTxs
      .filter((t) => {
        if (t.creditCardId || t.status !== 'PENDING' || t.type !== 'EXPENSE') return false
        const p = parseDateParts(t.date)
        return p.year === y && p.month === m
      })
      .reduce((s, t) => s + t.amount, 0)

    const total = Math.max(0, cardCommitted) + accountPending

    list.push({
      label: `${monthLabel(m, y).slice(0, 3)}/${String(y).slice(-2)}`,
      month: m,
      year: y,
      cardCommitted: Math.max(0, cardCommitted),
      accountPending,
      totalCommitted: total,
    })
  }

  return list
}

export function buildSpendingHabits(
  currentMonthTxs: Transaction[],
  prevMonthTxs: Transaction[],
  period: ReportPeriod,
  hasCardsIncluded: boolean = true,
): { cumulativePoints: CumulativeSpendingPoint[]; byDayOfWeek: SpendingByDayOfWeek[] } {
  const daysInCurrentMonth = new Date(period.year, period.month, 0).getDate()
  const daysInPrevMonth = new Date(period.year, period.month - 1, 0).getDate()
  const maxDays = Math.max(daysInCurrentMonth, daysInPrevMonth)

  const currentDaily = new Array(daysInCurrentMonth + 1).fill(0)
  currentMonthTxs
    .filter((t) => t.type === 'EXPENSE' && (!hasCardsIncluded || !isInvoicePaymentTx(t)))
    .forEach((t) => {
      const p = parseDateParts(t.date)
      if (p.day <= daysInCurrentMonth) {
        currentDaily[p.day] += t.amount
      }
    })

  const prevDaily = new Array(daysInPrevMonth + 1).fill(0)
  prevMonthTxs
    .filter((t) => t.type === 'EXPENSE' && (!hasCardsIncluded || !isInvoicePaymentTx(t)))
    .forEach((t) => {
      const p = parseDateParts(t.date)
      if (p.day <= daysInPrevMonth) {
        prevDaily[p.day] += t.amount
      }
    })

  const today = new Date()
  const isCurrentMonth = today.getFullYear() === period.year && today.getMonth() + 1 === period.month
  const todayDay = isCurrentMonth ? today.getDate() : 31

  const cumulativePoints: CumulativeSpendingPoint[] = []
  let currentAcc = 0
  let prevAcc = 0

  for (let day = 1; day <= maxDays; day++) {
    if (day <= daysInCurrentMonth && day <= todayDay) {
      currentAcc += currentDaily[day]
    }
    if (day <= daysInPrevMonth) {
      prevAcc += prevDaily[day]
    }

    cumulativePoints.push({
      day,
      currentMonthAmount: day <= todayDay ? currentAcc : currentAcc,
      previousMonthAmount: prevAcc,
    })
  }

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const weekdayTotals = [0, 0, 0, 0, 0, 0, 0]

  currentMonthTxs
    .filter((t) => t.type === 'EXPENSE' && (!hasCardsIncluded || !isInvoicePaymentTx(t)))
    .forEach((t) => {
      const p = parseDateParts(t.date)
      const d = new Date(p.year, p.month - 1, p.day)
      const dayIdx = d.getDay()
      weekdayTotals[dayIdx] += t.amount
    })

  const byDayOfWeek: SpendingByDayOfWeek[] = weekDays.map((name, idx) => ({
    dayName: name,
    dayIndex: idx,
    amount: weekdayTotals[idx],
  }))

  return { cumulativePoints, byDayOfWeek }
}

export function buildGroupMemberExpenses(
  groupTxs: Transaction[],
  members: GroupMember[],
  period: ReportPeriod,
  hasCardsIncluded: boolean = true,
): GroupMemberExpense[] {
  const monthTxs = groupTxs.filter((t) => {
    const p = parseDateParts(t.date)
    return (
      p.year === period.year &&
      p.month === period.month &&
      t.type === 'EXPENSE' &&
      (!hasCardsIncluded || !isInvoicePaymentTx(t))
    )
  })

  const totalExpense = monthTxs.reduce((s, t) => s + t.amount, 0)
  const memberMap = new Map<string, { totalExpense: number; txCount: number }>()

  monthTxs.forEach((t) => {
    const respId = t.responsibleId || t.responsible?.id || 'unknown'
    const cur = memberMap.get(respId) ?? { totalExpense: 0, txCount: 0 }
    cur.totalExpense += t.amount
    cur.txCount += 1
    memberMap.set(respId, cur)
  })

  const result: GroupMemberExpense[] = members.map((m) => {
    const stats = memberMap.get(m.user.id) ?? { totalExpense: 0, txCount: 0 }
    const pct = totalExpense > 0 ? Math.round((stats.totalExpense / totalExpense) * 100) : 0
    return {
      memberId: m.user.id,
      name: `${m.user.firstName} ${m.user.lastName}`.trim(),
      email: m.user.email,
      avatarUrl: (m.user as { avatarUrl?: string }).avatarUrl,
      role: m.role,
      totalExpense: stats.totalExpense,
      percentage: pct,
      txCount: stats.txCount,
    }
  })

  // Transações de possíveis membros anteriores que gastaram no grupo
  memberMap.forEach((stats, memberId) => {
    if (memberId !== 'unknown' && !members.some((m) => m.user.id === memberId)) {
      const pct = totalExpense > 0 ? Math.round((stats.totalExpense / totalExpense) * 100) : 0
      result.push({
        memberId,
        name: 'Membro anterior',
        email: '',
        role: 'MEMBER',
        totalExpense: stats.totalExpense,
        percentage: pct,
        txCount: stats.txCount,
      })
    }
  })

  return result.sort((a, b) => b.totalExpense - a.totalExpense)
}

export function calculateFinancialPlanning(
  allTxs: Transaction[],
  cards: CreditCard[],
  operationalAccounts: Account[],
  savingsAccounts: Account[],
  investmentAccounts: Account[],
  period: ReportPeriod,
  windowMonths: 6 | 12 = 6,
): FinancialPlanningData {
  const operationalAccountIds = new Set(operationalAccounts.map((a) => a.id))
  const cardsMap = new Map(cards.map((c) => [c.id, c]))

  const txBelongsToPeriod = (t: Transaction, m: number, y: number): boolean => {
    if (t.creditCardId) {
      const inv = resolveTransactionInvoicePeriod(t, cardsMap)
      return inv.month === m && inv.year === y
    }
    if (operationalAccountIds.has(t.accountId)) {
      const p = parseDateParts(t.date)
      return p.month === m && p.year === y
    }
    return false
  }

  // 1. Totais Guardados (Reserva e Investimentos somados separadamente)
  const totalSavings = savingsAccounts.reduce((sum, a) => sum + (a.balance ?? 0), 0)
  const totalInvestments = investmentAccounts.reduce((sum, a) => sum + (a.balance ?? 0), 0)

  // 2. Gastos Fixos: Despesas recorrentes contínuas (isInfinite === true)
  // de contas operacionais e cartões de crédito (ignorando pagamento de fatura)
  const fixedTxsInSelectedMonth = allTxs.filter((t) => {
    if (t.type !== 'EXPENSE' || !t.isInfinite || isInvoicePaymentTx(t)) return false
    return txBelongsToPeriod(t, period.month, period.year)
  })

  let fixedMonthlyCost = fixedTxsInSelectedMonth.reduce((s, t) => s + t.amount, 0)

  // Se não houver despesas fixas instanciadas no mês selecionado, busca os compromissos fixos cadastrados mais recentes
  if (fixedMonthlyCost === 0) {
    const recurringMap = new Map<string, number>()
    allTxs
      .filter((t) => {
        if (t.type !== 'EXPENSE' || !t.isInfinite || isInvoicePaymentTx(t)) return false
        return Boolean(t.creditCardId || operationalAccountIds.has(t.accountId))
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach((t) => {
        const key = t.recurrenceGroupId || `${t.title}-${t.amount}`
        if (!recurringMap.has(key)) {
          recurringMap.set(key, t.amount)
        }
      })
    fixedMonthlyCost = Array.from(recurringMap.values()).reduce((s, amt) => s + amt, 0)
  }

  // 3. Gastos Variáveis: Média das despesas não-fixas (isInfinite !== true, avulsas + parceladas)
  // nos últimos 6 a 12 meses
  const monthlyVariableTotals: number[] = []

  for (let i = 1; i <= windowMonths; i++) {
    const d = new Date(period.year, period.month - 1 - i, 1)
    const m = d.getMonth() + 1
    const y = d.getFullYear()

    const monthVarSum = allTxs
      .filter((t) => {
        if (t.type !== 'EXPENSE' || t.isInfinite || isInvoicePaymentTx(t)) return false
        return txBelongsToPeriod(t, m, y)
      })
      .reduce((s, t) => s + t.amount, 0)

    if (monthVarSum > 0) {
      monthlyVariableTotals.push(monthVarSum)
    }
  }

  let variableMonthlyAverage = 0
  let monthsAnalyzedCount = monthlyVariableTotals.length

  if (monthlyVariableTotals.length > 0) {
    const sum = monthlyVariableTotals.reduce((s, val) => s + val, 0)
    variableMonthlyAverage = Math.round(sum / monthlyVariableTotals.length)
  } else {
    // Fallback: se não há histórico nos meses anteriores, analisa variáveis do mês corrente
    const currentMonthVar = allTxs
      .filter((t) => {
        if (t.type !== 'EXPENSE' || t.isInfinite || isInvoicePaymentTx(t)) return false
        return txBelongsToPeriod(t, period.month, period.year)
      })
      .reduce((s, t) => s + t.amount, 0)

    if (currentMonthVar > 0) {
      variableMonthlyAverage = currentMonthVar
      monthsAnalyzedCount = 1
    }
  }

  const averageMonthlyCost = fixedMonthlyCost + variableMonthlyAverage
  const savingsCoverageMonths =
    averageMonthlyCost > 0 ? Number((totalSavings / averageMonthlyCost).toFixed(1)) : 0

  return {
    totalSavings,
    savingsAccountsCount: savingsAccounts.length,
    totalInvestments,
    investmentAccountsCount: investmentAccounts.length,
    fixedMonthlyCost,
    variableMonthlyAverage,
    averageMonthlyCost,
    savingsCoverageMonths,
    monthsAnalyzedCount,
    calculationWindowMonths: windowMonths,
  }
}

export const MAX_CASCADE_INVOICE_MONTHS = 60

/**
 * Calcula todos os períodos (mês, ano) de faturas necessários para projetar
 * o calendário até `targetPeriod` mantendo a cascata estrita a partir do mês corrente.
 */
export function getRequiredInvoicePeriods(
  currentMonth: number,
  currentYear: number,
  targetPeriod: ReportPeriod,
): ReportPeriod[] {
  const safeCurrentMonth = Number.isInteger(currentMonth)
    ? Math.min(12, Math.max(1, currentMonth))
    : 1
  const safeTargetMonth = Number.isInteger(targetPeriod.month)
    ? Math.min(12, Math.max(1, targetPeriod.month))
    : safeCurrentMonth
  const safeCurrentYear = Number.isInteger(currentYear) ? currentYear : new Date().getFullYear()
  const safeTargetYear = Number.isInteger(targetPeriod.year)
    ? targetPeriod.year
    : safeCurrentYear

  const currentIdx = safeCurrentYear * 12 + (safeCurrentMonth - 1)
  const targetIdx = safeTargetYear * 12 + (safeTargetMonth - 1)

  if (targetIdx <= currentIdx) {
    return [{ month: safeTargetMonth, year: safeTargetYear }]
  }

  const maxIdx = Math.min(targetIdx, currentIdx + MAX_CASCADE_INVOICE_MONTHS)
  const periods: ReportPeriod[] = []
  for (let idx = currentIdx; idx <= maxIdx; idx++) {
    periods.push({
      month: (idx % 12) + 1,
      year: Math.floor(idx / 12),
    })
  }

  if (targetIdx - currentIdx > MAX_CASCADE_INVOICE_MONTHS) {
    periods.push({ month: safeTargetMonth, year: safeTargetYear })
  }

  return periods
}

/**
 * Une e deduplica os períodos de faturas exigidos para múltiplos alvos
 * (ex.: mês geral do relatório e mês independente do calendário financeiro).
 */
export function getMergedRequiredInvoicePeriods(
  currentMonth: number,
  currentYear: number,
  targetPeriods: ReportPeriod[],
): ReportPeriod[] {
  const map = new Map<string, ReportPeriod>()
  targetPeriods.forEach((target) => {
    getRequiredInvoicePeriods(currentMonth, currentYear, target).forEach((p) => {
      const key = `${p.year}-${p.month}`
      if (!map.has(key)) {
        map.set(key, p)
      }
    })
  })
  return [...map.values()].sort(
    (a, b) => a.year * 12 + (a.month - 1) - (b.year * 12 + (b.month - 1)),
  )
}

/**
 * Combina alvos (cartão × período) com os respectivos dados retornados pela API de faturas.
 */
export function buildProjectionInvoiceList(
  targets: { card: CreditCard; month: number; year: number }[],
  invoicesData: (CreditCardInvoice | undefined)[],
) {
  return targets.map((target, idx) => {
    const data = invoicesData[idx]
    return {
      card: target.card,
      invoice: data || ({} as CreditCardInvoice),
      month: data?.month ?? target.month,
      year: data?.year ?? target.year,
    }
  })
}

function useProjectionInvoices(
  cardList: CreditCard[],
  filters: ReportFiltersState,
  currentMonth: number,
  currentYear: number,
  calendarPeriod?: ReportPeriod,
) {
  const cardListForProjection = useMemo(
    () =>
      cardList.filter((c) => {
        if (filters.hideCreditCards || filters.creditCardId === 'none') return false
        if (filters.creditCardId && c.id !== filters.creditCardId) return false
        return true
      }),
    [cardList, filters.hideCreditCards, filters.creditCardId],
  )

  const effectiveCalendarPeriod = calendarPeriod ?? filters.period

  const targets = useMemo(() => {
    const periods = getMergedRequiredInvoicePeriods(currentMonth, currentYear, [
      filters.period,
      effectiveCalendarPeriod,
    ])
    return cardListForProjection.flatMap((card) =>
      periods.map((p) => ({ card, month: p.month, year: p.year })),
    )
  }, [
    cardListForProjection,
    currentMonth,
    currentYear,
    filters.period.month,
    filters.period.year,
    effectiveCalendarPeriod.month,
    effectiveCalendarPeriod.year,
  ])

  const queries = useQueries({
    queries: targets.map((target) => ({
      queryKey: ['credit-cards', target.card.id, 'invoice', target.month, target.year],
      queryFn: () =>
        api
          .get<CreditCardInvoice>(`/credit-cards/${target.card.id}/invoice`, {
            params: { month: target.month, year: target.year },
          })
          .then((r) => r.data),
    })),
  })

  const invoiceLoading = queries.some((q) => q.isLoading)
  const invoiceStamp = queries
    .map((q) => `${q.dataUpdatedAt}:${q.isSuccess}`)
    .join(',')

  const invoiceList = useMemo(
    () =>
      buildProjectionInvoiceList(
        targets,
        queries.map((q) => q.data),
      ),
    [targets, invoiceStamp],
  )

  return { invoiceLoading, invoiceList, invoiceStamp }
}

// ----------------------------------------------------------------------
// HOOK 1: RELATÓRIO ESTRITAMENTE INDIVIDUAL DO USUÁRIO LOGADO
// ----------------------------------------------------------------------

export function useIndividualReportsData(
  filters: ReportFiltersState,
  _threshold?: number,
  calculationWindow: 6 | 12 = 6,
  simulations: SimulatedTransaction[] = [],
  calendarPeriod?: ReportPeriod,
) {
  const { user } = useAuth()
  const accountsQuery = useAccounts()
  const creditCardsQuery = useCreditCards()
  const categories = useAllCategories().data ?? []
  const debtsSummary = useUserDebtsSummary(filters.period.month, filters.period.year)

  // Todas as contas próprias do usuário
  const allOwnAccounts = useMemo(
    () => (accountsQuery.data ?? []).filter((a) => Boolean(user?.id) && a.ownerId === user?.id),
    [accountsQuery.data, user?.id],
  )

  // Separação em Operacionais (dia a dia), Reserva de emergência e Investimentos
  const operationalAccounts = useMemo(
    () => allOwnAccounts.filter((a) => a.type === 'CHECKING' || a.type === 'WALLET'),
    [allOwnAccounts],
  )
  const savingsAccounts = useMemo(
    () => allOwnAccounts.filter((a) => a.type === 'SAVINGS'),
    [allOwnAccounts],
  )
  const investmentAccounts = useMemo(
    () => allOwnAccounts.filter((a) => a.type === 'INVESTMENTS'),
    [allOwnAccounts],
  )

  const operationalAccountIds = useMemo(
    () => new Set(operationalAccounts.map((a) => a.id)),
    [operationalAccounts],
  )
  const allOwnAccountIds = useMemo(
    () => new Set(allOwnAccounts.map((a) => a.id)),
    [allOwnAccounts],
  )

  const cardList = useMemo(
    () => (creditCardsQuery.data ?? []).filter((c) => Boolean(user?.id) && c.ownerId === user?.id),
    [creditCardsQuery.data, user?.id],
  )

  // 1. Transações de todas as contas próprias (para rastrear transferências e histórico completo)
  const accountQueries = useQueries({
    queries: allOwnAccounts.map((a) => ({
      queryKey: ['transactions', 'account', a.id, 'all'],
      queryFn: () => api.get<Transaction[]>(`/transactions/account/${a.id}`).then((r) => r.data),
    })),
  })

  // 2. Transações dos cartões próprios
  const cardTxQueries = useQueries({
    queries: cardList.map((c) => ({
      queryKey: ['transactions', 'card', c.id, 'all'],
      queryFn: () => api.get<Transaction[]>(`/transactions/card/${c.id}`).then((r) => r.data),
    })),
  })

  // 3. Transações sob responsabilidade do usuário (inclui compras feitas em cartões compartilhados de terceiros)
  const responsibleQuery = useQueries({
    queries: [
      {
        queryKey: ['transactions', 'responsible', 'me', 'all'],
        queryFn: () => api.get<Transaction[]>('/transactions/responsible/me').then((r) => r.data),
      },
    ],
  })

  const now = useMemo(() => new Date(), [])
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const effectiveCalendarPeriod = calendarPeriod ?? filters.period

  // 4. Faturas de todos os meses da cascata (mês corrente até relatório geral / calendário)
  const { invoiceLoading, invoiceList, invoiceStamp } = useProjectionInvoices(
    cardList,
    filters,
    currentMonth,
    currentYear,
    effectiveCalendarPeriod,
  )

  const loading =
    accountsQuery.isLoading ||
    creditCardsQuery.isLoading ||
    accountQueries.some((q) => q.isLoading) ||
    cardTxQueries.some((q) => q.isLoading) ||
    responsibleQuery.some((q) => q.isLoading)

  const txStamp = accountQueries
    .concat(cardTxQueries)
    .concat(responsibleQuery)
    .map((q) => `${q.dataUpdatedAt}:${q.isSuccess}`)
    .join(',')

  // Unifica e deduplica transações brutas
  const allRawTransactions = useMemo(() => {
    const map = new Map<string, Transaction>()
    accountQueries.forEach((q) => q.data?.forEach((t) => map.set(t.id, t)))
    cardTxQueries.forEach((q) => q.data?.forEach((t) => map.set(t.id, t)))
    responsibleQuery.forEach((q) => q.data?.forEach((t) => map.set(t.id, t)))
    return [...map.values()]
  }, [accountQueries, cardTxQueries, responsibleQuery, txStamp])

  const ownCardIds = useMemo(() => new Set(cardList.map((c) => c.id)), [cardList])

  // Separação estrita de responsabilidade pessoal com isolamento de Reserva e Investimentos:
  const { personalTxs, thirdPartyOnMyCardTxs, myPurchasesOnOthersCards } = useMemo(() => {
    const personal: Transaction[] = []
    const thirdPartyOnMyCard: Transaction[] = []
    const myOnOthersCard: Transaction[] = []

    allRawTransactions.forEach((t) => {
      // Caso 1: Transação em cartão próprio do usuário
      if (t.creditCardId && ownCardIds.has(t.creditCardId)) {
        if (!t.responsibleId || (user?.id && t.responsibleId === user.id)) {
          personal.push(t)
        } else {
          thirdPartyOnMyCard.push(t)
        }
        return
      }

      // Caso 2: Transação em conta bancária (não cartão)
      if (!t.creditCardId) {
        // 2a. Transferência recebida em conta operacional própria (ex: acerto de dívida ou transferência de terceiros)
        if (
          t.type === 'TRANSFER' &&
          t.destinationAccountId &&
          operationalAccountIds.has(t.destinationAccountId)
        ) {
          personal.push(t)
          return
        }

        // 2b. Transação originada em conta própria do usuário
        if (allOwnAccountIds.has(t.accountId)) {
          if (!t.responsibleId || (user?.id && t.responsibleId === user.id)) {
            // Despesas ou receitas só entram nos relatórios se pertencerem a contas operacionais
            if (t.type === 'EXPENSE' || t.type === 'INCOME') {
              if (operationalAccountIds.has(t.accountId)) {
                personal.push(t)
              }
            } else if (t.type === 'TRANSFER') {
              // Transferências enviadas entram se envolverem conta operacional (origem ou destino),
              // permitindo que o calendário desconte da conta de origem no dia agendado
              if (
                operationalAccountIds.has(t.accountId) ||
                (t.destinationAccountId && operationalAccountIds.has(t.destinationAccountId))
              ) {
                personal.push(t)
              }
            }
          }
          return
        }
      }

      // Caso 3: Compras feitas pelo usuário em cartões de terceiros (via responsible/me)
      if (t.creditCardId && !ownCardIds.has(t.creditCardId) && user?.id && t.responsibleId === user.id) {
        personal.push(t)
        myOnOthersCard.push(t)
      }
    })

    return {
      personalTxs: personal,
      thirdPartyOnMyCardTxs: thirdPartyOnMyCard,
      myPurchasesOnOthersCards: myOnOthersCard,
    }
  }, [allRawTransactions, ownCardIds, allOwnAccountIds, operationalAccountIds, user?.id])

  const individualCatMap = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c]))
    addMissingTransactionCategories(map, personalTxs)
    return map
  }, [categories, personalTxs])

  const effectiveCategories = useMemo(() => [...individualCatMap.values()], [individualCatMap])

  // Aplica filtros globais do usuário
  const filteredPersonalTxs = useMemo(() => {
    return personalTxs.filter((t) => {
      if (filters.hideCreditCards && t.creditCardId) return false
      if (filters.creditCardId === 'none' && t.creditCardId) return false
      if (filters.creditCardId && filters.creditCardId !== 'none' && t.creditCardId !== filters.creditCardId) return false
      if (filters.accountId && t.accountId !== filters.accountId && t.destinationAccountId !== filters.accountId) return false
      if (
        !matchesCategoryFilters(
          t,
          { generalCategoryId: filters.generalCategoryId, specificCategoryId: filters.specificCategoryId },
          individualCatMap,
        )
      ) {
        return false
      }
      if (filters.status && t.status !== filters.status) return false
      return true
    })
  }, [personalTxs, filters, individualCatMap])

  const { month: selMonth, year: selYear } = filters.period
  const prevDate = new Date(selYear, selMonth - 2, 1)
  const prevMonth = prevDate.getMonth() + 1
  const prevYear = prevDate.getFullYear()

  const currentMonthTxs = useMemo(() => {
    return filteredPersonalTxs.filter((t) => {
      const p = parseDateParts(t.date)
      return p.year === selYear && p.month === selMonth
    })
  }, [filteredPersonalTxs, selMonth, selYear])

  const prevMonthTxs = useMemo(() => {
    return filteredPersonalTxs.filter((t) => {
      const p = parseDateParts(t.date)
      return p.year === prevYear && p.month === prevMonth
    })
  }, [filteredPersonalTxs, prevMonth, prevYear])

  const calendarAllTransactions = useMemo(
    () => [...personalTxs, ...thirdPartyOnMyCardTxs],
    [personalTxs, thirdPartyOnMyCardTxs],
  )

  // Projeção do mês geral do relatório (utilizada pelos KPIs executivos)
  const reportProjection = useMemo(() => {
    return buildCalendarProjection(
      operationalAccounts,
      filteredPersonalTxs,
      invoiceList,
      filters.period,
      filters.accountId,
      calendarAllTransactions,
      simulations,
      cardList,
      now,
    )
  }, [
    operationalAccounts,
    cardList,
    invoiceList,
    filteredPersonalTxs,
    calendarAllTransactions,
    filters.period,
    filters.accountId,
    invoiceStamp,
    txStamp,
    simulations,
    now,
  ])

  const isSameCalendarPeriod =
    effectiveCalendarPeriod.month === filters.period.month &&
    effectiveCalendarPeriod.year === filters.period.year

  // Projeção do Calendário Financeiro Individual (independente do mês geral quando navegado no calendário)
  const projection = useMemo(() => {
    if (isSameCalendarPeriod) return reportProjection
    return buildCalendarProjection(
      operationalAccounts,
      filteredPersonalTxs,
      invoiceList,
      effectiveCalendarPeriod,
      filters.accountId,
      calendarAllTransactions,
      simulations,
      cardList,
      now,
    )
  }, [
    isSameCalendarPeriod,
    reportProjection,
    operationalAccounts,
    cardList,
    invoiceList,
    filteredPersonalTxs,
    calendarAllTransactions,
    effectiveCalendarPeriod,
    filters.accountId,
    invoiceStamp,
    txStamp,
    simulations,
    now,
  ])

  const hasCardsIncluded = !filters.hideCreditCards && filters.creditCardId !== 'none'

  const kpis = useMemo(
    () => buildKpis(currentMonthTxs, reportProjection, filters.period, hasCardsIncluded),
    [currentMonthTxs, reportProjection, filters.period, hasCardsIncluded],
  )
  const cashFlowHistory = useMemo(
    () => buildCashFlowHistory(filteredPersonalTxs, filters.period, hasCardsIncluded),
    [filteredPersonalTxs, filters.period, hasCardsIncluded],
  )
  const categoryEvolution = useMemo(
    () => buildCategoryEvolution(currentMonthTxs, prevMonthTxs, effectiveCategories, hasCardsIncluded),
    [currentMonthTxs, prevMonthTxs, effectiveCategories, hasCardsIncluded],
  )
  const futureCommitments = useMemo(
    () => buildFutureCommitments(personalTxs, cardList, filters.period, filters.hideCreditCards),
    [personalTxs, cardList, filters.period, filters.hideCreditCards],
  )
  const spendingHabits = useMemo(
    () => buildSpendingHabits(currentMonthTxs, prevMonthTxs, filters.period, hasCardsIncluded),
    [currentMonthTxs, prevMonthTxs, filters.period, hasCardsIncluded],
  )

  const financialPlanning = useMemo(
    () =>
      calculateFinancialPlanning(
        personalTxs,
        cardList,
        operationalAccounts,
        savingsAccounts,
        investmentAccounts,
        filters.period,
        calculationWindow,
      ),
    [
      personalTxs,
      cardList,
      operationalAccounts,
      savingsAccounts,
      investmentAccounts,
      filters.period,
      calculationWindow,
    ],
  )

  // Balanço Compartilhado (Bloco 6)
  const sharedGroupBalance: SharedGroupBalance = useMemo(() => {
    const myOnOthers = myPurchasesOnOthersCards
      .filter((t) => {
        const p = parseDateParts(t.date)
        return p.year === selYear && p.month === selMonth && t.type === 'EXPENSE'
      })
      .reduce((s, t) => s + t.amount, 0)

    const othersOnMine = thirdPartyOnMyCardTxs
      .filter((t) => {
        const p = parseDateParts(t.date)
        return p.year === selYear && p.month === selMonth && t.type === 'EXPENSE'
      })
      .reduce((s, t) => s + t.amount, 0)

    return {
      spentByMeOnSharedCards: myOnOthers,
      spentByOthersOnMyCards: othersOnMine,
      totalOwedByMe: debtsSummary.data?.totalOwedCurrentMonth ?? 0,
      totalReceivableByMe: debtsSummary.data?.totalReceivableCurrentMonth ?? 0,
      groups: debtsSummary.data?.groups ?? [],
    }
  }, [myPurchasesOnOthersCards, thirdPartyOnMyCardTxs, debtsSummary.data, selMonth, selYear])

  return {
    loading,
    calendarLoading: invoiceLoading,
    accounts: operationalAccounts,
    allAccounts: allOwnAccounts,
    savingsAccounts,
    investmentAccounts,
    financialPlanning,
    creditCards: cardList,
    categories: effectiveCategories,
    projection,
    kpis,
    cashFlowHistory,
    categoryEvolution,
    futureCommitments,
    spendingHabits,
    sharedGroupBalance,
  }
}

// ----------------------------------------------------------------------
// HOOK 2: RELATÓRIO COMPLETO DE UM GRUPO ESPECÍFICO
// ----------------------------------------------------------------------

export function useGroupReportsData(
  groupId: string,
  filters: ReportFiltersState,
  _threshold?: number,
  calculationWindow: 6 | 12 = 6,
  simulations: SimulatedTransaction[] = [],
  calendarPeriod?: ReportPeriod,
) {
  const groupQuery = useGroup(groupId)
  const groupAccountsQuery = useGroupAccounts(groupId)
  const groupCardsQuery = useGroupCreditCards(groupId)
  const groupCategoriesQuery = useGroupCategories(groupId)
  const groupUsedCategoriesQuery = useGroupUsedCategories(groupId)
  const groupDebtsQuery = useGroupDebts(groupId)

  const group = groupQuery.data
  const members = useMemo(() => group?.members ?? [], [group?.members])

  // Normaliza GroupAccount para Account (tratando contas conjuntas com owner nulo)
  const allGroupAccounts: Account[] = useMemo(
    () => (groupAccountsQuery.data ?? []).map(normalizeGroupAccount),
    [groupAccountsQuery.data],
  )

  // Separação em Operacionais, Reserva de emergência e Investimentos no grupo
  const operationalAccounts = useMemo(
    () => allGroupAccounts.filter((a) => a.type === 'CHECKING' || a.type === 'WALLET'),
    [allGroupAccounts],
  )
  const savingsAccounts = useMemo(
    () => allGroupAccounts.filter((a) => a.type === 'SAVINGS'),
    [allGroupAccounts],
  )
  const investmentAccounts = useMemo(
    () => allGroupAccounts.filter((a) => a.type === 'INVESTMENTS'),
    [allGroupAccounts],
  )

  const operationalGroupAccountIds = useMemo(
    () => new Set(operationalAccounts.map((a) => a.id)),
    [operationalAccounts],
  )

  const cardList: CreditCard[] = useMemo(() => groupCardsQuery.data ?? [], [groupCardsQuery.data])
  const categories: Category[] = useMemo(() => {
    const map = new Map<string, Category>()
    ;(groupCategoriesQuery.data ?? []).forEach((c) => map.set(c.id, c))
    ;(groupUsedCategoriesQuery.data ?? []).forEach((uc) => {
      if (uc.parent && !map.has(uc.parent.id)) {
        map.set(
          uc.parent.id,
          synthesizeGeneralCategory(uc.parent, {
            userId: uc.ownerId,
            groupId: uc.isPersonal ? null : groupId,
          }),
        )
      }
      if (!map.has(uc.id)) {
        map.set(uc.id, {
          id: uc.id,
          name: uc.name,
          description: null,
          userId: uc.ownerId,
          groupId: uc.isPersonal ? null : groupId,
          type: uc.type ?? 'EXPENSE',
          level: uc.level ?? (uc.parentId || uc.parent ? 'SPECIFIC' : 'GENERAL'),
          parentId: uc.parentId ?? uc.parent?.id ?? null,
          parent: uc.parent ?? null,
          color: uc.color,
          icon: uc.icon,
          createdAt: '',
          updatedAt: '',
        })
      }
    })
    return [...map.values()]
  }, [groupCategoriesQuery.data, groupUsedCategoriesQuery.data, groupId])

  // 1. Transações de todas as contas do grupo
  const accountQueries = useQueries({
    queries: allGroupAccounts.map((a) => ({
      queryKey: ['transactions', 'account', a.id, 'all'],
      queryFn: () => api.get<Transaction[]>(`/transactions/account/${a.id}`).then((r) => r.data),
    })),
  })

  // 2. Transações de todos os cartões do grupo
  const cardTxQueries = useQueries({
    queries: cardList.map((c) => ({
      queryKey: ['transactions', 'card', c.id, 'all'],
      queryFn: () => api.get<Transaction[]>(`/transactions/card/${c.id}`).then((r) => r.data),
    })),
  })

  const now = useMemo(() => new Date(), [])
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const effectiveCalendarPeriod = calendarPeriod ?? filters.period

  // 3. Faturas dos cartões do grupo para toda a cascata (relatório geral e calendário)
  const { invoiceLoading, invoiceList, invoiceStamp } = useProjectionInvoices(
    cardList,
    filters,
    currentMonth,
    currentYear,
    effectiveCalendarPeriod,
  )

  const loading =
    groupQuery.isLoading ||
    groupAccountsQuery.isLoading ||
    groupCardsQuery.isLoading ||
    groupCategoriesQuery.isLoading ||
    accountQueries.some((q) => q.isLoading) ||
    cardTxQueries.some((q) => q.isLoading)

  const txStamp = accountQueries
    .concat(cardTxQueries)
    .map((q) => `${q.dataUpdatedAt}:${q.isSuccess}`)
    .join(',')

  // Unifica e deduplica todas as transações do grupo
  const allGroupTransactions = useMemo(() => {
    const map = new Map<string, Transaction>()
    accountQueries.forEach((q) => q.data?.forEach((t) => map.set(t.id, t)))
    cardTxQueries.forEach((q) => q.data?.forEach((t) => map.set(t.id, t)))
    return [...map.values()]
  }, [accountQueries, cardTxQueries, txStamp])

  // Transações operacionais do grupo (exclui despesas/receitas de contas SAVINGS e INVESTMENTS)
  const operationalGroupTransactions = useMemo(() => {
    return allGroupTransactions.filter((t) => {
      if (t.creditCardId) return true
      if (t.type === 'EXPENSE' || t.type === 'INCOME') {
        return operationalGroupAccountIds.has(t.accountId)
      }
      if (t.type === 'TRANSFER') {
        const originOp = operationalGroupAccountIds.has(t.accountId)
        const destOp = t.destinationAccountId && operationalGroupAccountIds.has(t.destinationAccountId)
        return Boolean(originOp || destOp)
      }
      return false
    })
  }, [allGroupTransactions, operationalGroupAccountIds])

  const groupCatMap = useMemo(() => {
    const map = new Map<string, Category>(categories.map((c) => [c.id, c]))
    addMissingTransactionCategories(map, allGroupTransactions)
    return map
  }, [categories, allGroupTransactions])

  const effectiveGroupCategories = useMemo(() => [...groupCatMap.values()], [groupCatMap])

  // Aplica filtros no contexto do grupo com base nas transações operacionais
  const filteredGroupTxs = useMemo(() => {
    return operationalGroupTransactions.filter((t) => {
      if (filters.hideCreditCards && t.creditCardId) return false
      if (filters.creditCardId === 'none' && t.creditCardId) return false
      if (filters.creditCardId && filters.creditCardId !== 'none' && t.creditCardId !== filters.creditCardId) return false
      if (filters.accountId && t.accountId !== filters.accountId && t.destinationAccountId !== filters.accountId) return false
      if (
        !matchesCategoryFilters(
          t,
          { generalCategoryId: filters.generalCategoryId, specificCategoryId: filters.specificCategoryId },
          groupCatMap,
        )
      ) {
        return false
      }
      if (filters.status && t.status !== filters.status) return false
      if (filters.responsibleId && t.responsibleId !== filters.responsibleId) return false
      return true
    })
  }, [operationalGroupTransactions, filters, groupCatMap])

  const { month: selMonth, year: selYear } = filters.period
  const prevDate = new Date(selYear, selMonth - 2, 1)
  const prevMonth = prevDate.getMonth() + 1
  const prevYear = prevDate.getFullYear()

  const currentMonthTxs = useMemo(() => {
    return filteredGroupTxs.filter((t) => {
      const p = parseDateParts(t.date)
      return p.year === selYear && p.month === selMonth
    })
  }, [filteredGroupTxs, selMonth, selYear])

  const prevMonthTxs = useMemo(() => {
    return filteredGroupTxs.filter((t) => {
      const p = parseDateParts(t.date)
      return p.year === prevYear && p.month === prevMonth
    })
  }, [filteredGroupTxs, prevMonth, prevYear])

  // Projeção do mês geral do grupo (utilizada pelos KPIs executivos)
  const reportProjection = useMemo(() => {
    return buildCalendarProjection(
      operationalAccounts,
      filteredGroupTxs,
      invoiceList,
      filters.period,
      filters.accountId,
      operationalGroupTransactions,
      simulations,
      cardList,
      now,
    )
  }, [
    operationalAccounts,
    cardList,
    invoiceList,
    filteredGroupTxs,
    operationalGroupTransactions,
    filters.period,
    filters.accountId,
    invoiceStamp,
    txStamp,
    simulations,
    now,
  ])

  const isSameCalendarPeriod =
    effectiveCalendarPeriod.month === filters.period.month &&
    effectiveCalendarPeriod.year === filters.period.year

  // Projeção do Calendário Financeiro do Grupo (independente do mês geral quando navegado no calendário)
  const projection = useMemo(() => {
    if (isSameCalendarPeriod) return reportProjection
    return buildCalendarProjection(
      operationalAccounts,
      filteredGroupTxs,
      invoiceList,
      effectiveCalendarPeriod,
      filters.accountId,
      operationalGroupTransactions,
      simulations,
      cardList,
      now,
    )
  }, [
    isSameCalendarPeriod,
    reportProjection,
    operationalAccounts,
    cardList,
    invoiceList,
    filteredGroupTxs,
    operationalGroupTransactions,
    effectiveCalendarPeriod,
    filters.accountId,
    invoiceStamp,
    txStamp,
    simulations,
    now,
  ])

  const hasCardsIncluded = !filters.hideCreditCards && filters.creditCardId !== 'none'

  const kpis = useMemo(
    () => buildKpis(currentMonthTxs, reportProjection, filters.period, hasCardsIncluded),
    [currentMonthTxs, reportProjection, filters.period, hasCardsIncluded],
  )
  const cashFlowHistory = useMemo(
    () => buildCashFlowHistory(filteredGroupTxs, filters.period, hasCardsIncluded),
    [filteredGroupTxs, filters.period, hasCardsIncluded],
  )
  const categoryEvolution = useMemo(
    () => buildCategoryEvolution(currentMonthTxs, prevMonthTxs, effectiveGroupCategories, hasCardsIncluded),
    [currentMonthTxs, prevMonthTxs, effectiveGroupCategories, hasCardsIncluded],
  )
  const futureCommitments = useMemo(
    () => buildFutureCommitments(operationalGroupTransactions, cardList, filters.period, filters.hideCreditCards),
    [operationalGroupTransactions, cardList, filters.period, filters.hideCreditCards],
  )
  const spendingHabits = useMemo(
    () => buildSpendingHabits(currentMonthTxs, prevMonthTxs, filters.period, hasCardsIncluded),
    [currentMonthTxs, prevMonthTxs, filters.period, hasCardsIncluded],
  )

  const financialPlanning = useMemo(
    () =>
      calculateFinancialPlanning(
        operationalGroupTransactions,
        cardList,
        operationalAccounts,
        savingsAccounts,
        investmentAccounts,
        filters.period,
        calculationWindow,
      ),
    [
      operationalGroupTransactions,
      cardList,
      operationalAccounts,
      savingsAccounts,
      investmentAccounts,
      filters.period,
      calculationWindow,
    ],
  )

  // Distribuição de Despesas por Membro do Grupo
  const memberExpenses = useMemo(() => {
    return buildGroupMemberExpenses(operationalGroupTransactions, members, filters.period, hasCardsIncluded)
  }, [operationalGroupTransactions, members, filters.period, hasCardsIncluded])

  return {
    loading,
    calendarLoading: invoiceLoading,
    group,
    members,
    accounts: operationalAccounts,
    allAccounts: allGroupAccounts,
    savingsAccounts,
    investmentAccounts,
    financialPlanning,
    creditCards: cardList,
    categories: effectiveGroupCategories,
    projection,
    kpis,
    cashFlowHistory,
    categoryEvolution,
    futureCommitments,
    spendingHabits,
    memberExpenses,
    groupDebts: groupDebtsQuery.data as GroupDebtsResponse | undefined,
  }
}

// Alias para manter compatibilidade com chamadas existentes
export const useReportsData = useIndividualReportsData
