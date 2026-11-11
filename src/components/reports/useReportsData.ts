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
  useUserDebtsSummary,
} from '@/lib/hooks'
import { useAuth } from '@/lib/auth'
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
import { normalizeCategoryColor, PALETTE } from '@/lib/palette'
import type {
  CalendarProjection,
  CategoryComparison,
  CumulativeSpendingPoint,
  DayProjection,
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
      return raw ? JSON.parse(raw) : []
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

export const parseDateParts = (dateStr: string) => {
  const parts = dateStr.slice(0, 10).split('-')
  return {
    year: Number(parts[0]),
    month: Number(parts[1]),
    day: Number(parts[2]),
  }
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
  getMonthInvoices: (m: number, y: number) => {
    cardId: string
    cardName: string
    remainingAmount: number
    dueIso: string
    status?: string
  }[]
  effect: (t: Transaction) => number
  simEffect: (s: SimulatedTransaction) => number
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

  const simsByDay = new Map<string, SimulatedTransaction[]>()
  simulations.forEach((s) => {
    const p = parseDateParts(s.date)
    if (p.year === year && p.month === month) {
      const k = s.date.slice(0, 10)
      simsByDay.set(k, [...(simsByDay.get(k) ?? []), s])
    }
  })

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
): CalendarProjection {
  const accs = accounts.filter((a) => !accountIdFilter || a.id === accountIdFilter)
  const ids = new Set(accs.map((a) => a.id))

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

  const simEffect = (s: SimulatedTransaction) => {
    if (accountIdFilter && s.accountId && s.accountId !== accountIdFilter) return 0
    return s.type === 'INCOME' ? s.amount : -s.amount
  }

  const displaySource = transactions
  const accountSource = allTransactions || transactions

  const now = new Date()
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

      // 1. Procura na lista de faturas carregadas da API correspondente a este cartão e a este mês/ano
      const matched = invoices.find(
        (item) =>
          item.card.id === card.id &&
          ((item.month === m && item.year === y) ||
            (item.invoice?.month === m && item.invoice?.year === y)),
      )

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
        // Fallback analítico: somatório de compras do cartão que vencem nesta fatura
        const cardExpenses = accountSource
          .filter((t) => {
            if (t.creditCardId !== card.id || t.type !== 'EXPENSE') return false
            if (t.invoiceMonth != null && t.invoiceYear != null) {
              return t.invoiceMonth === m && t.invoiceYear === y
            }
            const p = parseDateParts(t.date)
            const closing = card.closingDay || 25
            let invM = p.month
            let invY = p.year
            if (p.day >= closing) {
              invM += 1
              if (invM > 12) {
                invM = 1
                invY += 1
              }
            }
            return invM === m && invY === y
          })
          .reduce((s, t) => s + t.amount, 0)

        const alreadyPaid = accountSource
          .filter((t) => {
            if (t.type !== 'EXPENSE' || !isInvoicePaymentTx(t)) return false
            if (
              t.creditCardInvoiceId &&
              matched?.invoice &&
              'id' in matched.invoice &&
              t.creditCardInvoiceId === (matched.invoice as { id?: string }).id
            ) {
              return true
            }
            return t.title.toLowerCase().includes(card.name.toLowerCase())
          })
          .reduce((s, t) => s + t.amount, 0)

        remaining = Math.max(0, cardExpenses - alreadyPaid)
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
      getMonthInvoices,
      effect,
      simEffect,
    })

    let cascadeSim = curMonthResult.closing
    let cascadeReal = curMonthResult.realClosing

    for (let idx = currentMonthIdx + 1; idx < targetMonthIdx; idx++) {
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
  Boolean(t.creditCardInvoiceId || t.title.startsWith('Pagamento fatura'))

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
  const currentCatMap = new Map<string, number>()
  let totalCurrentExpense = 0
  currentMonthTxs
    .filter((t) => t.type === 'EXPENSE' && (!hasCardsIncluded || !isInvoicePaymentTx(t)))
    .forEach((t) => {
      const key = t.categoryId || 'none'
      currentCatMap.set(key, (currentCatMap.get(key) ?? 0) + t.amount)
      totalCurrentExpense += t.amount
    })

  const prevCatMap = new Map<string, number>()
  prevMonthTxs
    .filter((t) => t.type === 'EXPENSE' && (!hasCardsIncluded || !isInvoicePaymentTx(t)))
    .forEach((t) => {
      const key = t.categoryId || 'none'
      prevCatMap.set(key, (prevCatMap.get(key) ?? 0) + t.amount)
    })

  const catInfoMap = new Map(categories.map((c) => [c.id, c]))
  const allCatKeys = new Set([...currentCatMap.keys(), ...prevCatMap.keys()])
  const comparisons: CategoryComparison[] = []

  let colorIdx = 0
  allCatKeys.forEach((key) => {
    const currentAmt = currentCatMap.get(key) ?? 0
    const prevAmt = prevCatMap.get(key) ?? 0
    if (currentAmt === 0 && prevAmt === 0) return

    let name = 'Sem categoria'
    let color: string = PALETTE[colorIdx % PALETTE.length]

    if (key !== 'none') {
      const cat = catInfoMap.get(key)
      if (cat) {
        name = cat.name
        color = normalizeCategoryColor(cat.color)
      }
    } else {
      color = '#8E8EA0'
    }

    colorIdx++
    const pctOfTotal = totalCurrentExpense > 0 ? Math.round((currentAmt / totalCurrentExpense) * 100) : 0
    const isNew = prevAmt === 0 && currentAmt > 0
    const momVariation = prevAmt > 0 ? Math.round(((currentAmt - prevAmt) / prevAmt) * 100) : null

    comparisons.push({
      id: key !== 'none' ? key : undefined,
      name,
      color,
      currentAmount: currentAmt,
      previousAmount: prevAmt,
      percentageOfTotal: pctOfTotal,
      momVariationPct: momVariation,
      isNew,
    })
  })

  return comparisons.sort((a, b) => b.currentAmount - a.currentAmount)
}

