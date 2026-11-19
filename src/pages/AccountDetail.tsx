import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowLeftRight, Pencil, Plus, Trash2, Users } from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import {
  useAccessibleAccounts,
  useAction,
  useAccountTransactions,
  useAllCategories,
  useGroup,
  useGroupJointAccounts,
  useJointAccountSummary,
} from '@/lib/hooks'
import { pickTransferSourceAccountId } from '@/lib/jointAccounts'
import type { TransactionType } from '@/lib/types'
import { accountTypeLabel, formatMoney, formatShortAccountLabel, fullName, initials } from '@/lib/format'
import { Badge, Button, Card, ConfirmDialog, DetailSkeleton, Empty, ListSkeleton, PageHeader, QueryState } from '@/components/ui'
import { MonthPicker, currentPeriod } from '@/components/MonthPicker'
import TransactionList from '@/components/TransactionList'
import TransactionFormModal from '@/components/TransactionFormModal'
import AccountFormModal from '@/components/AccountFormModal'
import JointAccountFormModal from '@/components/JointAccountFormModal'
import NotFound from './NotFound'

interface TxModalConfig {
  open: boolean
  defaultType?: TransactionType
  defaultAccountId?: string
  defaultDestinationAccountId?: string
  defaultAmount?: number
}

export default function AccountDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [period, setPeriod] = useState(currentPeriod())
  const [txModal, setTxModal] = useState<TxModalConfig>({ open: false })
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const nav = useNavigate()

  const accounts = useAccessibleAccounts()
  const account = accounts.data?.find((a) => a.id === id)
  const isJoint = Boolean(account?.isJoint)
  const groupId = account?.groupId ?? undefined

  const group = useGroup(isJoint ? groupId : undefined)
  const jointSummaryQuery = useJointAccountSummary(
    groupId,
    account?.id,
    period.month,
    period.year,
    Boolean(isJoint && groupId && account?.id),
  )
  const tx = useAccountTransactions(id, period.month, period.year)
  const cats = useAllCategories().data ?? []

  const isGroupAdmin = group.data?.myRole === 'OWNER' || group.data?.myRole === 'ADMIN'
  const jointAccountsQuery = useGroupJointAccounts(groupId, Boolean(isJoint && groupId && isGroupAdmin))
  const canManage = isJoint
    ? Boolean(groupId && isGroupAdmin)
    : Boolean(user?.id && account?.ownerId === user.id)
  const editableJointAccount =
    jointAccountsQuery.data?.find((ja) => ja.id === account?.id) ?? account

  const delIndividual = useAction(() => api.delete(`/accounts/${id}`), {
    invalidate: [['accounts'], ['total-balance'], ['transactions'], ['groups']],
    success: 'Conta excluída',
    onSuccess: () => nav('/contas'),
  })

  const delJoint = useAction(() => api.delete(`/groups/${groupId}/joint-accounts/${id}`), {
    invalidate: [
      ['accounts'],
      ['total-balance'],
      ['transactions'],
      ['groups'],
      ['groups', groupId, 'accounts'],
      ['groups', groupId, 'joint-accounts'],
    ],
    success: 'Conta conjunta excluída',
    onSuccess: () => nav(groupId ? `/grupos/${groupId}?tab=accounts` : '/grupos'),
  })

  const accountNames = useMemo(
    () => new Map((accounts.data ?? []).map((a) => [a.id, formatShortAccountLabel(a)])),
    [accounts.data],
  )

  if (accounts.isLoading) return <DetailSkeleton />
  if (!account) {
    return (
      <NotFound
        title="Conta não encontrada"
        description="Esta conta bancária não existe, foi excluída ou você não tem acesso a ela."
        backTo="/contas"
        backLabel="Minhas contas"
      />
    )
  }

  const items = (tx.data ?? []).filter((t) => !t.creditCardId)
  const income = items
    .filter((t) => t.type === 'INCOME' || (t.type === 'TRANSFER' && t.destinationAccountId === id))
    .reduce((s, t) => s + t.amount, 0)
  const expense = items
    .filter((t) => t.type === 'EXPENSE' || (t.type === 'TRANSFER' && t.accountId === id))
    .reduce((s, t) => s + t.amount, 0)

  const backTo = isJoint && groupId ? `/grupos/${groupId}?tab=accounts` : '/contas'
  const backLabel = isJoint ? (group.data?.name ?? 'Grupo') : 'Contas'

  const openContributeModal = (suggestedMissingAmount?: number) => {
    const sourceId = pickTransferSourceAccountId(accounts.data ?? [], account.id, user?.id)
    setTxModal({
      open: true,
      defaultType: 'TRANSFER',
      defaultAccountId: sourceId,
      defaultDestinationAccountId: account.id,
      defaultAmount: suggestedMissingAmount && suggestedMissingAmount > 0 ? suggestedMissingAmount : undefined,
    })
  }

  const summary = jointSummaryQuery.data
  const sharePerMember =
    summary?.memberShares[0]?.shareAmount ??
    (summary && summary.memberCount > 0 ? Math.round(summary.totalExpenses / summary.memberCount) : 0)

  return (
    <>
      <PageHeader
        back={
          <Link to={backTo} className="mb-1 inline-flex items-center gap-1 text-xs text-text-dim hover:text-white transition">
            <ArrowLeft className="size-3" /> {backLabel}
          </Link>
        }
        title={account.name}
        subtitle={
          <div className="flex flex-wrap items-center gap-2">
            <span>{accountTypeLabel[account.type]}</span>
            {isJoint && <Badge tone="primary">Conta Conjunta</Badge>}
            {isJoint && groupId && (
              <Link
                to={`/grupos/${groupId}?tab=accounts`}
                className="inline-flex items-center gap-1 text-xs font-medium text-violet-hover hover:text-lime transition"
              >
                <Users className="size-3" />
                {group.data?.name ?? 'Ver grupo'}
              </Link>
            )}
          </div>
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setTxModal({ open: true, defaultAccountId: id })}>
              <Plus className="size-4" /> Nova
            </Button>
            {canManage && (
              <>
                <Button variant="outline" onClick={() => setEditing(true)} aria-label="Editar conta">
                  <Pencil className="size-4" /> Editar
                </Button>
                <Button variant="danger" onClick={() => setDeleting(true)} aria-label="Excluir conta">
                  <Trash2 className="size-4" />
                </Button>
              </>
            )}
          </div>
        }
      />

      <Card className="mb-4 p-4">
        <p className="text-xs text-text-dim">Saldo atual</p>
        <p
          className={clsx(
            'text-3xl font-bold tracking-tight tabular-nums',
            account.balance < 0 ? 'text-expense' : 'text-white',
          )}
        >
          {formatMoney(account.balance)}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
          <div>
            <p className="text-xs text-text-dim">Entradas no mês</p>
            <p className="font-semibold text-lime tabular-nums">{formatMoney(income)}</p>
          </div>
          <div>
            <p className="text-xs text-text-dim">Saídas no mês</p>
            <p className="font-semibold text-expense tabular-nums">−{formatMoney(expense)}</p>
          </div>
        </div>
      </Card>

      <div className="mb-4">
        <MonthPicker value={period} onChange={setPeriod} />
      </div>

      {isJoint && groupId && (
        <Card className="mb-5 p-4 border-violet/35 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-violet-hover shrink-0" />
              <h2 className="text-base font-semibold text-white">Divisão entre Membros (Rateio do Mês)</h2>
            </div>
            <Button size="sm" variant="outline" onClick={() => openContributeModal()}>
              <ArrowLeftRight className="size-3.5" /> Aportar na conta
            </Button>
          </div>

          <QueryState
            isLoading={jointSummaryQuery.isLoading}
            error={jointSummaryQuery.error}
            skeleton={<ListSkeleton rows={3} />}
          >
            {summary && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border bg-surface-2/60 p-3">
                    <p className="text-xs text-text-dim">Total de despesas</p>
                    <p className="mt-1 text-lg font-bold text-expense tabular-nums">
                      −{formatMoney(summary.totalExpenses)}
                    </p>
                    {summary.pendingExpenses > 0 && (
                      <p className="mt-1 text-xs text-text-dim tabular-nums">
                        {formatMoney(summary.completedExpenses)} pagas · {formatMoney(summary.pendingExpenses)} pendentes
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-border bg-surface-2/60 p-3">
                    <p className="text-xs text-text-dim">Total aportado (transferências)</p>
                    <p className="mt-1 text-lg font-bold text-lime tabular-nums">
                      +{formatMoney(summary.totalContributions)}
                    </p>
                    {summary.totalIncome > 0 && (
                      <p className="mt-1 text-xs text-text-dim tabular-nums">
                        Outras receitas: {formatMoney(summary.totalIncome)}
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-border bg-surface-2/60 p-3">
                    <p className="text-xs text-text-dim">Cota por membro</p>
                    <p className="mt-1 text-lg font-bold text-white tabular-nums">
                      {formatMoney(sharePerMember)}
                    </p>
                    <p className="mt-1 text-xs text-text-dim tabular-nums">
                      {summary.memberCount} {summary.memberCount === 1 ? 'membro com acesso' : 'membros com acesso'}
                    </p>
                  </div>
                </div>

                {summary.memberShares.length === 0 ? (
                  <Empty title="Nenhum membro com acesso para rateio neste mês." />
                ) : (
                  <ul className="divide-y divide-border rounded-xl border border-border bg-surface-2/25 overflow-hidden">
                    {summary.memberShares.map((share) => {
                      const isMe = share.user.id === user?.id
                      const isPositive = share.netBalance > 0
                      const isZero = share.netBalance === 0
                      const missing = share.netBalance < 0 ? Math.abs(share.netBalance) : 0

                      return (
                        <li key={share.user.id} className="p-3.5 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-violet/20 text-xs font-bold text-violet-hover">
                                {initials(share.user)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-white">
                                  {fullName(share.user)}
                                  {isMe && (
                                    <span className="ml-1.5 text-xs font-normal text-text-dim">(Você)</span>
                                  )}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {isPositive ? (
                                <Badge tone="income">Aportou a mais (+{formatMoney(share.netBalance)})</Badge>
                              ) : isZero ? (
                                <Badge tone="income">Em dia</Badge>
                              ) : (
                                <Badge tone="expense">Falta aportar {formatMoney(missing)}</Badge>
                              )}

                              <Button
                                size="sm"
                                variant={missing > 0 && isMe ? 'lime' : 'outline'}
                                onClick={() => openContributeModal(missing > 0 ? missing : undefined)}
                              >
                                <ArrowLeftRight className="size-3.5" /> Aportar na conta
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-4">
                            <div className="rounded-lg bg-surface-1/80 px-2.5 py-2 border border-border/60">
                              <p className="text-xs text-text-dim">Cota de despesas</p>
                              <p className="mt-0.5 font-semibold text-white tabular-nums">
                                {formatMoney(share.shareAmount)}
                              </p>
                            </div>
                            <div className="rounded-lg bg-surface-1/80 px-2.5 py-2 border border-border/60">
                              <p className="text-xs text-text-dim">Aportado no mês</p>
                              <p className="mt-0.5 font-semibold text-lime tabular-nums">
                                {formatMoney(share.contributedAmount)}
                              </p>
                            </div>
                            <div className="rounded-lg bg-surface-1/80 px-2.5 py-2 border border-border/60">
                              <p className="text-xs text-text-dim">Despesas lançadas</p>
                              <p className="mt-0.5 font-semibold text-white tabular-nums">
                                {formatMoney(share.launchedExpensesAmount)}
                              </p>
                            </div>
                            <div className="rounded-lg bg-surface-1/80 px-2.5 py-2 border border-border/60">
                              <p className="text-xs text-text-dim">Saldo no rateio</p>
                              <p
                                className={clsx(
                                  'mt-0.5 font-semibold tabular-nums',
                                  share.netBalance >= 0 ? 'text-lime' : 'text-expense',
                                )}
                              >
                                {share.netBalance > 0 ? '+' : share.netBalance < 0 ? '−' : ''}
                                {formatMoney(Math.abs(share.netBalance))}
                              </p>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}
          </QueryState>
        </Card>
      )}

      <QueryState isLoading={tx.isLoading} error={tx.error}>
        <TransactionList
          items={items}
          categories={cats}
          accountId={id}
          accountNames={isJoint ? accountNames : undefined}
        />
      </QueryState>

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title={isJoint ? 'Excluir conta conjunta' : 'Excluir conta'}
        confirmLabel="Excluir"
        loading={isJoint ? delJoint.isPending : delIndividual.isPending}
        message={
          isJoint
            ? `Excluir a conta conjunta "${account.name}"? Todas as transações associadas serão removidas e essa ação não pode ser desfeita.`
            : `Excluir "${account.name}"? Todas as transações dessa conta serão removidas e essa ação não pode ser desfeita.`
        }
        onConfirm={() => (isJoint ? delJoint.mutate() : delIndividual.mutate())}
      />

      <TransactionFormModal
        open={txModal.open}
        onClose={() => setTxModal({ open: false })}
        defaultAccountId={txModal.defaultAccountId}
        defaultType={txModal.defaultType}
        defaultDestinationAccountId={txModal.defaultDestinationAccountId}
        defaultAmount={txModal.defaultAmount}
      />

      {!isJoint && (
        <AccountFormModal open={editing} onClose={() => setEditing(false)} account={account} />
      )}

      {isJoint && groupId && (
        <JointAccountFormModal
          open={editing}
          onClose={() => setEditing(false)}
          groupId={groupId}
          members={group.data?.members ?? []}
          account={editableJointAccount}
        />
      )}
    </>
  )
}
