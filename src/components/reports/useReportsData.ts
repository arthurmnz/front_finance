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
  CategoryComparison,
  CumulativeSpendingPoint,
  FinancialPlanningData,
  FutureMonthCommitment,
  GroupMemberExpense,
  KpiData,
  MonthlyCashFlow,
  ReportFiltersState,
  ReportPeriod,
  SharedGroupBalance,
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

export function buildCalendarProjection(
  accounts: Account[],
  transactions: Transaction[],
  invoices: { card: CreditCard; invoice: Partial<CreditCardInvoice> }[],
  period: ReportPeriod,
  accountIdFilter?: string,
  allTransactions?: Transaction[],
) {
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

  const firstIso = toISODate(new Date(period.year, period.month - 1, 1))
  const daysInMonth = new Date(period.year, period.month, 0).getDate()
  const relevant = transactions.filter((t) => effect(t) !== 0)

  let running =
    accs.reduce((s, a) => s + (a.startBalance ?? 0), 0) +
    relevant.filter((t) => t.date.slice(0, 10) < firstIso).reduce((s, t) => s + effect(t), 0)
  const opening = running

  const byDay = new Map<string, Transaction[]>()
  relevant.forEach((t) => {
    const k = t.date.slice(0, 10)
    if (k >= firstIso) {
      byDay.set(k, [...(byDay.get(k) ?? []), t])
    }
  })

  const invoicesByDay = new Map<string, { cardId: string; cardName: string; remainingAmount: number }[]>()
  const txSource = allTransactions || transactions

  invoices.forEach(({ card, invoice }) => {
    // Se o usuário filtrou por uma conta bancária específica, só projeta faturas associadas a ela
    if (accountIdFilter && card.accountId && card.accountId !== accountIdFilter) return

    // 1. Apuração do montante a ser debitado na fatura
    let remaining = 0
    if (invoice?.remainingAmount != null && invoice.remainingAmount > 0) {
      remaining = invoice.remainingAmount
    } else if (invoice?.totalAmount != null) {
      remaining = Math.max(0, invoice.totalAmount - (invoice.paidAmount ?? 0))
    } else if (
      card.currentInvoiceAmount != null &&
      period.month === card.currentInvoiceMonth &&
      period.year === card.currentInvoiceYear
    ) {
      remaining = Math.max(0, card.currentInvoiceAmount)
    } else {
      // Fallback analítico: somatório de compras do cartão que vencem nesta fatura
      const cardExpenses = txSource
        .filter((t) => {
          if (t.creditCardId !== card.id || t.type !== 'EXPENSE') return false
          if (t.invoiceMonth != null && t.invoiceYear != null) {
            return t.invoiceMonth === period.month && t.invoiceYear === period.year
          }
          const p = parseDateParts(t.date)
          const closing = card.closingDay || 25
          let m = p.month
          let y = p.year
          if (p.day >= closing) {
            m += 1
            if (m > 12) {
              m = 1
              y += 1
            }
          }
          return m === period.month && y === period.year
        })
        .reduce((s, t) => s + t.amount, 0)

      const alreadyPaid = txSource
        .filter((t) => {
          if (t.type !== 'EXPENSE' || !isInvoicePaymentTx(t)) return false
          if (t.creditCardInvoiceId && invoice?.creditCardId && t.creditCardInvoiceId === invoice.creditCardId) return true
          return t.title.toLowerCase().includes(card.name.toLowerCase())
        })
        .reduce((s, t) => s + t.amount, 0)

      remaining = Math.max(0, cardExpenses - alreadyPaid)
    }

    if (remaining <= 0) return

    // 2. Apuração da data de vencimento no mês corrente
    let dueIso: string
    if (invoice?.dueDate) {
      const rawIso = invoice.dueDate.slice(0, 10)
      const p = parseDateParts(rawIso)
      if (p.year === period.year && p.month === period.month) {
        dueIso = rawIso
      } else {
        const safeDay = Math.min(Math.max(1, card.dueDay || p.day || 10), daysInMonth)
        dueIso = toISODate(new Date(period.year, period.month - 1, safeDay))
      }
    } else {
      const safeDay = Math.min(Math.max(1, card.dueDay || 10), daysInMonth)
      dueIso = toISODate(new Date(period.year, period.month - 1, safeDay))
    }

    invoicesByDay.set(dueIso, [
      ...(invoicesByDay.get(dueIso) ?? []),
      { cardId: card.id, cardName: card.name, remainingAmount: remaining },
    ])
  })

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const date = toISODate(new Date(period.year, period.month - 1, i + 1))
    const txs = byDay.get(date) ?? []
    const dayInvoices = invoicesByDay.get(date) ?? []
    const invoiceDelta = dayInvoices.reduce((s, inv) => s - inv.remainingAmount, 0)
    const delta = txs.reduce((s, t) => s + effect(t), 0) + invoiceDelta
    running += delta
    return { day: i + 1, date, txs, invoices: dayInvoices, delta, balance: running }
  })

  const min = days.reduce(
    (m, d) => (d.balance < m.balance ? d : m),
    days[0] || { balance: 0, day: 1, date: '', txs: [], invoices: [], delta: 0 },
  )
  const firstNegative = days.find((d) => d.balance < 0)

  return { days, opening, closing: running, min, firstNegative }
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

  // 4. Faturas dos cartões próprios do mês selecionado
  const invoiceQueries = useQueries({
    queries: cardList.map((c) => ({
      queryKey: ['credit-cards', c.id, 'invoice', filters.period.month, filters.period.year],
      queryFn: () =>
        api
          .get<CreditCardInvoice>(`/credit-cards/${c.id}/invoice`, { params: filters.period })
          .then((r) => r.data),
    })),
  })

  const loading =
    accountsQuery.isLoading ||
    creditCardsQuery.isLoading ||
    accountQueries.some((q) => q.isLoading) ||
    cardTxQueries.some((q) => q.isLoading) ||
    responsibleQuery.some((q) => q.isLoading) ||
    invoiceQueries.some((q) => q.isLoading)

  const invoiceStamp = invoiceQueries.map((q) => `${q.dataUpdatedAt}:${q.isSuccess}`).join(',')
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

      // Caso 2: Transação em conta própria do usuário
      if (allOwnAccountIds.has(t.accountId) && !t.creditCardId) {
        if (!t.responsibleId || (user?.id && t.responsibleId === user.id)) {
          // Despesas ou receitas só entram nos relatórios se pertencerem a contas operacionais
          if (t.type === 'EXPENSE' || t.type === 'INCOME') {
            if (operationalAccountIds.has(t.accountId)) {
              personal.push(t)
            }
          } else if (t.type === 'TRANSFER') {
            // Transferências entram se envolverem conta operacional (origem ou destino),
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

    const invoiceList = cardListForProjection.map((c) => {
      const idx = cardList.findIndex((item) => item.id === c.id)
      return {
        card: c,
        invoice: (idx >= 0 ? invoiceQueries[idx]?.data : undefined) || ({} as CreditCardInvoice),
      }
    })

    return buildCalendarProjection(
      operationalAccounts,
      filteredPersonalTxs,
      invoiceList,
      filters.period,
      filters.accountId,
      personalTxs,
    )
  }, [
    operationalAccounts,
    cardList,
    invoiceQueries,
    filteredPersonalTxs,
    personalTxs,
    filters.period,
    filters.accountId,
    filters.hideCreditCards,
    filters.creditCardId,
    invoiceStamp,
    txStamp,
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

  // 3. Faturas dos cartões do grupo para o mês selecionado
  const invoiceQueries = useQueries({
    queries: cardList.map((c) => ({
      queryKey: ['credit-cards', c.id, 'invoice', filters.period.month, filters.period.year],
      queryFn: () =>
        api
          .get<CreditCardInvoice>(`/credit-cards/${c.id}/invoice`, { params: filters.period })
          .then((r) => r.data),
    })),
  })

  const loading =
    groupQuery.isLoading ||
    groupAccountsQuery.isLoading ||
    groupCardsQuery.isLoading ||
    groupCategoriesQuery.isLoading ||
    accountQueries.some((q) => q.isLoading) ||
    cardTxQueries.some((q) => q.isLoading) ||
    invoiceQueries.some((q) => q.isLoading)

  const invoiceStamp = invoiceQueries.map((q) => `${q.dataUpdatedAt}:${q.isSuccess}`).join(',')
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

    const invoiceList = cardListForProjection.map((c) => {
      const idx = cardList.findIndex((item) => item.id === c.id)
      return {
        card: c,
        invoice: (idx >= 0 ? invoiceQueries[idx]?.data : undefined) || ({} as CreditCardInvoice),
      }
    })

    return buildCalendarProjection(
      operationalAccounts,
      filteredGroupTxs,
      invoiceList,
      filters.period,
      filters.accountId,
      operationalGroupTransactions,
    )
  }, [
    operationalAccounts,
    cardList,
    invoiceQueries,
    filteredGroupTxs,
    operationalGroupTransactions,
    filters.period,
    filters.accountId,
    filters.hideCreditCards,
    filters.creditCardId,
    invoiceStamp,
    txStamp,
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
