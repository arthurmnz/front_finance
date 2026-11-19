export type AccountType = 'CHECKING' | 'WALLET' | 'SAVINGS' | 'INVESTMENTS'
export type CategoryType = 'EXPENSE' | 'INCOME' | 'BOTH'
export type CategoryLevel = 'GENERAL' | 'SPECIFIC'
export type TransactionType = 'EXPENSE' | 'INCOME' | 'TRANSFER'
export type TransactionStatus = 'PENDING' | 'COMPLETED'
export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
export type GroupRole = 'OWNER' | 'ADMIN' | 'MEMBER'
export type FriendshipStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED'

export interface User { id: string; firstName: string; lastName: string; email: string; role?: 'USER' | 'ADMIN'; isActive?: boolean; createdAt: string; updatedAt: string }
export interface AuthResponse { accessToken: string; tokenType: string; expiresIn: number; user: User }

export interface Account {
  id: string; ownerId: string | null; owner?: UserSummary | null; name: string; startBalance: number; balance: number
  type: AccountType; tax: number | null; groupId: string | null; includeInTotal: boolean
  isJoint?: boolean; allowedMembers?: UserSummary[]; createdAt: string; updatedAt: string
}
export interface UserSummary { id: string; firstName: string; lastName: string; email: string }
export interface GroupAccount extends Omit<Account, 'ownerId'> {
  owner: UserSummary | null
  isJoint: boolean
  allowedMembers?: UserSummary[]
}
export interface TotalBalance { total: number; monthlyIncome: number; monthlyExpense: number }
export interface AccountInput { name: string; startBalance: number; type: AccountType; tax?: number | null; includeInTotal?: boolean }
export interface JointAccountInput {
  name: string
  startBalance: number
  balance?: number | null
  type: AccountType
  tax?: number | null
  includeInTotal?: boolean
  memberIds: string[]
}
export interface JointAccountMemberShare {
  user: UserSummary
  shareAmount: number
  contributedAmount: number
  launchedExpensesAmount: number
  netBalance: number
}
export interface JointAccountSummary {
  accountId: string
  accountName: string
  groupId: string
  currentBalance: number
  month: number
  year: number
  totalExpenses: number
  completedExpenses: number
  pendingExpenses: number
  totalIncome: number
  totalContributions: number
  memberCount: number
  memberShares: JointAccountMemberShare[]
}
export interface AccountGroupRequest {
  id: string; account: { id: string; name: string }; requester: UserSummary
  status: string; createdAt: string; updatedAt: string
}

export interface CreditCard {
  id: string; ownerId: string; owner: UserSummary | null; accountId: string; name: string
  limitAmount: number; usedLimit: number; availableLimit: number
  closingDay: number; dueDay: number; groupId: string | null
  currentInvoiceMonth: number; currentInvoiceYear: number; currentInvoiceAmount: number
  createdAt: string; updatedAt: string
}
export interface CreditCardInput {
  name: string; accountId: string; limitAmount: number; closingDay: number; dueDay: number
}
export interface CreditCardInvoice {
  creditCardId: string; month: number; year: number; closingDate: string; dueDate: string
  purchasesAmount: number; carriedOverAmount: number; revolvingInterestAmount: number
  totalAmount: number; paidAmount: number; remainingAmount: number; status: 'OPEN' | 'CLOSED' | 'PAID' | 'PARTIALLY_PAID'
  transactions: Transaction[]
  byResponsible: { user: UserSummary; amount: number }[]
  payments?: Transaction[]
}
export interface PayInvoiceInput {
  amount: number; accountId?: string | null; date: string; rollRemainingToNextMonth: boolean; nextMonthRevolvingInterest?: number | null
}
export interface CreditCardGroupRequest {
  id: string; creditCard: { id: string; name: string }; requester: UserSummary
  status: string; createdAt: string; updatedAt: string
}

export interface CategoryParentSummary {
  id: string
  name: string
  color?: string | null
  icon?: string | null
  type: CategoryType
}

export interface CategorySummary {
  id: string
  name: string
  color?: string | null
  icon?: string | null
  type: CategoryType
  level?: CategoryLevel
  parentId?: string | null
  parent?: CategoryParentSummary | null
}

export interface Category {
  id: string; name: string; description: string | null; userId: string | null; groupId: string | null
  type: CategoryType; level: CategoryLevel; parentId?: string | null; parent?: CategoryParentSummary | null
  isDefault?: boolean; color: string | null; icon: string | null; createdAt: string; updatedAt: string
}
export interface CategoryInput {
  name: string; description?: string | null; type: CategoryType; level?: CategoryLevel; parentId?: string | null
  color?: string | null; icon?: string | null; groupId?: string | null
}

