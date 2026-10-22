import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import {
  ArrowDownCircle,
  ArrowLeft,
  ArrowUpCircle,
  Check,
  ChevronRight,
  CreditCard as CardIcon,
  Eye,
  EyeOff,
  LogOut,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import clsx from 'clsx'
import { api } from '@/lib/api'
import {
  useAction,
  useGroup,
  useGroupAccountRequests,
  useGroupAccounts,
  useGroupCategories,
  useGroupCreditCardRequests,
  useGroupCreditCards,
} from '@/lib/hooks'
import { useAuth } from '@/lib/auth'
import type { CreditCardInvoice, GroupMember, GroupRole, Transaction, TransactionStatus, TransactionType, UserSummary } from '@/lib/types'
import { accountTypeLabel, formatDate, formatMoney, fullName, initials, roleLabel, txTypeLabel } from '@/lib/format'
import { Badge, Button, Card, ConfirmDialog, Empty, Field, Input, ListSkeleton, Modal, PageHeader, QueryState, Select, Spinner, Tabs } from '@/components/ui'
import { MonthPicker, currentPeriod } from '@/components/MonthPicker'
import CategoryManager from '@/components/CategoryManager'
import TransactionList from '@/components/TransactionList'
import TransactionFormModal from '@/components/TransactionFormModal'

const PALETTE = ['#6366f1', '#f87171', '#34d399', '#fbbf24', '#38bdf8', '#e879f9', '#fb923c', '#a3e635']

type Tab = 'overview' | 'transactions' | 'members' | 'accounts' | 'cards' | 'categories' | 'requests' | 'settings'

interface TxFilters {
  search: string
  accountId: string
  creditCardId: string
  categoryId: string
  responsibleId: string
  type: '' | TransactionType
  status: '' | TransactionStatus
  recurring: boolean
}
const EMPTY_TX_FILTERS: TxFilters = {
  search: '',
  accountId: '',
  creditCardId: '',
  categoryId: '',
  responsibleId: '',
  type: '',
  status: '',
  recurring: false,
}

const chip = (active: boolean) =>
  clsx(
    'rounded-full border px-3 py-1.5 text-xs font-medium transition',
    active ? 'border-primary bg-primary/20 text-primary-hover' : 'border-border text-muted hover:text-text',
  )

export default function GroupDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('overview')
  const [period, setPeriod] = useState(currentPeriod())
  const [ignored, setIgnored] = useState<string[]>([])
  const [txFilters, setTxFilters] = useState<TxFilters>(EMPTY_TX_FILTERS)
  const [showTxFilters, setShowTxFilters] = useState(false)
  const [addingTx, setAddingTx] = useState(false)
  const setTxF = <K extends keyof TxFilters>(k: K, v: TxFilters[K]) => setTxFilters((p) => ({ ...p, [k]: v }))
  const toggleIgnore = (accId: string) =>
    setIgnored((p) => (p.includes(accId) ? p.filter((x) => x !== accId) : [...p, accId]))

  const group = useGroup(id)
  const g = group.data
  const isOwner = g?.myRole === 'OWNER'
  const isAdmin = isOwner || g?.myRole === 'ADMIN'
  const needsEcosystemData = tab === 'overview' || tab === 'transactions'
  const accounts = useGroupAccounts(tab === 'accounts' || needsEcosystemData ? id : undefined)
  const cards = useGroupCreditCards(tab === 'cards' || needsEcosystemData ? id : undefined)
  const categories = useGroupCategories(tab === 'categories' || needsEcosystemData ? id : undefined)
  const groupCategories = categories.data ?? []
  const groupCategoryIds = useMemo(() => new Set(groupCategories.map((c) => c.id)), [groupCategories])
  const requests = useGroupAccountRequests(id, isAdmin)
  const cardRequests = useGroupCreditCardRequests(id, isAdmin)

  const txAccountQueries = useQueries({
    queries: needsEcosystemData
      ? (accounts.data ?? []).map((a) => ({
          queryKey: ['transactions', 'account', a.id, period.month, period.year],
          queryFn: () => api.get<Transaction[]>(`/transactions/account/${a.id}`, { params: period }).then((r) => r.data),
        }))
      : [],
  })

  const txCardQueries = useQueries({
    queries: needsEcosystemData
      ? (cards.data ?? []).map((c) => ({
          queryKey: ['credit-cards', c.id, 'invoice', period.month, period.year],
          queryFn: () =>
            api.get<CreditCardInvoice>(`/credit-cards/${c.id}/invoice`, { params: period }).then((r) => r.data),
        }))
      : [],
  })

  const txLoading =
    accounts.isLoading ||
    cards.isLoading ||
    categories.isLoading ||
    txAccountQueries.some((q) => q.isLoading) ||
    txCardQueries.some((q) => q.isLoading)

  const invStamp = txCardQueries.map((q) => q.dataUpdatedAt).join(',')

  const allGroupTransactions = useMemo(() => {
    if (categories.isLoading) return []
    const isAllowedInGroup = (t: Transaction) => !t.categoryId || groupCategoryIds.has(t.categoryId)
    const map = new Map<string, Transaction>()
    txAccountQueries.forEach((q) =>
      q.data?.forEach((t) => {
        if (isAllowedInGroup(t)) map.set(t.id, t)
      }),
    )
    txCardQueries.forEach((q) =>
      q.data?.transactions?.forEach((t) => {
        if (isAllowedInGroup(t)) map.set(t.id, t)
      }),
    )
    return [...map.values()]
  }, [txAccountQueries, txCardQueries, groupCategoryIds, categories.isLoading])

  const groupSummary = useMemo(() => {
    const activeAccounts = (accounts.data ?? []).filter((a) => !ignored.includes(a.id))
    const activeIds = new Set(activeAccounts.map((a) => a.id))
    const currentBalance = activeAccounts.reduce((s, a) => s + a.balance, 0)

    let realizedIncome = 0
    let pendingIncome = 0
    let realizedExpense = 0
    let pendingExpense = 0
    let pendingTransferDelta = 0

    allGroupTransactions.forEach((t) => {
      if (t.creditCardId) return
      if (t.type === 'INCOME' && activeIds.has(t.accountId)) {
        if (t.status === 'COMPLETED') realizedIncome += t.amount
        else pendingIncome += t.amount
      } else if (t.type === 'EXPENSE' && activeIds.has(t.accountId)) {
        if (t.status === 'COMPLETED') realizedExpense += t.amount
        else pendingExpense += t.amount
      } else if (t.type === 'TRANSFER' && t.status === 'PENDING') {
        if (activeIds.has(t.accountId)) pendingTransferDelta -= t.amount
        if (t.destinationAccountId && activeIds.has(t.destinationAccountId)) pendingTransferDelta += t.amount
      }
    })

    let unpaidCardInvoices = 0
    const cardList = cards.data ?? []
    txCardQueries.forEach((iq, idx) => {
      const inv = iq.data
      const card = cardList[idx]
      if (!inv || !card) return
      if (ignored.includes(card.accountId)) return
      const groupInvoiceTotal = (inv.transactions ?? [])
        .filter((t) => !t.categoryId || groupCategoryIds.has(t.categoryId))
        .reduce((s, t) => s + t.amount, 0)
      unpaidCardInvoices += Math.min(Math.max(0, inv.remainingAmount ?? 0), groupInvoiceTotal)
    })

    const projectedIncome = realizedIncome + pendingIncome
    const projectedExpense = realizedExpense + pendingExpense + unpaidCardInvoices
    const projectedBalance = currentBalance + pendingIncome - pendingExpense - unpaidCardInvoices + pendingTransferDelta

    return {
      currentBalance,
      projectedBalance,
      realizedIncome,
      projectedIncome,
      realizedExpense,
      projectedExpense,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.data, cards.data, ignored, allGroupTransactions, groupCategoryIds, invStamp])

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    allGroupTransactions
      .filter((t) => t.type === 'EXPENSE')
      .forEach((t) => {
        const k = t.categoryId ?? 'none'
        map.set(k, (map.get(k) ?? 0) + t.amount)
      })
    return [...map.entries()]
      .map(([catId, value], i) => {
        const c = groupCategories.find((cat) => cat.id === catId)
        return { name: c?.name ?? 'Sem categoria', value, color: c?.color ?? PALETTE[i % PALETTE.length] }
      })
      .sort((a, b) => b.value - a.value)
  }, [allGroupTransactions, groupCategories])

  const upcoming = useMemo(
    () =>
      allGroupTransactions
        .filter((t) => t.status === 'PENDING')
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 5),
    [allGroupTransactions],
  )

  const groupResponsibles = useMemo(() => {
    const map = new Map<string, UserSummary>()
    ;(g?.members ?? []).forEach((m) => map.set(m.user.id, m.user))
    ;(accounts.data ?? []).forEach((a) => {
      if (a.owner) map.set(a.owner.id, a.owner)
    })
    ;(cards.data ?? []).forEach((c) => {
      if (c.owner) map.set(c.owner.id, c.owner)
    })
    allGroupTransactions.forEach((t) => {
      if (t.responsible) map.set(t.responsible.id, t.responsible)
    })
    return [...map.values()].sort((a, b) => {
      if (a.id === user?.id) return -1
      if (b.id === user?.id) return 1
      return fullName(a).localeCompare(fullName(b), 'pt-BR')
    })
  }, [g?.members, accounts.data, cards.data, allGroupTransactions, user?.id])

  const filteredTransactions = useMemo(() => {
    const term = txFilters.search.trim().toLowerCase()
    return allGroupTransactions.filter(
      (t) =>
        (!term || t.title.toLowerCase().includes(term)) &&
        (!txFilters.accountId || t.accountId === txFilters.accountId || t.destinationAccountId === txFilters.accountId) &&
        (!txFilters.creditCardId || t.creditCardId === txFilters.creditCardId) &&
        (!txFilters.categoryId ||
          (txFilters.categoryId === 'none' ? !t.categoryId : t.categoryId === txFilters.categoryId)) &&
        (!txFilters.responsibleId || t.responsibleId === txFilters.responsibleId) &&
        (!txFilters.type || t.type === txFilters.type) &&
        (!txFilters.status || t.status === txFilters.status) &&
        (!txFilters.recurring || !!t.recurrenceGroupId),
    )
  }, [allGroupTransactions, txFilters])

  const txIncome = filteredTransactions.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0)
  const txExpense = filteredTransactions.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0)
  const activeTxFilterCount = [
    txFilters.accountId,
    txFilters.creditCardId,
    txFilters.categoryId,
    txFilters.responsibleId,
    txFilters.type,
    txFilters.status,
    txFilters.recurring,
  ].filter(Boolean).length

  const accountNames = useMemo(
    () => new Map((accounts.data ?? []).map((a) => [a.id, `${a.name} (${fullName(a.owner)})`])),
    [accounts.data],
  )
  const cardNames = useMemo(() => new Map((cards.data ?? []).map((c) => [c.id, c.name])), [cards.data])

  const [inviting, setInviting] = useState(false)
  const [email, setEmail] = useState('')
  const [removing, setRemoving] = useState<GroupMember>()
  const [confirm, setConfirm] = useState<'leave' | 'delete'>()
  const [renameTo, setRenameTo] = useState<string>()
  const [transferTo, setTransferTo] = useState('')

  const inv = [['groups'], ['groups', id]]
  const invite = useAction((e: string) => api.post(`/groups/${id}/invitations`, { inviteeEmail: e }), {
    success: 'Convite enviado',
    onSuccess: () => {
      setInviting(false)
      setEmail('')
    },
  })
  const setRole = useAction(
    ({ email, role }: { email: string; role: GroupRole }) => api.patch(`/groups/${id}/members/role`, { email, role }),
    { invalidate: inv, success: 'Papel atualizado' },
  )
  const remove = useAction((email: string) => api.delete(`/groups/${id}/members`, { params: { email } }), {
    invalidate: inv,
    success: 'Membro removido',
    onSuccess: () => setRemoving(undefined),
  })
  const rename = useAction((name: string) => api.put(`/groups/${id}`, { name }), { invalidate: inv, success: 'Grupo renomeado' })
  const transfer = useAction((newOwnerEmail: string) => api.patch(`/groups/${id}/transfer`, { newOwnerEmail }), {
    invalidate: inv,
    success: 'Propriedade transferida',
    onSuccess: () => setTransferTo(''),
  })
  const leave = useAction(() => api.delete(`/groups/${id}/leave`), {
    invalidate: [['groups']],
    success: 'Você saiu do grupo',
    onSuccess: () => nav('/grupos'),
  })
  const del = useAction(() => api.delete(`/groups/${id}`), {
    invalidate: [['groups']],
    success: 'Grupo excluído',
    onSuccess: () => nav('/grupos'),
  })

  const decideAccount = (verb: 'accept' | 'reject') =>
    useAction((rid: string) => api.post(`/groups/${id}/account-requests/${rid}/${verb}`), {
      invalidate: [['groups', id], ['accounts']],
      success: verb === 'accept' ? 'Solicitação aceita' : 'Solicitação recusada',
    })
  const acceptReq = decideAccount('accept')
  const rejectReq = decideAccount('reject')

  const decideCard = (verb: 'accept' | 'reject') =>
    useAction((rid: string) => api.post(`/groups/${id}/credit-card-requests/${rid}/${verb}`), {
      invalidate: [['groups', id], ['credit-cards']],
      success: verb === 'accept' ? 'Cartão vinculado ao grupo' : 'Solicitação recusada',
    })
  const acceptCardReq = decideCard('accept')
  const rejectCardReq = decideCard('reject')

  const canManage = (m: GroupMember) =>
    isAdmin && m.role !== 'OWNER' && m.user.id !== user?.id && (isOwner || m.role === 'MEMBER')

  const pendingReqCount = (requests.data?.length ?? 0) + (cardRequests.data?.length ?? 0)

  return (
    <QueryState isLoading={group.isLoading} error={group.error}>
      {g && (
        <>
          <PageHeader
            back={
              <Link to="/grupos" className="mb-1 inline-flex items-center gap-1 text-xs text-muted hover:text-text">
                <ArrowLeft className="size-3" /> Grupos
              </Link>
            }
            title={g.name}
            subtitle={`${g.memberCount} membros · você é ${roleLabel[g.myRole].toLowerCase()}`}
            action={
              <div className="flex gap-2">
                {isAdmin && (
                  <Button onClick={() => setInviting(true)}>
                    <UserPlus className="size-4" /> Convidar
                  </Button>
                )}
                {isOwner && (
                  <Button variant="danger" onClick={() => setConfirm('delete')} aria-label="Excluir grupo">
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            }
          />
          <div className="mb-4">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { key: 'overview', label: 'Resumo' },
                { key: 'transactions', label: 'Transações' },
                { key: 'members', label: 'Membros' },
                { key: 'accounts', label: 'Contas' },
                { key: 'cards', label: 'Cartões' },
                { key: 'categories', label: 'Categorias' },
                ...(isAdmin ? [{ key: 'requests' as const, label: 'Solicitações', badge: pendingReqCount }] : []),
                { key: 'settings', label: 'Ajustes' },
              ]}
            />
          </div>

          {tab === 'overview' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <MonthPicker value={period} onChange={setPeriod} />
                {((accounts.data?.length ?? 0) > 0 || (cards.data?.length ?? 0) > 0) && (
                  <Button size="sm" className="h-10" onClick={() => setAddingTx(true)}>
                    <Plus className="size-4" /> Nova transação
                  </Button>
                )}
              </div>

              <Card className="bg-gradient-to-br from-primary/25 to-surface p-5">
                <div className="grid grid-cols-2 gap-4 border-b border-border/60 pb-4">
                  <div>
                    <p className="text-xs text-muted">Saldo total do grupo</p>
                    <p className="mt-0.5 text-2xl font-bold sm:text-3xl">
                      {!accounts.isLoading ? formatMoney(groupSummary.currentBalance) : '—'}
                    </p>
                  </div>
                  <div className="border-l border-border/60 pl-4">
                    <p className="text-xs text-muted">Saldo projetado</p>
                    <p
                      className={`mt-0.5 text-2xl font-bold sm:text-3xl ${groupSummary.projectedBalance < 0 ? 'text-expense' : 'text-primary-hover'}`}
                    >
                      {!accounts.isLoading ? formatMoney(groupSummary.projectedBalance) : '—'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ArrowUpCircle className="size-7 shrink-0 text-income" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted">Receitas</p>
                        <p className="truncate font-semibold text-income">{formatMoney(groupSummary.realizedIncome)}</p>
                      </div>
                    </div>
                    <div className="rounded-lg bg-surface/60 px-2.5 py-1.5">
                      <p className="text-[11px] text-muted">Receitas projetadas</p>
                      <p className="text-sm font-semibold text-income/90">{formatMoney(groupSummary.projectedIncome)}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ArrowDownCircle className="size-7 shrink-0 text-expense" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted">Despesas</p>
                        <p className="truncate font-semibold text-expense">
                          {formatMoney(groupSummary.realizedExpense)}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-lg bg-surface/60 px-2.5 py-1.5">
                      <p className="text-[11px] text-muted">Despesas projetadas</p>
                      <p className="text-sm font-semibold text-expense/90">
                        {formatMoney(groupSummary.projectedExpense)}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card
                  onClick={() => setTab('accounts')}
                  className="cursor-pointer p-4 transition hover:border-primary/40"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setTab('accounts')
                      }}
                      className="inline-flex items-center gap-1 font-semibold hover:text-primary-hover"
                    >
                      Contas do grupo <ChevronRight className="size-4 text-muted" />
                    </button>
                  </div>
                  <p className="mb-3 text-xs text-muted">Toque no olho para ignorar uma conta do saldo total.</p>
                  {accounts.isLoading ? (
                    <Spinner />
                  ) : !accounts.data?.length ? (
                    <Empty title="Sem contas vinculadas ao grupo." />
                  ) : (
                    <ul className="divide-y divide-border">
                      {accounts.data.map((a) => (
                        <li key={a.id} className="flex items-center gap-2 py-2.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleIgnore(a.id)
                            }}
                            className="p-1 text-muted hover:text-text"
                            aria-label="Ignorar no saldo"
                          >
                            {ignored.includes(a.id) ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                          <Link
                            to={`/contas/${a.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className={`flex flex-1 items-center justify-between hover:text-primary-hover ${ignored.includes(a.id) ? 'opacity-40' : ''}`}
                          >
                            <div className="min-w-0">
                              <span className="block truncate text-sm">{a.name}</span>
                              <span className="block truncate text-xs text-muted">{fullName(a.owner)}</span>
                            </div>
                            <span className={`text-sm font-semibold ${a.balance < 0 ? 'text-expense' : ''}`}>
                              {formatMoney(a.balance)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card className="p-4">
                  <h2 className="mb-3 font-semibold">Despesas por categoria</h2>
                  {txLoading ? (
                    <Spinner />
                  ) : !byCategory.length ? (
                    <Empty title="Sem despesas no período." />
                  ) : (
                    <>
                      <div className="h-44">
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie data={byCategory} dataKey="value" innerRadius={45} outerRadius={75} stroke="none">
                              {byCategory.map((c, i) => (
                                <Cell key={i} fill={c.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(v) => formatMoney(Number(v))}
                              contentStyle={{
                                background: '#1a2233',
                                border: '1px solid #263047',
                                borderRadius: 12,
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <ul className="mt-2 space-y-1.5">
                        {byCategory.slice(0, 5).map((c, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                            {c.name}
                            <span className="ml-auto font-medium">{formatMoney(c.value)}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </Card>
              </div>

              <Card onClick={() => setTab('cards')} className="cursor-pointer p-4 transition hover:border-primary/40">
                <div className="mb-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setTab('cards')
                    }}
                    className="inline-flex items-center gap-1 font-semibold hover:text-primary-hover"
                  >
                    Cartões de crédito <ChevronRight className="size-4 text-muted" />
                  </button>
                </div>
                {cards.isLoading ? (
                  <Spinner />
                ) : !cards.data?.length ? (
                  <Empty title="Sem cartões de crédito vinculados ao grupo." />
                ) : (
                  <ul className="divide-y divide-border">
                    {cards.data.map((c) => (
                      <li key={c.id} className="py-2.5">
                        <Link
                          to={`/cartoes/${c.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-between text-sm hover:text-primary-hover"
                        >
                          <div>
                            <p className="font-medium">
                              {c.name}
                              {c.owner ? <span className="text-xs font-normal text-muted"> · {fullName(c.owner)}</span> : null}
                            </p>
                            <p className="text-xs text-muted">
                              Disponível: <span className="text-income">{formatMoney(c.availableLimit)}</span> · Vence
                              dia {c.dueDay}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted">Fatura atual</p>
                            <p className="font-semibold text-expense">{formatMoney(c.currentInvoiceAmount)}</p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-semibold">Próximas pendentes</h2>
                  {upcoming.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTab('transactions')}
                      className="text-xs font-medium text-primary-hover hover:underline"
                    >
                      Ver todas
                    </button>
                  )}
                </div>
                {txLoading ? (
                  <Spinner />
                ) : !upcoming.length ? (
                  <Empty title="Nada pendente neste mês 🎉" />
                ) : (
                  <ul className="divide-y divide-border">
                    {upcoming.map((t) => (
                      <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                        <div>
                          <p className="font-medium">{t.title}</p>
                          <p className="text-xs text-muted">
                            {formatDate(t.date)}
                            {accountNames.get(t.accountId) ? ` · ${accountNames.get(t.accountId)}` : ''}
                          </p>
                        </div>
                        <span
                          className={
                            t.type === 'INCOME'
                              ? 'font-semibold text-income'
                              : t.type === 'EXPENSE'
                                ? 'font-semibold text-expense'
                                : 'font-semibold'
                          }
                        >
                          {formatMoney(t.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          )}

          {tab === 'transactions' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <MonthPicker value={period} onChange={setPeriod} />
                  <Button variant="outline" size="sm" className="h-10" onClick={() => setShowTxFilters((v) => !v)}>
                    <SlidersHorizontal className="size-4" /> Filtros
                    {activeTxFilterCount > 0 && (
                      <span className="rounded-full bg-primary px-1.5 text-[11px] text-white">
                        {activeTxFilterCount}
                      </span>
                    )}
                  </Button>
                </div>
                {((accounts.data?.length ?? 0) > 0 || (cards.data?.length ?? 0) > 0) && (
                  <Button size="sm" className="h-10" onClick={() => setAddingTx(true)}>
                    <Plus className="size-4" /> Nova transação
                  </Button>
                )}
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por título…"
                  value={txFilters.search}
                  onChange={(e) => setTxF('search', e.target.value)}
                />
              </div>

              {showTxFilters && (
                <Card className="space-y-4 p-4">
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted">Tipo</p>
                    <div className="flex flex-wrap gap-2">
                      <button className={chip(txFilters.type === '')} onClick={() => setTxF('type', '')}>
                        Todos
                      </button>
                      {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((t) => (
                        <button key={t} className={chip(txFilters.type === t)} onClick={() => setTxF('type', t)}>
                          {txTypeLabel[t]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted">Situação</p>
                    <div className="flex flex-wrap gap-2">
                      <button className={chip(txFilters.status === '')} onClick={() => setTxF('status', '')}>
                        Todas
                      </button>
                      <button
                        className={chip(txFilters.status === 'PENDING')}
                        onClick={() => setTxF('status', 'PENDING')}
                      >
                        Pendentes
                      </button>
                      <button
                        className={chip(txFilters.status === 'COMPLETED')}
                        onClick={() => setTxF('status', 'COMPLETED')}
                      >
                        Concluídas
                      </button>
                      <button
                        className={chip(txFilters.recurring)}
                        onClick={() => setTxF('recurring', !txFilters.recurring)}
                      >
                        Recorrentes
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Conta do grupo">
                      <Select value={txFilters.accountId} onChange={(e) => setTxF('accountId', e.target.value)}>
                        <option value="">Todas as contas</option>
                        {accounts.data?.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({fullName(a.owner)})
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Cartão do grupo">
                      <Select value={txFilters.creditCardId} onChange={(e) => setTxF('creditCardId', e.target.value)}>
                        <option value="">Todos (contas e cartões)</option>
                        {cards.data?.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Categoria">
                      <Select value={txFilters.categoryId} onChange={(e) => setTxF('categoryId', e.target.value)}>
                        <option value="">Todas as categorias do grupo</option>
                        <option value="none">Sem categoria</option>
                        {groupCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Responsável">
                      <Select value={txFilters.responsibleId} onChange={(e) => setTxF('responsibleId', e.target.value)}>
                        <option value="">Todos os responsáveis</option>
                        {groupResponsibles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {fullName(r)}
                            {r.id === user?.id ? ' (Você)' : ''}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  {activeTxFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTxFilters((p) => ({ ...EMPTY_TX_FILTERS, search: p.search }))}
                    >
                      <X className="size-4" /> Limpar filtros
                    </Button>
                  )}
                </Card>
              )}

              <Card className="grid grid-cols-3 divide-x divide-border text-center">
                <div className="p-3">
                  <p className="text-xs text-muted">Receitas</p>
                  <p className="text-sm font-semibold text-income">{formatMoney(txIncome)}</p>
                </div>
                <div className="p-3">
                  <p className="text-xs text-muted">Despesas</p>
                  <p className="text-sm font-semibold text-expense">{formatMoney(txExpense)}</p>
                </div>
                <div className="p-3">
                  <p className="text-xs text-muted">Resultado</p>
                  <p className={clsx('text-sm font-semibold', txIncome - txExpense < 0 && 'text-expense')}>
                    {formatMoney(txIncome - txExpense)}
                  </p>
                </div>
              </Card>

              {txLoading ? (
                <ListSkeleton rows={4} />
              ) : (accounts.data?.length ?? 0) === 0 && (cards.data?.length ?? 0) === 0 ? (
                <Empty title="Vincule uma conta ou cartão ao grupo para visualizar transações." />
              ) : !filteredTransactions.length ? (
                <Empty
                  title={
                    allGroupTransactions.length
                      ? 'Nenhuma transação encontrada com esses filtros.'
                      : 'Nenhuma transação registrada no grupo neste mês.'
                  }
                />
              ) : (
                <TransactionList
                  items={filteredTransactions}
                  categories={groupCategories}
                  groupByDay
                  accountNames={accountNames}
                  cardNames={cardNames}
                  accountId={txFilters.accountId || undefined}
                />
              )}
            </div>
          )}

          {tab === 'members' && (
            <Card className="divide-y divide-border">
              {g.members.map((m) => (
                <div key={m.user.id} className="flex items-center gap-3 p-3">
                  <div className="grid size-10 place-items-center rounded-full bg-primary/20 text-xs font-bold text-primary-hover">
                    {initials(m.user)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{fullName(m.user)}</p>
                    <p className="truncate text-xs text-muted">{m.user.email}</p>
                  </div>
                  {canManage(m) && isOwner ? (
                    <Select
                      className="!h-9 !w-28 text-xs"
                      value={m.role}
                      onChange={(e) => setRole.mutate({ email: m.user.email, role: e.target.value as GroupRole })}
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="MEMBER">Membro</option>
                    </Select>
                  ) : (
                    <Badge tone={m.role === 'OWNER' ? 'primary' : 'default'}>{roleLabel[m.role]}</Badge>
                  )}
                  {canManage(m) && (
                    <button
                      onClick={() => setRemoving(m)}
                      className="p-1.5 text-muted hover:text-expense"
                      aria-label="Remover"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </Card>
          )}

          {tab === 'accounts' && (
            <QueryState isLoading={accounts.isLoading} error={accounts.error}>
              {!accounts.data?.length ? (
                <Empty title="Nenhuma conta vinculada. Vincule pela tela de Contas." />
              ) : (
                <Card className="divide-y divide-border">
                  {accounts.data.map((a) => (
                    <Link key={a.id} to={`/contas/${a.id}`} className="flex items-center justify-between gap-3 p-3 hover:bg-surface-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{a.name}</p>
                        <p className="truncate text-xs text-muted">
                          {accountTypeLabel[a.type]} · {fullName(a.owner)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold">{formatMoney(a.balance)}</p>
                    </Link>
                  ))}
                </Card>
              )}
            </QueryState>
          )}

          {tab === 'cards' && (
            <QueryState isLoading={cards.isLoading} error={cards.error}>
              {!cards.data?.length ? (
                <Empty title="Nenhum cartão vinculado. Vincule pela tela de Cartões." />
              ) : (
                <Card className="divide-y divide-border">
                  {cards.data.map((c) => (
                    <Link
                      key={c.id}
                      to={`/cartoes/${c.id}`}
                      className="flex items-center justify-between gap-3 p-3 hover:bg-surface-2"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary-hover">
                          <CardIcon className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{c.name}</p>
                          <p className="truncate text-xs text-muted">
                            Fecha dia {c.closingDay} · Vence dia {c.dueDay}
                            {c.owner ? ` · ${fullName(c.owner)}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted">Disponível</p>
                        <p className="text-sm font-semibold text-income">{formatMoney(c.availableLimit)}</p>
                      </div>
                    </Link>
                  ))}
                </Card>
              )}
            </QueryState>
          )}

          {tab === 'categories' && (
            <QueryState isLoading={categories.isLoading} error={categories.error}>
              <CategoryManager categories={categories.data ?? []} groupId={id} canEdit={isAdmin} />
            </QueryState>
          )}

          {tab === 'requests' && isAdmin && (
            <QueryState isLoading={requests.isLoading || cardRequests.isLoading} error={requests.error || cardRequests.error}>
              {!pendingReqCount ? (
                <Empty title="Sem solicitações pendentes." />
              ) : (
                <Card className="divide-y divide-border">
                  {requests.data?.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">Conta: {r.account.name}</p>
                        <p className="truncate text-xs text-muted">Solicitada por {fullName(r.requester)}</p>
                      </div>
                      <Button size="sm" onClick={() => acceptReq.mutate(r.id)}>
                        <Check className="size-4" />
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => rejectReq.mutate(r.id)}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))}
                  {cardRequests.data?.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">Cartão: {r.creditCard.name}</p>
                        <p className="truncate text-xs text-muted">Solicitado por {fullName(r.requester)}</p>
                      </div>
                      <Button size="sm" onClick={() => acceptCardReq.mutate(r.id)}>
                        <Check className="size-4" />
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => rejectCardReq.mutate(r.id)}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))}
                </Card>
              )}
            </QueryState>
          )}

          {tab === 'settings' && (
            <div className="space-y-4">
              {isAdmin && (
                <Card className="p-4">
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (renameTo?.trim()) rename.mutate(renameTo.trim())
                    }}
                  >
                    <Field label="Renomear grupo">
                      <Input value={renameTo ?? g.name} onChange={(e) => setRenameTo(e.target.value)} />
                    </Field>
                    <Button
                      type="submit"
                      variant="outline"
                      loading={rename.isPending}
                      disabled={renameTo === undefined || renameTo === g.name}
                    >
                      Salvar nome
                    </Button>
                  </form>
                </Card>
              )}
              {isOwner && (
                <Card className="p-4">
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (transferTo) transfer.mutate(transferTo)
                    }}
                  >
                    <Field label="Transferir propriedade" hint="Você passará a ser admin.">
                      <Select value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                        <option value="">Selecione um membro…</option>
                        {g.members
                          .filter((m) => m.role !== 'OWNER')
                          .map((m) => (
                            <option key={m.user.id} value={m.user.email}>
                              {fullName(m.user)} ({m.user.email})
                            </option>
                          ))}
                      </Select>
                    </Field>
                    <Button type="submit" variant="outline" loading={transfer.isPending} disabled={!transferTo}>
                      Transferir
                    </Button>
                  </form>
                </Card>
              )}
              <Card className="space-y-2 p-4">
                {!isOwner && (
                  <Button variant="danger" className="w-full" onClick={() => setConfirm('leave')}>
                    <LogOut className="size-4" /> Sair do grupo
                  </Button>
                )}
                {isOwner && (
                  <Button variant="danger" className="w-full" onClick={() => setConfirm('delete')}>
                    <Trash2 className="size-4" /> Excluir grupo
                  </Button>
                )}
                {isOwner && <p className="text-xs text-muted">Para sair, transfira a propriedade antes.</p>}
              </Card>
            </div>
          )}

          <Modal open={inviting} onClose={() => setInviting(false)} title="Convidar membro">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                invite.mutate(email.trim())
              }}
            >
              <Field label="E-mail">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              </Field>
              <Button type="submit" className="w-full" loading={invite.isPending}>
                Enviar convite
              </Button>
            </form>
          </Modal>
          <ConfirmDialog
            open={!!removing}
            onClose={() => setRemoving(undefined)}
            title="Remover membro"
            message={`Remover ${removing ? fullName(removing.user) : ''} do grupo?`}
            confirmLabel="Remover"
            loading={remove.isPending}
            onConfirm={() => removing && remove.mutate(removing.user.email)}
          />
          <ConfirmDialog
            open={!!confirm}
            onClose={() => setConfirm(undefined)}
            title={confirm === 'delete' ? 'Excluir grupo' : 'Sair do grupo'}
            message={confirm === 'delete' ? 'Essa ação não pode ser desfeita.' : 'Você perderá acesso ao grupo.'}
            confirmLabel={confirm === 'delete' ? 'Excluir' : 'Sair'}
            loading={leave.isPending || del.isPending}
            onConfirm={() => (confirm === 'delete' ? del.mutate() : leave.mutate())}
          />
          <TransactionFormModal
            open={addingTx}
            onClose={() => setAddingTx(false)}
            defaultAccountId={accounts.data?.[0]?.id}
            defaultCreditCardId={!accounts.data?.length ? cards.data?.[0]?.id : undefined}
          />
        </>
      )}
    </QueryState>
  )
}
