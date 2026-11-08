import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAccessibleAccounts, useAllCategories, useCreditCards, useUserDebtsSummary } from '@/lib/hooks'
import { useAuth } from '@/lib/auth'
import type { CreditCardInvoice, Transaction } from '@/lib/types'
import { monthLabel, toISODate } from '@/lib/format'
import { normalizeCategoryColor, PALETTE } from '@/lib/palette'
import type {
  CategoryComparison,
  CumulativeSpendingPoint,
  FutureMonthCommitment,
  KpiData,
  MonthlyCashFlow,
  ReportFiltersState,
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

const parseDateParts = (dateStr: string) => {
  const parts = dateStr.slice(0, 10).split('-')
  return {
    year: Number(parts[0]),
    month: Number(parts[1]),
    day: Number(parts[2]),
  }
}

export function useReportsData(filters: ReportFiltersState, _threshold?: number) {
  const { user } = useAuth()
  const accounts = useAccessibleAccounts()
  const creditCards = useCreditCards()
  const categories = useAllCategories().data ?? []
  const debtsSummary = useUserDebtsSummary(filters.period.month, filters.period.year)

  const accountList = accounts.data ?? []
  const cardList = creditCards.data ?? []

  // 1. Carrega todas as transações das contas acessíveis
  const accountQueries = useQueries({
    queries: accountList.map((a) => ({
      queryKey: ['transactions', 'account', a.id, 'all'],
      queryFn: () => api.get<Transaction[]>(`/transactions/account/${a.id}`).then((r) => r.data),
    })),
  })

  // 2. Carrega todas as transações dos cartões acessíveis
  const cardTxQueries = useQueries({
    queries: cardList.map((c) => ({
      queryKey: ['transactions', 'card', c.id, 'all'],
      queryFn: () => api.get<Transaction[]>(`/transactions/card/${c.id}`).then((r) => r.data),
    })),
  })

  // 3. Carrega todas as transações sob responsabilidade do usuário
  const responsibleQuery = useQueries({
    queries: [
      {
        queryKey: ['transactions', 'responsible', 'me', 'all'],
        queryFn: () => api.get<Transaction[]>('/transactions/responsible/me').then((r) => r.data),
      },
    ],
  })

  // 4. Carrega faturas do mês selecionado para projeção do calendário
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
    accounts.isLoading ||
    creditCards.isLoading ||
    accountQueries.some((q) => q.isLoading) ||
    cardTxQueries.some((q) => q.isLoading) ||
    responsibleQuery.some((q) => q.isLoading) ||
    invoiceQueries.some((q) => q.isLoading)

  // 5. Unifica e deduplica todas as transações
  const allTransactions = useMemo(() => {
    const map = new Map<string, Transaction>()
    accountQueries.forEach((q) => q.data?.forEach((t) => map.set(t.id, t)))
    cardTxQueries.forEach((q) => q.data?.forEach((t) => map.set(t.id, t)))
    responsibleQuery[0]?.data?.forEach((t) => map.set(t.id, t))
    return [...map.values()]
  }, [accountQueries, cardTxQueries, responsibleQuery])

  // Mapeamentos de apoio
  const cardOwnerMap = useMemo(() => new Map(cardList.map((c) => [c.id, c.ownerId])), [cardList])

  // Transações pessoais vs. transações de terceiros no cartão do titular
  const { personalTxs, thirdPartyOnMyCardTxs, myPurchasesOnOthersCards } = useMemo(() => {
    const personal: Transaction[] = []
    const thirdPartyOnMyCard: Transaction[] = []
    const myOnOthersCard: Transaction[] = []

    allTransactions.forEach((t) => {
      const cardOwnerId = t.creditCardId ? cardOwnerMap.get(t.creditCardId) : null

      if (t.creditCardId && user?.id) {
        // Se a compra foi feita no cartão de outro membro pelo usuário logado
        if (cardOwnerId && cardOwnerId !== user.id && t.responsibleId === user.id) {
          myOnOthersCard.push(t)
          personal.push(t) // é gasto do usuário logado
          return
        }

        // Se a compra foi feita no cartão do usuário logado por OUTRO membro
        if (cardOwnerId === user.id && t.responsibleId && t.responsibleId !== user.id) {
          thirdPartyOnMyCard.push(t)
          return // NÃO entra nos gastos pessoais do titular nos relatórios
        }
      }

      // Caso padrão: pertence ao titular ou é transação própria de conta/cartão
      personal.push(t)
    })

    return {
      personalTxs: personal,
      thirdPartyOnMyCardTxs: thirdPartyOnMyCard,
      myPurchasesOnOthersCards: myOnOthersCard,
    }
  }, [allTransactions, cardOwnerMap, user?.id])

  // 6. Transações pessoais após aplicação dos filtros globais
  const filteredPersonalTxs = useMemo(() => {
    return personalTxs.filter((t) => {
      if (filters.accountId) {
        const matchesAccount = t.accountId === filters.accountId || t.destinationAccountId === filters.accountId
        if (!matchesAccount) return false
      }

      if (filters.hideCreditCards || filters.creditCardId === 'none') {
        if (t.creditCardId) return false
      } else if (filters.creditCardId) {
        if (t.creditCardId !== filters.creditCardId) return false
      }

      if (filters.categoryId) {
        if (filters.categoryId === 'none') {
          if (t.categoryId) return false
        } else if (t.categoryId !== filters.categoryId) {
          return false
        }
      }

      if (filters.status) {
        if (t.status !== filters.status) return false
      }

      return true
    })
  }, [personalTxs, filters])

  // Helpers de períodos
  const selMonth = filters.period.month
  const selYear = filters.period.year
  const prevMonth = selMonth === 1 ? 12 : selMonth - 1
  const prevYear = selMonth === 1 ? selYear - 1 : selYear

  const currentMonthTxs = useMemo(
    () =>
      filteredPersonalTxs.filter((t) => {
        const p = parseDateParts(t.date)
        return p.year === selYear && p.month === selMonth
      }),
    [filteredPersonalTxs, selMonth, selYear],
  )

  const prevMonthTxs = useMemo(
    () =>
      filteredPersonalTxs.filter((t) => {
        const p = parseDateParts(t.date)
        return p.year === prevYear && p.month === prevMonth
      }),
    [filteredPersonalTxs, prevMonth, prevYear],
  )

  // -------------------------------------------------------------
  // PROJEÇÃO DO CALENDÁRIO (100% fiel ao Calendar.tsx original)
  // -------------------------------------------------------------
  const projection = useMemo(() => {
    const accs = accountList.filter((a) => !filters.accountId || a.id === filters.accountId)
    const accIds = new Set(accs.map((a) => a.id))

    const effect = (t: Transaction) => {
      if (t.creditCardId) return 0
      let v = 0
      if (t.type === 'INCOME' && accIds.has(t.accountId)) v += t.amount
      if (t.type === 'EXPENSE' && accIds.has(t.accountId)) v -= t.amount
      if (t.type === 'TRANSFER') {
        if (accIds.has(t.accountId)) v -= t.amount
        if (t.destinationAccountId && accIds.has(t.destinationAccountId)) v += t.amount
      }
      return v
    }

    const first = toISODate(new Date(selYear, selMonth - 1, 1))
    const daysInMonth = new Date(selYear, selMonth, 0).getDate()
    const relevant = filteredPersonalTxs.filter((t) => effect(t) !== 0)

    let running =
      accs.reduce((s, a) => s + a.startBalance, 0) +
      relevant.filter((t) => t.date.slice(0, 10) < first).reduce((s, t) => s + effect(t), 0)
    const opening = running

    const byDay = new Map<string, Transaction[]>()
    relevant.forEach((t) => {
      const k = t.date.slice(0, 10)
      if (k >= first) byDay.set(k, [...(byDay.get(k) ?? []), t])
    })

    const invoicesByDay = new Map<string, { cardId: string; cardName: string; remainingAmount: number }[]>()
    if (!filters.hideCreditCards && filters.creditCardId !== 'none') {
      invoiceQueries.forEach((iq, idx) => {
        const inv = iq.data
        const card = cardList[idx]
        if (!inv || !card) return
        if (filters.creditCardId && card.id !== filters.creditCardId) return
        if (!accIds.has(card.accountId)) return
        if ((inv.remainingAmount ?? 0) <= 0 || !inv.dueDate) return
        const dueIso = inv.dueDate.slice(0, 10)
        invoicesByDay.set(dueIso, [
          ...(invoicesByDay.get(dueIso) ?? []),
          { cardId: card.id, cardName: card.name, remainingAmount: inv.remainingAmount },
        ])
      })
    }

    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const date = toISODate(new Date(selYear, selMonth - 1, i + 1))
      const txs = byDay.get(date) ?? []
      const invoices = invoicesByDay.get(date) ?? []
      const invoiceDelta = invoices.reduce((s, inv) => s - inv.remainingAmount, 0)
      const delta = txs.reduce((s, t) => s + effect(t), 0) + invoiceDelta
      running += delta
      return { day: i + 1, date, txs, invoices, delta, balance: running }
    })

    const min = days.reduce((m, d) => (d.balance < m.balance ? d : m), days[0] ?? { day: 1, balance: 0, delta: 0, date: first, txs: [], invoices: [] })
    const firstNegative = days.find((d) => d.balance < 0)

    return { days, opening, closing: running, min, firstNegative }
  }, [accountList, cardList, filteredPersonalTxs, invoiceQueries, filters, selMonth, selYear])

  // -------------------------------------------------------------
  // BLOCO 1: KPIs
  // -------------------------------------------------------------
  const kpis: KpiData = useMemo(() => {
    let income = 0
    let expense = 0
    let cardExpense = 0
    let accountExpense = 0

    currentMonthTxs.forEach((t) => {
      if (t.type === 'INCOME') income += t.amount
      else if (t.type === 'EXPENSE') {
        expense += t.amount
        if (t.creditCardId) cardExpense += t.amount
        else accountExpense += t.amount
      }
    })

    const net = income - expense
    const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0

    const now = new Date()
    const isCurrentMonth = now.getFullYear() === selYear && now.getMonth() + 1 === selMonth
    const daysInMonth = new Date(selYear, selMonth, 0).getDate()
    const daysElapsed = isCurrentMonth ? Math.max(1, now.getDate()) : daysInMonth
    const dailyAverage = Math.round(expense / daysElapsed)

    const pendingExpenses = currentMonthTxs
      .filter((t) => t.type === 'EXPENSE' && t.status === 'PENDING')
      .reduce((s, t) => s + t.amount, 0)
    const realizedExpenses = currentMonthTxs
      .filter((t) => t.type === 'EXPENSE' && t.status === 'COMPLETED')
      .reduce((s, t) => s + t.amount, 0)
    const projectedMonthEnd = realizedExpenses + pendingExpenses

    const cardSharePct = expense > 0 ? Math.round((cardExpense / expense) * 100) : 0

    return {
      income,
      expense,
      net,
      savingsRate,
      dailyAverage,
      projectedMonthEnd,
      cardExpense,
      accountExpense,
      cardSharePct,
      minBalanceDay: projection.min.day,
      minBalanceAmount: projection.min.balance,
    }
  }, [currentMonthTxs, selMonth, selYear, projection.min])

  // -------------------------------------------------------------
  // BLOCO 2: Fluxo de Caixa Histórico (Últimos 6 meses até o selecionado)
  // -------------------------------------------------------------
  const cashFlowHistory: MonthlyCashFlow[] = useMemo(() => {
    const list: MonthlyCashFlow[] = []

    for (let i = 5; i >= 0; i--) {
      let m = selMonth - i
      let y = selYear
      while (m <= 0) {
        m += 12
        y -= 1
      }

      const txs = filteredPersonalTxs.filter((t) => {
        const p = parseDateParts(t.date)
        return p.year === y && p.month === m
      })

      const inc = txs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0)
      const exp = txs.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0)

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
  }, [filteredPersonalTxs, selMonth, selYear])

  // -------------------------------------------------------------
  // BLOCO 3: Evolução por Categoria e MoM
  // -------------------------------------------------------------
  const categoryEvolution: CategoryComparison[] = useMemo(() => {
    const currentCatMap = new Map<string, number>()
    const prevCatMap = new Map<string, number>()

    currentMonthTxs
      .filter((t) => t.type === 'EXPENSE')
      .forEach((t) => {
        const key = t.categoryId || 'none'
        currentCatMap.set(key, (currentCatMap.get(key) ?? 0) + t.amount)
      })

    prevMonthTxs
      .filter((t) => t.type === 'EXPENSE')
      .forEach((t) => {
        const key = t.categoryId || 'none'
        prevCatMap.set(key, (prevCatMap.get(key) ?? 0) + t.amount)
      })

    const catInfoMap = new Map(categories.map((c) => [c.id, c]))
    const totalCurrentExpense = [...currentCatMap.values()].reduce((s, v) => s + v, 0)

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
  }, [currentMonthTxs, prevMonthTxs, categories])

  // -------------------------------------------------------------
  // BLOCO 4: Projeção de Compromissos Futuros (M+1 a M+6)
  // -------------------------------------------------------------
  const futureCommitments: FutureMonthCommitment[] = useMemo(() => {
    const list: FutureMonthCommitment[] = []

    for (let i = 1; i <= 6; i++) {
      let m = selMonth + i
      let y = selYear
      while (m > 12) {
        m -= 12
        y += 1
      }

      // 1. Parcelas de cartão previstas para o mês futuro
      const cardCommitted = personalTxs
        .filter((t) => {
          if (!t.creditCardId) return false
          if (filters.creditCardId && t.creditCardId !== filters.creditCardId) return false
          if (filters.hideCreditCards || filters.creditCardId === 'none') return false

          if (t.invoiceMonth && t.invoiceYear) {
            return t.invoiceMonth === m && t.invoiceYear === y
          }
          const p = parseDateParts(t.date)
          return p.month === m && p.year === y
        })
        .reduce((s, t) => s + (t.type === 'INCOME' ? -t.amount : t.amount), 0)

      // 2. Despesas agendadas em conta para o mês futuro
      const accountPending = personalTxs
        .filter((t) => {
          if (t.creditCardId) return false
          if (t.type !== 'EXPENSE') return false
          if (filters.accountId && t.accountId !== filters.accountId) return false
          const p = parseDateParts(t.date)
          return p.month === m && p.year === y
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
  }, [personalTxs, selMonth, selYear, filters])

  // -------------------------------------------------------------
  // BLOCO 5: Hábitos de Consumo (Curva de Ritmo e Dias da Semana)
  // -------------------------------------------------------------
  const spendingHabits = useMemo(() => {
    // A) Curva de Ritmo Acumulado (dia 1 ao último dia)
    const daysInCurrentMonth = new Date(selYear, selMonth, 0).getDate()
    const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate()
    const maxDays = Math.max(daysInCurrentMonth, daysInPrevMonth)

    const currentDailyMap = new Map<number, number>()
    const prevDailyMap = new Map<number, number>()

    currentMonthTxs
      .filter((t) => t.type === 'EXPENSE')
      .forEach((t) => {
        const d = parseDateParts(t.date).day
        currentDailyMap.set(d, (currentDailyMap.get(d) ?? 0) + t.amount)
      })

    prevMonthTxs
      .filter((t) => t.type === 'EXPENSE')
      .forEach((t) => {
        const d = parseDateParts(t.date).day
        prevDailyMap.set(d, (prevDailyMap.get(d) ?? 0) + t.amount)
      })

    const cumulativePoints: CumulativeSpendingPoint[] = []
    let currentAcc = 0
    let prevAcc = 0

    const now = new Date()
    const isCurrentMonth = now.getFullYear() === selYear && now.getMonth() + 1 === selMonth
    const todayDay = isCurrentMonth ? now.getDate() : 31

    for (let day = 1; day <= maxDays; day++) {
      if (day <= daysInCurrentMonth && day <= todayDay) {
        currentAcc += currentDailyMap.get(day) ?? 0
      }
      if (day <= daysInPrevMonth) {
        prevAcc += prevDailyMap.get(day) ?? 0
      }

      cumulativePoints.push({
        day,
        currentMonthAmount: day <= todayDay ? currentAcc : currentAcc,
        previousMonthAmount: prevAcc,
      })
    }

    // B) Gastos por Dia da Semana (Dom a Sáb)
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const weekdayTotals = [0, 0, 0, 0, 0, 0, 0]

    currentMonthTxs
      .filter((t) => t.type === 'EXPENSE')
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

    return {
      cumulativePoints,
      byDayOfWeek,
    }
  }, [currentMonthTxs, prevMonthTxs, selMonth, selYear, prevMonth, prevYear])

  // -------------------------------------------------------------
  // BLOCO 6: Balanço de Grupos e Cartões Compartilhados
  // -------------------------------------------------------------
  const sharedGroupBalance: SharedGroupBalance = useMemo(() => {
    // Gastos que fiz em cartões de terceiros no período atual
    const myOnOthers = myPurchasesOnOthersCards
      .filter((t) => {
        const p = parseDateParts(t.date)
        return p.year === selYear && p.month === selMonth && t.type === 'EXPENSE'
      })
      .reduce((s, t) => s + t.amount, 0)

    // Gastos que outros fizeram no meu cartão no período atual
    const othersOnMine = thirdPartyOnMyCardTxs
      .filter((t) => {
        const p = parseDateParts(t.date)
        return p.year === selYear && p.month === selMonth && t.type === 'EXPENSE'
      })
      .reduce((s, t) => s + t.amount, 0)

    const groups = debtsSummary.data?.groups ?? []

    return {
      spentByMeOnSharedCards: myOnOthers,
      spentByOthersOnMyCards: othersOnMine,
      totalOwedByMe: debtsSummary.data?.totalOwedCurrentMonth ?? 0,
      totalReceivableByMe: debtsSummary.data?.totalReceivableCurrentMonth ?? 0,
      groups,
    }
  }, [myPurchasesOnOthersCards, thirdPartyOnMyCardTxs, debtsSummary.data, selMonth, selYear])

  return {
    loading,
    accounts: accountList,
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
