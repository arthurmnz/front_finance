import type { Account, GroupAccount, Transaction, TransactionType } from './types'

/** Normaliza um `GroupAccount` para `Account`, tratando `owner` nulo em contas conjuntas. */
export function normalizeGroupAccount(ga: GroupAccount): Account {
  return {
    ...ga,
    ownerId: ga.owner?.id ?? null,
    owner: ga.owner ?? null,
    isJoint: Boolean(ga.isJoint),
    allowedMembers: ga.allowedMembers,
  }
}

/**
 * Combina contas conjuntas acessíveis (membro) com todas as contas conjuntas do grupo (admin),
 * preservando os metadados completos (`allowedMembers`) retornados pelo endpoint de admin.
 */
export function mergeGroupJointAccounts(
  accessibleGroupAccounts: GroupAccount[],
  adminJointAccounts: GroupAccount[],
  isAdmin: boolean,
): GroupAccount[] {
  const map = new Map<string, GroupAccount>()
  accessibleGroupAccounts
    .filter((a) => a.isJoint)
    .forEach((a) => map.set(a.id, a))
  if (isAdmin) {
    adminJointAccounts.forEach((ja) => map.set(ja.id, ja))
  }
  return [...map.values()]
}

/**
 * Verifica se o usuário autenticado possui acesso de movimentação à conta conjunta.
 * Quando `allowedMembers` está presente, usa a lista autorizada; caso contrário usa as contas acessíveis.
 */
export function hasJointAccountAccess(
  account: Pick<Account | GroupAccount, 'id' | 'allowedMembers'>,
  accessibleAccountIds: Set<string>,
  userId?: string,
): boolean {
  if (account.allowedMembers) {
    return Boolean(userId && account.allowedMembers.some((m) => m.id === userId))
  }
  return accessibleAccountIds.has(account.id)
}

/**
 * Regra para exibir/permitir "gerar dívida 1-para-1" em transferências:
 * bloqueia sempre que origem ou destino for conta conjunta (sem dono individual).
 */
export function canTransferGenerateDebt(params: {
  sourceMode?: 'ACCOUNT' | 'CARD'
  type?: TransactionType
  isCreditCardTx?: boolean
  sourceAccount?: Pick<Account, 'ownerId' | 'isJoint' | 'groupId'>
  destAccount?: Pick<Account, 'ownerId' | 'isJoint' | 'groupId'>
  userId?: string
}): boolean {
  const { sourceMode = 'ACCOUNT', type, isCreditCardTx = false, sourceAccount, destAccount, userId } = params
  if (sourceMode !== 'ACCOUNT' || type !== 'TRANSFER' || isCreditCardTx) return false
  if (!sourceAccount || !destAccount || !userId) return false
  if (sourceAccount.isJoint || destAccount.isJoint) return false
  if (!sourceAccount.ownerId || !destAccount.ownerId) return false
  if (sourceAccount.ownerId !== userId) return false
  if (sourceAccount.ownerId === destAccount.ownerId) return false
  return Boolean(sourceAccount.groupId || destAccount.groupId)
}

/** Filtra contas individuais do credor em acertos de dívida, ignorando contas conjuntas. */
export function filterCreditorAccountsForSettlement(
  groupAccounts: GroupAccount[],
  creditorId: string,
): GroupAccount[] {
  return groupAccounts.filter((a) => !a.isJoint && a.owner?.id === creditorId)
}

/**
 * Restringe transações retornadas por `/transactions/responsible/me` no Dashboard pessoal,
 * evitando misturar gastos lançados em contas conjuntas de grupo no gráfico individual.
 */
export function filterDashboardResponsibleExpenses(
  responsibleTxs: Transaction[],
  userId: string | undefined,
  ownAccountIds: Set<string>,
): Transaction[] {
  if (!userId) return []
  return responsibleTxs.filter(
    (t) =>
      t.type === 'EXPENSE' &&
      t.responsibleId === userId &&
      Boolean(t.creditCardId || ownAccountIds.has(t.accountId)),
  )
}

/**
 * Filtra contas permitidas como origem em uma transferência:
 * apenas contas individuais do próprio usuário e contas conjuntas em que possui acesso.
 * Contas individuais de outros integrantes do grupo não podem ser usadas como origem.
 */
export function filterTransferSourceAccounts(
  accounts: Account[],
  userId?: string,
): Account[] {
  if (!userId) return []
  const accessibleIds = new Set(accounts.map((a) => a.id))
  return accounts.filter((a) =>
    a.isJoint ? hasJointAccountAccess(a, accessibleIds, userId) : a.ownerId === userId,
  )
}

/** Seleciona conta de origem padrão (preferencialmente própria e não conjunta) dentre as origens permitidas para o usuário. */
export function pickTransferSourceAccountId(
  accounts: Account[],
  destinationAccountId: string,
  userId?: string,
): string | undefined {
  const allowedSources = filterTransferSourceAccounts(accounts, userId)
  return (
    allowedSources.find((a) => a.id !== destinationAccountId && !a.isJoint)?.id ??
    allowedSources.find((a) => a.id !== destinationAccountId)?.id
  )
}
