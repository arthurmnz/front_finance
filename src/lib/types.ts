export type AccountType = 'CHECKING' | 'WALLET' | 'SAVINGS' | 'INVESTMENTS'
export type CategoryType = 'EXPENSE' | 'INCOME' | 'BOTH'
export type TransactionType = 'EXPENSE' | 'INCOME' | 'TRANSFER'
export type TransactionStatus = 'PENDING' | 'COMPLETED'
export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
export type GroupRole = 'OWNER' | 'ADMIN' | 'MEMBER'
export type FriendshipStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED'

export interface User { id: string; firstName: string; lastName: string; email: string; createdAt: string; updatedAt: string }
export interface AuthResponse { accessToken: string; tokenType: string; expiresIn: number; user: User }

export interface Account {
  id: string; ownerId: string; name: string; startBalance: number; balance: number
  type: AccountType; tax: number | null; groupId: string | null; createdAt: string; updatedAt: string
}
export interface UserSummary { id: string; firstName: string; lastName: string; email: string }
export interface GroupAccount extends Omit<Account, 'ownerId'> { owner: UserSummary }
export interface TotalBalance { total: number; monthlyIncome: number; monthlyExpense: number }
export interface AccountInput { name: string; startBalance: number; type: AccountType; tax?: number | null }
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
}
export interface PayInvoiceInput {
  amount: number; accountId?: string | null; date: string; rollRemainingToNextMonth: boolean; nextMonthRevolvingInterest?: number | null
}
export interface CreditCardGroupRequest {
  id: string; creditCard: { id: string; name: string }; requester: UserSummary
  status: string; createdAt: string; updatedAt: string
}

export interface Category {
  id: string; name: string; description: string | null; userId: string | null; groupId: string | null
  type: CategoryType; color: string | null; icon: string | null; createdAt: string; updatedAt: string
}
export interface CategoryInput { name: string; description?: string | null; type: CategoryType; color?: string | null; icon?: string | null; groupId?: string | null }

export interface Transaction {
  id: string; title: string; amount: number; date: string; responsibleId: string; responsible?: UserSummary | null
  accountId: string; type: TransactionType; destinationAccountId: string | null; categoryId: string | null
  status: TransactionStatus; recurrenceGroupId: string | null; recurrenceFrequency: RecurrenceFrequency | null
  recurrenceInterval: number | null; isInfinite: boolean
  creditCardId?: string | null; invoiceMonth?: number | null; invoiceYear?: number | null
  installmentNumber?: number | null; totalInstallments?: number | null
  createdAt: string; updatedAt: string
}
export interface CreateTransactionInput {
  title: string; amount: number; date: string; accountId: string; type: TransactionType
  destinationAccountId?: string | null; categoryId?: string | null; status: TransactionStatus
  isRecurring: boolean; recurrenceFrequency?: RecurrenceFrequency | null
  recurrenceInterval: number; recurrenceInstallments: number; isInfinite: boolean
  creditCardId?: string | null; invoiceMonth?: number | null; invoiceYear?: number | null
  installmentAmountMode?: 'INSTALLMENT' | 'TOTAL'
}
export interface UpdateTransactionInput {
  title: string; amount: number; date: string; categoryId?: string | null; status: TransactionStatus
  updateAllFuture: boolean; invoiceMonth?: number | null; invoiceYear?: number | null
}

export interface Friendship { id: string; requester: UserSummary; addressee: UserSummary; status: FriendshipStatus; createdAt: string; updatedAt: string }

export interface GroupSummary { id: string; name: string; myRole: GroupRole; memberCount: number; createdAt: string }
export interface GroupMember { user: UserSummary; role: GroupRole; joinedAt: string }
export interface Group extends GroupSummary { members: GroupMember[]; updatedAt: string }
export interface GroupInvitation { id: string; group: { id: string; name: string }; inviter: UserSummary; status: string; createdAt: string; updatedAt: string }
