export interface ReportPeriod {
  month: number
  year: number
}

export interface ReportFiltersState {
  period: ReportPeriod
  accountId: string
  creditCardId: string
  hideCreditCards: boolean
  categoryId: string
  status: '' | 'COMPLETED' | 'PENDING'
}

export interface KpiData {
  income: number
  expense: number
  net: number
  savingsRate: number
  dailyAverage: number
  projectedMonthEnd: number
  cardExpense: number
  accountExpense: number
  cardSharePct: number
  minBalanceDay: number
  minBalanceAmount: number
}

export interface MonthlyCashFlow {
  label: string
  month: number
  year: number
  income: number
  expense: number
  net: number
}

export interface CategoryComparison {
  id?: string
  name: string
  color: string
  currentAmount: number
  previousAmount: number
  percentageOfTotal: number
  momVariationPct: number | null
  isNew: boolean
}

export interface FutureMonthCommitment {
  label: string
  month: number
  year: number
  cardCommitted: number
  accountPending: number
  totalCommitted: number
}

export interface SpendingByDayOfWeek {
  dayName: string
  dayIndex: number
  amount: number
}

export interface CumulativeSpendingPoint {
  day: number
  currentMonthAmount: number
  previousMonthAmount: number
}

export interface SharedGroupBalance {
  spentByMeOnSharedCards: number
  spentByOthersOnMyCards: number
  totalOwedByMe: number
  totalReceivableByMe: number
  groups: {
    groupId: string
    groupName: string
    owedCurrentMonth: number
    receivableCurrentMonth: number
    owedTotal: number
    receivableTotal: number
  }[]
}