export function buildFutureCommitments(
  allTxs: Transaction[],
  cards: CreditCard[],
  period: ReportPeriod,
  hideCreditCards: boolean,
): FutureMonthCommitment[] {
  const cardClosingMap = new Map(cards.map((c) => [c.id, c.closingDay]))
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
          if (t.invoiceMonth != null && t.invoiceYear != null) {
            if (t.invoiceMonth === m && t.invoiceYear === y) {
              cardCommitted += t.amount
            }
          } else {
            const p = parseDateParts(t.date)
            const closingDay = (t.creditCardId && cardClosingMap.get(t.creditCardId)) || 25
            let invM = p.month
            let invY = p.year
            if (p.day >= closingDay) {
              invM += 1
              if (invM > 12) {
                invM = 1
                invY += 1
              }
            }
            if (invM === m && invY === y) {
              cardCommitted += t.amount
            }
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
  const cardClosingMap = new Map(cards.map((c) => [c.id, c.closingDay || 25]))

  // 1. Totais Guardados (Reserva e Investimentos somados separadamente)
  const totalSavings = savingsAccounts.reduce((sum, a) => sum + (a.balance ?? 0), 0)
  const totalInvestments = investmentAccounts.reduce((sum, a) => sum + (a.balance ?? 0), 0)

  // 2. Gastos Fixos: Despesas recorrentes contínuas (isInfinite === true)
  // de contas operacionais e cartões de crédito (ignorando pagamento de fatura)
  const fixedTxsInSelectedMonth = allTxs.filter((t) => {
    if (t.type !== 'EXPENSE' || !t.isInfinite || isInvoicePaymentTx(t)) return false
    if (t.creditCardId) {
      if (t.invoiceMonth != null && t.invoiceYear != null) {
        return t.invoiceMonth === period.month && t.invoiceYear === period.year
      }
      const p = parseDateParts(t.date)
      const closingDay = cardClosingMap.get(t.creditCardId) || 25
      let invM = p.month
      let invY = p.year
      if (p.day >= closingDay) {
        invM += 1
        if (invM > 12) {
          invM = 1
          invY += 1
        }
      }
      return invM === period.month && invY === period.year
    }
    if (operationalAccountIds.has(t.accountId)) {
      const p = parseDateParts(t.date)
      return p.month === period.month && p.year === period.year
    }
    return false
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
        if (t.creditCardId) {
          if (t.invoiceMonth != null && t.invoiceYear != null) {
            return t.invoiceMonth === m && t.invoiceYear === y
          }
          const p = parseDateParts(t.date)
          const closingDay = cardClosingMap.get(t.creditCardId) || 25
          let invM = p.month
          let invY = p.year
          if (p.day >= closingDay) {
            invM += 1
            if (invM > 12) {
              invM = 1
              invY += 1
            }
          }
          return invM === m && invY === y
        }
        if (operationalAccountIds.has(t.accountId)) {
          const p = parseDateParts(t.date)
          return p.month === m && p.year === y
        }
        return false
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
        if (t.creditCardId) {
          if (t.invoiceMonth != null && t.invoiceYear != null) {
            return t.invoiceMonth === period.month && t.invoiceYear === period.year
          }
          const p = parseDateParts(t.date)
          const closingDay = cardClosingMap.get(t.creditCardId) || 25
          let invM = p.month
          let invY = p.year
          if (p.day >= closingDay) {
            invM += 1
            if (invM > 12) {
              invM = 1
              invY += 1
            }
          }
          return invM === period.month && invY === period.year
        }
        if (operationalAccountIds.has(t.accountId)) {
          const p = parseDateParts(t.date)
          return p.month === period.month && p.year === period.year
        }
        return false
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

// ----------------------------------------------------------------------
// HOOK 1: RELATÓRIO ESTRITAMENTE INDIVIDUAL DO USUÁRIO LOGADO
// ----------------------------------------------------------------------

export function useIndividualReportsData(
  filters: ReportFiltersState,
  _threshold?: number,
  calculationWindow: 6 | 12 = 6,
  simulations: SimulatedTransaction[] = [],
) {
  const { user } = useAuth()
  const accountsQuery = useAccounts()
  const creditCardsQuery = useCreditCards()
  const categories = useAllCategories().data ?? []
  const debtsSummary = useUserDebtsSummary(filters.period.month, filters.period.year)

  // Todas as contas próprias do usuário
  const allOwnAccounts = useMemo(
    () => (accountsQuery.data ?? []).filter((a) => !user?.id || a.ownerId === user.id),
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
    () => (creditCardsQuery.data ?? []).filter((c) => !user?.id || c.ownerId === user.id),
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
  const isDifferentPeriod =
    filters.period.month !== currentMonth || filters.period.year !== currentYear

  // 4a. Faturas dos cartões próprios do mês selecionado no filtro
  const targetInvoiceQueries = useQueries({
    queries: cardList.map((c) => ({
      queryKey: ['credit-cards', c.id, 'invoice', filters.period.month, filters.period.year],
      queryFn: () =>
        api
          .get<CreditCardInvoice>(`/credit-cards/${c.id}/invoice`, { params: filters.period })
          .then((r) => r.data),
    })),
  })

  // 4b. Faturas dos cartões próprios do mês corrente (quando o período selecionado for diferente)
  const currentInvoiceQueries = useQueries({
    queries: isDifferentPeriod
      ? cardList.map((c) => ({
          queryKey: ['credit-cards', c.id, 'invoice', currentMonth, currentYear],
          queryFn: () =>
            api
              .get<CreditCardInvoice>(`/credit-cards/${c.id}/invoice`, {
                params: { month: currentMonth, year: currentYear },
              })
              .then((r) => r.data),
        }))
      : [],
  })

  const loading =
    accountsQuery.isLoading ||
    creditCardsQuery.isLoading ||
    accountQueries.some((q) => q.isLoading) ||
    cardTxQueries.some((q) => q.isLoading) ||
    responsibleQuery.some((q) => q.isLoading) ||
    targetInvoiceQueries.some((q) => q.isLoading) ||
    currentInvoiceQueries.some((q) => q.isLoading)

  const invoiceStamp = targetInvoiceQueries
    .concat(currentInvoiceQueries)
    .map((q) => `${q.dataUpdatedAt}:${q.isSuccess}`)
    .join(',')
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

  // Aplica filtros globais do usuário
  const filteredPersonalTxs = useMemo(() => {
    return personalTxs.filter((t) => {
      if (filters.hideCreditCards && t.creditCardId) return false
      if (filters.creditCardId === 'none' && t.creditCardId) return false
      if (filters.creditCardId && filters.creditCardId !== 'none' && t.creditCardId !== filters.creditCardId) return false
      if (filters.accountId && t.accountId !== filters.accountId && t.destinationAccountId !== filters.accountId) return false
      if (filters.categoryId === 'none' && t.categoryId) return false
      if (filters.categoryId && filters.categoryId !== 'none' && t.categoryId !== filters.categoryId) return false
      if (filters.status && t.status !== filters.status) return false
      return true
    })
  }, [personalTxs, filters])

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

  // Projeção do Calendário Financeiro Individual
  const projection = useMemo(() => {
    const cardListForProjection = cardList.filter((c) => {
      if (filters.hideCreditCards || filters.creditCardId === 'none') return false
      if (filters.creditCardId && c.id !== filters.creditCardId) return false
      return true
    })

    const invoiceList: {
      card: CreditCard
      invoice: Partial<CreditCardInvoice>
      month: number
      year: number
    }[] = []

    cardListForProjection.forEach((c) => {
      const targetIdx = cardList.findIndex((item) => item.id === c.id)
      const targetData = targetIdx >= 0 ? targetInvoiceQueries[targetIdx]?.data : undefined
      invoiceList.push({
        card: c,
        invoice: targetData || ({} as CreditCardInvoice),
        month: targetData?.month ?? filters.period.month,
        year: targetData?.year ?? filters.period.year,
      })

      if (isDifferentPeriod) {
        const curIdx = cardList.findIndex((item) => item.id === c.id)
        const curData = curIdx >= 0 ? currentInvoiceQueries[curIdx]?.data : undefined
        if (curData) {
          invoiceList.push({
            card: c,
            invoice: curData,
            month: curData.month ?? currentMonth,
            year: curData.year ?? currentYear,
          })
        }
      }
    })

    return buildCalendarProjection(
      operationalAccounts,
      filteredPersonalTxs,
      invoiceList,
      filters.period,
      filters.accountId,
      personalTxs,
      simulations,
    )
  }, [
    operationalAccounts,
    cardList,
    targetInvoiceQueries,
    currentInvoiceQueries,
    filteredPersonalTxs,
    personalTxs,
    filters.period,
    filters.accountId,
    filters.hideCreditCards,
    filters.creditCardId,
    invoiceStamp,
    txStamp,
    simulations,
    isDifferentPeriod,
    currentMonth,
    currentYear,
  ])

  const hasCardsIncluded = !filters.hideCreditCards && filters.creditCardId !== 'none'

  const kpis = useMemo(
    () => buildKpis(currentMonthTxs, projection, filters.period, hasCardsIncluded),
    [currentMonthTxs, projection, filters.period, hasCardsIncluded],
  )
  const cashFlowHistory = useMemo(
    () => buildCashFlowHistory(filteredPersonalTxs, filters.period, hasCardsIncluded),
    [filteredPersonalTxs, filters.period, hasCardsIncluded],
  )
  const categoryEvolution = useMemo(
    () => buildCategoryEvolution(currentMonthTxs, prevMonthTxs, categories, hasCardsIncluded),
    [currentMonthTxs, prevMonthTxs, categories, hasCardsIncluded],
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
    accounts: operationalAccounts,
    allAccounts: allOwnAccounts,
    savingsAccounts,
    investmentAccounts,
    financialPlanning,
    creditCards: cardList,
    categories,
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
) {
  const groupQuery = useGroup(groupId)
  const groupAccountsQuery = useGroupAccounts(groupId)
  const groupCardsQuery = useGroupCreditCards(groupId)
  const groupCategoriesQuery = useGroupCategories(groupId)
  const groupDebtsQuery = useGroupDebts(groupId)

  const group = groupQuery.data
  const members = useMemo(() => group?.members ?? [], [group?.members])

  // Normaliza GroupAccount para Account
  const allGroupAccounts: Account[] = useMemo(
    () =>
      (groupAccountsQuery.data ?? []).map((ga) => ({
        ...ga,
        ownerId: ga.owner.id,
        owner: ga.owner,
      })),
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
  const categories: Category[] = useMemo(() => groupCategoriesQuery.data ?? [], [groupCategoriesQuery.data])

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
  const isDifferentPeriod =
    filters.period.month !== currentMonth || filters.period.year !== currentYear

  // 3a. Faturas dos cartões do grupo para o mês selecionado
  const targetInvoiceQueries = useQueries({
    queries: cardList.map((c) => ({
      queryKey: ['credit-cards', c.id, 'invoice', filters.period.month, filters.period.year],
      queryFn: () =>
        api
          .get<CreditCardInvoice>(`/credit-cards/${c.id}/invoice`, { params: filters.period })
          .then((r) => r.data),
    })),
  })

  // 3b. Faturas dos cartões do grupo para o mês corrente (quando o período selecionado for diferente)
  const currentInvoiceQueries = useQueries({
    queries: isDifferentPeriod
      ? cardList.map((c) => ({
          queryKey: ['credit-cards', c.id, 'invoice', currentMonth, currentYear],
          queryFn: () =>
            api
              .get<CreditCardInvoice>(`/credit-cards/${c.id}/invoice`, {
                params: { month: currentMonth, year: currentYear },
              })
              .then((r) => r.data),
        }))
      : [],
  })

  const loading =
    groupQuery.isLoading ||
    groupAccountsQuery.isLoading ||
    groupCardsQuery.isLoading ||
    groupCategoriesQuery.isLoading ||
    accountQueries.some((q) => q.isLoading) ||
    cardTxQueries.some((q) => q.isLoading) ||
    targetInvoiceQueries.some((q) => q.isLoading) ||
    currentInvoiceQueries.some((q) => q.isLoading)

  const invoiceStamp = targetInvoiceQueries
    .concat(currentInvoiceQueries)
    .map((q) => `${q.dataUpdatedAt}:${q.isSuccess}`)
    .join(',')
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

  // Aplica filtros no contexto do grupo com base nas transações operacionais
  const filteredGroupTxs = useMemo(() => {
    return operationalGroupTransactions.filter((t) => {
      if (filters.hideCreditCards && t.creditCardId) return false
      if (filters.creditCardId === 'none' && t.creditCardId) return false
      if (filters.creditCardId && filters.creditCardId !== 'none' && t.creditCardId !== filters.creditCardId) return false
      if (filters.accountId && t.accountId !== filters.accountId && t.destinationAccountId !== filters.accountId) return false
      if (filters.categoryId === 'none' && t.categoryId) return false
      if (filters.categoryId && filters.categoryId !== 'none' && t.categoryId !== filters.categoryId) return false
      if (filters.status && t.status !== filters.status) return false
      if (filters.responsibleId && t.responsibleId !== filters.responsibleId) return false
      return true
    })
  }, [operationalGroupTransactions, filters])

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

  // Projeção do Calendário Financeiro do Grupo (apenas contas operacionais)
  const projection = useMemo(() => {
    const cardListForProjection = cardList.filter((c) => {
      if (filters.hideCreditCards || filters.creditCardId === 'none') return false
      if (filters.creditCardId && c.id !== filters.creditCardId) return false
      return true
    })

    const invoiceList: {
      card: CreditCard
      invoice: Partial<CreditCardInvoice>
      month: number
      year: number
    }[] = []

    cardListForProjection.forEach((c) => {
      const targetIdx = cardList.findIndex((item) => item.id === c.id)
      const targetData = targetIdx >= 0 ? targetInvoiceQueries[targetIdx]?.data : undefined
      invoiceList.push({
        card: c,
        invoice: targetData || ({} as CreditCardInvoice),
        month: targetData?.month ?? filters.period.month,
        year: targetData?.year ?? filters.period.year,
      })

      if (isDifferentPeriod) {
        const curIdx = cardList.findIndex((item) => item.id === c.id)
        const curData = curIdx >= 0 ? currentInvoiceQueries[curIdx]?.data : undefined
        if (curData) {
          invoiceList.push({
            card: c,
            invoice: curData,
            month: curData.month ?? currentMonth,
            year: curData.year ?? currentYear,
          })
        }
      }
    })

    return buildCalendarProjection(
      operationalAccounts,
      filteredGroupTxs,
      invoiceList,
      filters.period,
      filters.accountId,
      operationalGroupTransactions,
      simulations,
    )
  }, [
    operationalAccounts,
    cardList,
    targetInvoiceQueries,
    currentInvoiceQueries,
    filteredGroupTxs,
    operationalGroupTransactions,
    filters.period,
    filters.accountId,
    filters.hideCreditCards,
    filters.creditCardId,
    invoiceStamp,
    txStamp,
    simulations,
    isDifferentPeriod,
    currentMonth,
    currentYear,
  ])

  const hasCardsIncluded = !filters.hideCreditCards && filters.creditCardId !== 'none'

  const kpis = useMemo(
    () => buildKpis(currentMonthTxs, projection, filters.period, hasCardsIncluded),
    [currentMonthTxs, projection, filters.period, hasCardsIncluded],
  )
  const cashFlowHistory = useMemo(
    () => buildCashFlowHistory(filteredGroupTxs, filters.period, hasCardsIncluded),
    [filteredGroupTxs, filters.period, hasCardsIncluded],
  )
  const categoryEvolution = useMemo(
    () => buildCategoryEvolution(currentMonthTxs, prevMonthTxs, categories, hasCardsIncluded),
    [currentMonthTxs, prevMonthTxs, categories, hasCardsIncluded],
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
    group,
    members,
    accounts: operationalAccounts,
    allAccounts: allGroupAccounts,
    savingsAccounts,
    investmentAccounts,
    financialPlanning,
    creditCards: cardList,
    categories,
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
