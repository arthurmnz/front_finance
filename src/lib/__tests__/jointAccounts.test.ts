import { describe, expect, it } from 'vitest'
import { formatAccountLabel, formatShortAccountLabel } from '@/lib/format'
import {
  canTransferGenerateDebt,
  filterCreditorAccountsForSettlement,
  filterDashboardResponsibleExpenses,
  filterTransferSourceAccounts,
  hasJointAccountAccess,
  mergeGroupJointAccounts,
  normalizeGroupAccount,
  pickTransferSourceAccountId,
} from '@/lib/jointAccounts'
import { buildCalendarProjection, buildGroupMemberExpenses } from '@/components/reports/useReportsData'
import type { Account, GroupAccount, GroupMember, Transaction, UserSummary } from '@/lib/types'

const userA: UserSummary = {
  id: 'user_a',
  firstName: 'Ana',
  lastName: 'Silva',
  email: 'ana@example.com',
}

const userB: UserSummary = {
  id: 'user_b',
  firstName: 'Bruno',
  lastName: 'Costa',
  email: 'bruno@example.com',
}

const userC: UserSummary = {
  id: 'user_c',
  firstName: 'Carla',
  lastName: 'Dias',
  email: 'carla@example.com',
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc_1',
    ownerId: userA.id,
    owner: userA,
    name: 'Conta Principal',
    startBalance: 0,
    balance: 100000,
    type: 'CHECKING',
    tax: null,
    groupId: 'grp_1',
    includeInTotal: true,
    isJoint: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeGroupAccount(overrides: Partial<GroupAccount> = {}): GroupAccount {
  return {
    id: 'ga_1',
    owner: userA,
    name: 'Conta Ana',
    startBalance: 0,
    balance: 150000,
    type: 'CHECKING',
    tax: null,
    groupId: 'grp_1',
    includeInTotal: true,
    isJoint: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx_${Math.random().toString(36).slice(2, 8)}`,
    title: 'Lançamento',
    amount: 10000,
    date: '2026-11-10',
    responsibleId: userA.id,
    accountId: 'acc_1',
    type: 'EXPENSE',
    destinationAccountId: null,
    categoryId: null,
    status: 'COMPLETED',
    recurrenceGroupId: null,
    recurrenceFrequency: null,
    recurrenceInterval: null,
    isInfinite: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('Conta Conjunta do Grupo (src/lib/jointAccounts.ts & helpers)', () => {
  it('formatAccountLabel e formatShortAccountLabel identificam contas conjuntas sem parênteses vazios', () => {
    expect(formatAccountLabel({ name: 'Casa', isJoint: true, owner: null })).toBe('Casa (Conjunta)')
    expect(formatAccountLabel({ name: 'Nubank', isJoint: false, owner: userA })).toBe('Nubank (Ana Silva)')
    expect(formatAccountLabel({ name: 'Carteira', isJoint: false, owner: null })).toBe('Carteira')
    expect(formatShortAccountLabel({ name: 'Casa', isJoint: true })).toBe('Casa (Conjunta)')
    expect(formatShortAccountLabel({ name: 'Nubank', isJoint: false })).toBe('Nubank')
  })

  it('normalizeGroupAccount trata owner nulo em conta conjunta sem lançar erro', () => {
    const joint = makeGroupAccount({
      id: 'joint_1',
      name: 'Conta da Casa',
      owner: null,
      isJoint: true,
      allowedMembers: [userA, userB],
    })
    const normalized = normalizeGroupAccount(joint)

    expect(normalized.ownerId).toBeNull()
    expect(normalized.owner).toBeNull()
    expect(normalized.isJoint).toBe(true)
    expect(normalized.allowedMembers).toEqual([userA, userB])

    const individual = makeGroupAccount({ id: 'ind_1', owner: userB, isJoint: false })
    const normInd = normalizeGroupAccount(individual)
    expect(normInd.ownerId).toBe(userB.id)
    expect(normInd.isJoint).toBe(false)
  })

  it('mergeGroupJointAccounts une contas de membro e admin priorizando allowedMembers completos', () => {
    const fromAccountsEndpoint = [
      makeGroupAccount({ id: 'ind_1', owner: userA, isJoint: false }),
      makeGroupAccount({ id: 'joint_1', name: 'Casa', owner: null, isJoint: true }),
    ]
    const fromAdminEndpoint = [
      makeGroupAccount({
        id: 'joint_1',
        name: 'Casa',
        owner: null,
        isJoint: true,
        allowedMembers: [userA, userB],
      }),
      makeGroupAccount({
        id: 'joint_2',
        name: 'Fundo Filhos',
        owner: null,
        isJoint: true,
        allowedMembers: [userB, userC],
      }),
    ]

    const adminMerged = mergeGroupJointAccounts(fromAccountsEndpoint, fromAdminEndpoint, true)
    expect(adminMerged).toHaveLength(2)
    expect(adminMerged.find((a) => a.id === 'joint_1')?.allowedMembers).toEqual([userA, userB])
    expect(adminMerged.find((a) => a.id === 'joint_2')?.allowedMembers).toEqual([userB, userC])

    const memberMerged = mergeGroupJointAccounts(fromAccountsEndpoint, fromAdminEndpoint, false)
    expect(memberMerged).toHaveLength(1)
    expect(memberMerged[0].id).toBe('joint_1')
  })

  it('hasJointAccountAccess identifica admin sem acesso de movimentação vs membro autorizado', () => {
    const accessibleIds = new Set(['joint_1'])
    const jointWithUserA = makeGroupAccount({
      id: 'joint_1',
      owner: null,
      isJoint: true,
      allowedMembers: [userA, userB],
    })
    const jointWithoutUserA = makeGroupAccount({
      id: 'joint_2',
      owner: null,
      isJoint: true,
      allowedMembers: [userB, userC],
    })

    expect(hasJointAccountAccess(jointWithUserA, accessibleIds, userA.id)).toBe(true)
    expect(hasJointAccountAccess(jointWithoutUserA, accessibleIds, userA.id)).toBe(false)
    expect(hasJointAccountAccess({ id: 'joint_1', allowedMembers: undefined }, accessibleIds, userA.id)).toBe(true)
    expect(hasJointAccountAccess({ id: 'joint_3', allowedMembers: undefined }, accessibleIds, userA.id)).toBe(false)
  })

  it('canTransferGenerateDebt bloqueia transferências envolvendo contas conjuntas', () => {
    const accA = makeAccount({ id: 'acc_a', ownerId: userA.id, owner: userA, isJoint: false, groupId: 'grp_1' })
    const accB = makeAccount({ id: 'acc_b', ownerId: userB.id, owner: userB, isJoint: false, groupId: 'grp_1' })
    const accJoint = makeAccount({ id: 'acc_joint', ownerId: null, owner: null, isJoint: true, groupId: 'grp_1' })

    // Transferência 1-para-1 entre contas individuais do grupo deve permitir gerar dívida
    expect(
      canTransferGenerateDebt({
        sourceMode: 'ACCOUNT',
        type: 'TRANSFER',
        sourceAccount: accA,
        destAccount: accB,
        userId: userA.id,
      }),
    ).toBe(true)

    // Aporte para conta conjunta NÃO gera dívida 1-para-1
    expect(
      canTransferGenerateDebt({
        sourceMode: 'ACCOUNT',
        type: 'TRANSFER',
        sourceAccount: accA,
        destAccount: accJoint,
        userId: userA.id,
      }),
    ).toBe(false)

    // Saída de conta conjunta NÃO gera dívida 1-para-1
    expect(
      canTransferGenerateDebt({
        sourceMode: 'ACCOUNT',
        type: 'TRANSFER',
        sourceAccount: accJoint,
        destAccount: accB,
        userId: userA.id,
      }),
    ).toBe(false)
  })

  it('filterCreditorAccountsForSettlement ignora contas conjuntas e owner nulo sem falhar', () => {
    const groupAccounts: GroupAccount[] = [
      makeGroupAccount({ id: 'joint_1', name: 'Casa', owner: null, isJoint: true }),
      makeGroupAccount({ id: 'acc_b1', name: 'Nubank Bruno', owner: userB, isJoint: false }),
      makeGroupAccount({ id: 'acc_a1', name: 'Itaú Ana', owner: userA, isJoint: false }),
    ]

    const creditorAccs = filterCreditorAccountsForSettlement(groupAccounts, userB.id)
    expect(creditorAccs.map((a) => a.id)).toEqual(['acc_b1'])
  })

  it('filterDashboardResponsibleExpenses exclui despesas da conta conjunta do gráfico individual do Dashboard', () => {
    const ownIds = new Set(['acc_own_1'])
    const txs: Transaction[] = [
      makeTx({ id: 'tx_own_acc', accountId: 'acc_own_1', responsibleId: userA.id, amount: 5000 }),
      makeTx({
        id: 'tx_shared_card',
        accountId: 'acc_b',
        creditCardId: 'card_b',
        responsibleId: userA.id,
        amount: 12000,
      }),
      makeTx({
        id: 'tx_joint_acc',
        accountId: 'acc_joint_1',
        creditCardId: null,
        responsibleId: userA.id,
        amount: 45000,
      }),
      makeTx({
        id: 'tx_other_member',
        accountId: 'acc_own_1',
        responsibleId: userB.id,
        amount: 3000,
      }),
    ]

    const filtered = filterDashboardResponsibleExpenses(txs, userA.id, ownIds)
    expect(filtered.map((t) => t.id)).toEqual(['tx_own_acc', 'tx_shared_card'])
  })

  it('filterTransferSourceAccounts restringe origem a contas próprias e conjuntas com acesso do usuário', () => {
    const own = makeAccount({ id: 'own_1', ownerId: userA.id, owner: userA, isJoint: false })
    const otherMember = makeAccount({ id: 'other_1', ownerId: userB.id, owner: userB, isJoint: false })
    const orphanIndividual = makeAccount({ id: 'orphan_1', ownerId: null, owner: null, isJoint: false })
    const accessibleJoint = makeAccount({
      id: 'joint_ok',
      ownerId: null,
      owner: null,
      isJoint: true,
      allowedMembers: [userA, userB],
    })
    const restrictedJoint = makeAccount({
      id: 'joint_denied',
      ownerId: null,
      owner: null,
      isJoint: true,
      allowedMembers: [userB, userC],
    })
    const emptyJoint = makeAccount({
      id: 'joint_empty',
      ownerId: null,
      owner: null,
      isJoint: true,
      allowedMembers: [],
    })
    const fallbackJoint = makeAccount({
      id: 'joint_fallback',
      ownerId: null,
      owner: null,
      isJoint: true,
      allowedMembers: undefined,
    })

    const all = [own, otherMember, orphanIndividual, accessibleJoint, restrictedJoint, emptyJoint, fallbackJoint]

    expect(filterTransferSourceAccounts(all, userA.id).map((a) => a.id)).toEqual([
      'own_1',
      'joint_ok',
      'joint_fallback',
    ])
    expect(filterTransferSourceAccounts(all, undefined)).toEqual([])
    expect(filterTransferSourceAccounts(all, '')).toEqual([])
  })

  it('pickTransferSourceAccountId evita selecionar a própria conta conjunta de destino ou conta de outro integrante como origem', () => {
    const joint = makeAccount({
      id: 'joint_1',
      ownerId: null,
      owner: null,
      isJoint: true,
      allowedMembers: [userA, userB],
    })
    const otherJoint = makeAccount({
      id: 'joint_2',
      ownerId: null,
      owner: null,
      isJoint: true,
      allowedMembers: [userA, userB],
    })
    const restrictedJoint = makeAccount({
      id: 'joint_restricted',
      ownerId: null,
      owner: null,
      isJoint: true,
      allowedMembers: [userB, userC],
    })
    const otherMember = makeAccount({ id: 'other_1', ownerId: userB.id, owner: userB, isJoint: false })
    const own = makeAccount({ id: 'own_1', ownerId: userA.id, owner: userA, isJoint: false })

    expect(pickTransferSourceAccountId([joint, otherJoint, otherMember, own], 'joint_1', userA.id)).toBe('own_1')
    expect(pickTransferSourceAccountId([joint, otherMember], 'joint_1', userA.id)).toBeUndefined()
    expect(
      pickTransferSourceAccountId([joint, otherMember, restrictedJoint, otherJoint], 'joint_1', userA.id),
    ).toBe('joint_2')
    expect(pickTransferSourceAccountId([joint], 'joint_1', userA.id)).toBeUndefined()
  })

  it('relatórios de grupo projetam saldo e despesas por responsável em conta conjunta', () => {
    const joint = makeAccount({
      id: 'joint_1',
      name: 'Conta da Casa',
      ownerId: null,
      owner: null,
      isJoint: true,
      balance: 200000,
    })
    const members: GroupMember[] = [
      { user: userA, role: 'OWNER', joinedAt: '2026-01-01T00:00:00Z' },
      { user: userB, role: 'MEMBER', joinedAt: '2026-01-01T00:00:00Z' },
    ]
    const txs: Transaction[] = [
      makeTx({
        id: 'tx_1',
        accountId: 'joint_1',
        responsibleId: userA.id,
        type: 'EXPENSE',
        amount: 60000,
        date: '2026-11-12',
        status: 'COMPLETED',
      }),
      makeTx({
        id: 'tx_2',
        accountId: 'joint_1',
        responsibleId: userB.id,
        type: 'EXPENSE',
        amount: 40000,
        date: '2026-11-20',
        status: 'PENDING',
      }),
      makeTx({
        id: 'tx_3',
        accountId: 'acc_personal_outside',
        destinationAccountId: 'joint_1',
        responsibleId: userB.id,
        type: 'TRANSFER',
        amount: 50000,
        date: '2026-11-25',
        status: 'PENDING',
      }),
    ]

    const memberExpenses = buildGroupMemberExpenses(txs, members, { month: 11, year: 2026 }, true)
    expect(memberExpenses.find((m) => m.memberId === userA.id)?.totalExpense).toBe(60000)
    expect(memberExpenses.find((m) => m.memberId === userB.id)?.totalExpense).toBe(40000)

    const refDate = new Date(2026, 10, 15) // 15/11/2026
    const projection = buildCalendarProjection([joint], txs, [], { month: 11, year: 2026 }, undefined, txs, [], [], refDate)
    // Saldo atual: 200.000; no dia 20 paga -40.000 (160.000); no dia 25 recebe aporte +50.000 (210.000)
    expect(projection.closing).toBe(210000)
  })
})