export interface Transaction {
  id: string; title: string; amount: number; date: string; responsibleId: string; responsible?: UserSummary | null
  accountId: string; type: TransactionType; destinationAccountId: string | null; categoryId?: string | null
  generalCategoryId?: string | null
  specificCategoryId?: string | null
  category?: CategorySummary | null
  generalCategory?: CategorySummary | null
  specificCategory?: CategorySummary | null
  status: TransactionStatus; recurrenceGroupId: string | null; recurrenceFrequency: RecurrenceFrequency | null
  recurrenceInterval: number | null; isInfinite: boolean
  creditCardId?: string | null; creditCardInvoiceId?: string | null; invoiceMonth?: number | null; invoiceYear?: number | null
  installmentNumber?: number | null; totalInstallments?: number | null
  generatesDebt?: boolean
  createdAt: string; updatedAt: string
}
export interface AccountSplitInput {
  accountId: string
  amount: number
}
export interface CreateTransactionInput {
  title: string; amount: number; date: string; accountId: string; type: TransactionType
  destinationAccountId?: string | null; categoryId?: string | null
  generalCategoryId?: string | null; specificCategoryId?: string | null; status: TransactionStatus
  isRecurring: boolean; recurrenceFrequency?: RecurrenceFrequency | null
  recurrenceInterval: number; recurrenceInstallments: number; isInfinite: boolean
  creditCardId?: string | null; creditCardInvoiceId?: string | null; invoiceMonth?: number | null; invoiceYear?: number | null
  installmentAmountMode?: 'INSTALLMENT' | 'TOTAL'
  splits?: AccountSplitInput[] | null
  generatesDebt?: boolean
}
export interface UpdateTransactionInput {
  title: string; amount: number; date: string; categoryId?: string | null
  generalCategoryId?: string | null; specificCategoryId?: string | null; status: TransactionStatus
  updateAllFuture: boolean; invoiceMonth?: number | null; invoiceYear?: number | null
  generatesDebt?: boolean | null
}

export interface Friendship { id: string; requester: UserSummary; addressee: UserSummary; status: FriendshipStatus; createdAt: string; updatedAt: string }

export interface GroupSummary { id: string; name: string; myRole: GroupRole; memberCount: number; createdAt: string }
export interface GroupMember { user: UserSummary; role: GroupRole; joinedAt: string }
export interface Group extends GroupSummary { members: GroupMember[]; updatedAt: string }
export interface GroupInvitation { id: string; group: { id: string; name: string }; inviter: UserSummary; status: string; createdAt: string; updatedAt: string }

export interface GroupUsedCategory {
  id: string
  name: string
  color: string | null
  icon: string | null
  type?: CategoryType
  level?: CategoryLevel
  parentId?: string | null
  parent?: CategoryParentSummary | null
  isPersonal: boolean
  ownerId: string | null
}

export interface MemberDebtDetail {
  debtorId: string
  creditorId: string
  grossAmount: number
  settledAmount: number
  remainingAmount: number
  transactions: Transaction[]
}

export interface PairDebtBalance {
  debtor: UserSummary
  creditor: UserSummary
  netAmount: number
  grossDebts: MemberDebtDetail[]
}

export interface GroupMonthlyDebt {
  month: number
  year: number
  userBalances: PairDebtBalance[]
}

export interface DebtSettlement {
  id: string
  groupId: string
  debtorId: string
  debtor: UserSummary | null
  creditorId: string
  creditor: UserSummary | null
  amount: number
  targetMonth: number
  targetYear: number
  date: string
  transactionId: string | null
  notes: string | null
  isForgiveness?: boolean
  createdAt: string
}

export interface GroupDebtsResponse {
  groupId: string
  totalOwedByMe: number
  totalReceivableByMe: number
  monthlyBalances: GroupMonthlyDebt[]
  settlements: DebtSettlement[]
}

export interface SettleDebtInput {
  creditorId: string
  amount: number
  targetMonth: number
  targetYear: number
  sourceAccountId: string
  destinationAccountId: string
  notes?: string | null
}

export interface ForgiveDebtInput {
  debtorId: string
  amount: number
  targetMonth: number
  targetYear: number
  notes?: string | null
}

export interface UserDebtGroupSummary {
  groupId: string
  groupName: string
  owedCurrentMonth: number
  receivableCurrentMonth: number
  owedTotal: number
  receivableTotal: number
}

export interface UserDebtsSummary {
  totalOwedCurrentMonth: number
  totalReceivableCurrentMonth: number
  totalOwedAllMonths: number
  totalReceivableAllMonths: number
  groups: UserDebtGroupSummary[]
}

export interface AdminMonthlyGrowth {
  month: string
  label: string
  usersCount: number
  transactionsCount: number
}

export interface AdminMetrics {
  totalUsers: number
  activeUsers: number
  blockedUsers: number
  adminUsers: number
  newUsersLast7Days: number
  newUsersLast30Days: number
  totalAccounts: number
  totalCreditCards: number
  totalGroups: number
  totalTransactions: number
  monthlyGrowth: AdminMonthlyGrowth[]
}

export interface AdminUserSummary {
  id: string
  firstName: string
  lastName: string
  email: string
  role: 'USER' | 'ADMIN'
  isActive: boolean
  createdAt: string
  updatedAt: string
  accountsCount: number
  creditCardsCount: number
  groupsCount: number
  transactionsCount: number
}
