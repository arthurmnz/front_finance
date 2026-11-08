import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import {
  ArrowDownCircle,
  ArrowLeft,
  ArrowUpCircle,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CreditCard as CardIcon,
  Eye,
  EyeOff,
  LogOut,
  Plus,
  Receipt,
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
  useGroupDebts,
  useGroupUsedCategories,
} from '@/lib/hooks'
import { useAuth } from '@/lib/auth'
import type { CreditCardInvoice, GroupMember, GroupRole, Transaction, TransactionStatus, TransactionType, UserSummary } from '@/lib/types'
import { accountTypeLabel, formatDate, formatMoney, fullName, initials, monthLabel, roleLabel, txTypeLabel } from '@/lib/format'
import { normalizeCategoryColor } from '@/lib/palette'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Empty,
  Field,
  Input,
  ListSkeleton,
  Modal,
  PageHeader,
  QueryState,
  Select,
  Spinner,
  Tabs,
} from '@/components/ui'
import { MonthPicker, currentPeriod } from '@/components/MonthPicker'
import CategoryManager from '@/components/CategoryManager'
import TransactionList from '@/components/TransactionList'
import TransactionFormModal from '@/components/TransactionFormModal'
import SettleDebtModal from '@/components/SettleDebtModal'
import GroupReportsView from '@/components/reports/GroupReportsView'

type Tab = 'overview' | 'transactions' | 'reports' | 'settlements' | 'members' | 'accounts' | 'cards' | 'categories' | 'requests' | 'settings'

interface TxFilters {
  search: string
  accountId: string
  creditCardId: string
  hideCreditCards: boolean
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
  hideCreditCards: false,
  categoryId: '',
  responsibleId: '',
  type: '',
  status: '',
  recurring: false,
}

const chip = (active: boolean) =>
  clsx(
    'rounded-xl border px-3 py-1.5 text-xs font-medium transition cursor-pointer select-none',
    active
      ? 'border-violet bg-violet text-white font-semibold shadow-sm shadow-violet/25'
      : 'border-border text-text-muted hover:bg-surface-2 hover:text-white',
  )

export default function GroupDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const { user } = useAuth()
  const isReportsPath = location.pathname.endsWith('/relatorios')
  const initialTab = isReportsPath ? 'reports' : ((searchParams.get('tab') as Tab) || 'overview')
  const [tab, setTab] = useState<Tab>(initialTab)
  const [period, setPeriod] = useState(currentPeriod())
  const [ignored, setIgnored] = useState<string[]>([])
  const [txFilters, setTxFilters] = useState<TxFilters>(EMPTY_TX_FILTERS)
  const [showTxFilters, setShowTxFilters] = useState(false)
  const [addingTx, setAddingTx] = useState(false)
  const [settleTarget, setSettleTarget] = useState<{
    creditor: UserSummary
    targetMonth: number
    targetYear: number
    suggestedAmount: number
  } | null>(null)
  const [expandedPairs, setExpandedPairs] = useState<Set<string>>(new Set())

  const toggleExpandPair = (key: string) => {
    setExpandedPairs((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const setTxF = <K extends keyof TxFilters>(k: K, v: TxFilters[K]) => setTxFilters((p) => ({ ...p, [k]: v }))
  const toggleIgnore = (accId: string) =>
    setIgnored((p) => (p.includes(accId) ? p.filter((x) => x !== accId) : [...p, accId]))

  const group = useGroup(id)
  const g = group.data
  const isOwner = g?.myRole === 'OWNER'
  const isAdmin = isOwner || g?.myRole === 'ADMIN'
  const needsEcosystemData = tab === 'overview' || tab === 'transactions' || tab === 'settlements'
  const accounts = useGroupAccounts(tab === 'accounts' || needsEcosystemData ? id : undefined)
  const cards = useGroupCreditCards(tab === 'cards' || needsEcosystemData ? id : undefined)
  const categories = useGroupCategories(tab === 'categories' || needsEcosystemData ? id : undefined)
  const groupCategories = categories.data ?? []
  const usedCategoriesQuery = useGroupUsedCategories(needsEcosystemData ? id : undefined)
  const usedCategories = usedCategoriesQuery.data ?? []
  const groupDebtsQuery = useGroupDebts(tab === 'settlements' || tab === 'overview' ? id : undefined)
  const groupDebts = groupDebtsQuery.data
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

  const cardTxQueries = useQueries({
    queries: needsEcosystemData
      ? (cards.data ?? []).map((c) => ({
          queryKey: ['transactions', 'card', c.id, period.month, period.year],
          queryFn: () =>
            api.get<Transaction[]>(`/transactions/card/${c.id}`, { params: period }).then((r) => r.data),
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
    usedCategoriesQuery.isLoading ||
    txAccountQueries.some((q) => q.isLoading) ||
    cardTxQueries.some((q) => q.isLoading) ||
    txCardQueries.some((q) => q.isLoading)

  const invStamp = txCardQueries.map((q) => q.dataUpdatedAt).join(',')

  const allGroupTransactions = useMemo(() => {
    const map = new Map<string, Transaction>()
    txAccountQueries.forEach((q) =>
      q.data?.forEach((t) => {
        map.set(t.id, t)
      }),
    )
    cardTxQueries.forEach((q) =>
      q.data?.forEach((t) => {
        map.set(t.id, t)
      }),
    )
    txCardQueries.forEach((q) =>
      q.data?.transactions?.forEach((t) => {
        const [yStr, mStr] = t.date.split('-')
        if (Number(mStr) === period.month && Number(yStr) === period.year) {
          map.set(t.id, t)
        }
      }),
    )
    return [...map.values()]
  }, [txAccountQueries, cardTxQueries, txCardQueries, period.month, period.year])

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
  }, [accounts.data, cards.data, ignored, allGroupTransactions, invStamp])

  const byCategory = useMemo(() => {
    const catMap = new Map<string, { id?: string; name: string; value: number; color: string; isPrivateToOther: boolean }>()

    allGroupTransactions
      .filter((t) => t.type === 'EXPENSE')
      .forEach((t) => {
        const cat = usedCategories.find((c) => c.id === t.categoryId) ?? groupCategories.find((c) => c.id === t.categoryId)
        const name = cat?.name ?? 'Sem categoria'
        const isPersonal = cat ? ('isPersonal' in cat ? cat.isPersonal : Boolean(cat.userId)) : false
        const ownerId = cat ? ('ownerId' in cat ? cat.ownerId : cat.userId) : null
        const isPrivate = Boolean(isPersonal && ownerId !== user?.id)
        const existing = catMap.get(name)
        if (existing) {
          existing.value += t.amount
          if (isPrivate) existing.isPrivateToOther = true
        } else {
          catMap.set(name, {
            id: cat?.id,
            name,
            value: t.amount,
            color: normalizeCategoryColor(cat?.color),
            isPrivateToOther: isPrivate,
          })
        }
      })

    return [...catMap.values()].sort((a, b) => b.value - a.value)
  }, [allGroupTransactions, usedCategories, groupCategories, user?.id])

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
        (txFilters.hideCreditCards || txFilters.creditCardId === 'none'
          ? !t.creditCardId
          : !txFilters.creditCardId || t.creditCardId === txFilters.creditCardId) &&
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
  const txNet = txIncome - txExpense
  const activeTxFilterCount = [
    txFilters.accountId,
    txFilters.creditCardId,
    txFilters.hideCreditCards,
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
              <Link to="/grupos" className="mb-1 inline-flex items-center gap-1 text-xs text-text-dim hover:text-white transition">
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
                { key: 'reports', label: 'Relatórios' },
                { key: 'settlements', label: 'Acertos' },
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

              <Card className="p-5 bg-surface-1 border border-border">
                <div className="grid grid-cols-2 gap-4 border-b border-border/60 pb-4">
                  <div>
                    <p className="text-xs text-text-dim">Saldo total do grupo</p>
                    <p className="mt-0.5 text-2xl font-bold sm:text-3xl tracking-tight text-white tabular-nums">
                      {!accounts.isLoading ? formatMoney(groupSummary.currentBalance) : '—'}
                    </p>
                  </div>
                  <div className="border-l border-border/60 pl-4">
                    <p className="text-xs text-text-dim">Saldo projetado</p>
                    <p
                      className={`mt-0.5 text-2xl font-bold sm:text-3xl tracking-tight tabular-nums ${groupSummary.projectedBalance < 0 ? 'text-white' : 'text-lime'}`}
                    >
                      {!accounts.isLoading ? formatMoney(groupSummary.projectedBalance) : '—'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <ArrowUpCircle className="size-6 shrink-0 text-lime" />
                      <div className="min-w-0">
                        <p className="text-xs text-text-dim">Receitas</p>
                        <p className="truncate font-semibold text-lime tabular-nums">
                          {formatMoney(groupSummary.realizedIncome)}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-xl bg-surface-2 px-3 py-2">
                      <p className="text-[11px] text-text-dim">Receitas projetadas</p>
                      <p className="text-xs font-semibold text-lime tabular-nums">
                        {formatMoney(groupSummary.projectedIncome)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <ArrowDownCircle className="size-6 shrink-0 text-white" />
                      <div className="min-w-0">
                        <p className="text-xs text-text-dim">Despesas</p>
                        <p className="truncate font-semibold text-white tabular-nums">
                          −{formatMoney(groupSummary.realizedExpense)}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-xl bg-surface-2 px-3 py-2">
                      <p className="text-[11px] text-text-dim">Despesas projetadas</p>
                      <p className="text-xs font-semibold text-white tabular-nums">
                        −{formatMoney(groupSummary.projectedExpense)}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card
                  onClick={() => setTab('accounts')}
                  className="cursor-pointer p-4 transition hover:border-violet/40"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setTab('accounts')
                      }}
                      className="inline-flex items-center gap-1 font-semibold text-white hover:text-lime transition"
                    >
                      Contas do grupo <ChevronRight className="size-4 text-text-dim" />
                    </button>
                  </div>
                  <p className="mb-3 text-xs text-text-dim">Toque no olho para ignorar uma conta do saldo total.</p>
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
                            className="p-1 text-text-dim hover:text-white transition"
                            aria-label="Ignorar no saldo"
                          >
                            {ignored.includes(a.id) ? (
                              <EyeOff className="size-4 text-text-dim" />
                            ) : (
                              <Eye className="size-4 text-lime" />
                            )}
                          </button>
                          <Link
                            to={`/contas/${a.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className={`flex flex-1 items-center justify-between hover:text-lime transition ${ignored.includes(a.id) ? 'opacity-40' : ''}`}
                          >
                            <div className="min-w-0">
                              <span className="block truncate text-sm text-white">{a.name}</span>
                              <span className="block truncate text-xs text-text-dim">{fullName(a.owner)}</span>
                            </div>
                            <span className="text-sm font-semibold text-white tabular-nums">
                              {formatMoney(a.balance)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card className="p-4">
                  <h2 className="mb-3 font-semibold text-white">Despesas por categoria</h2>
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
                                background: '#0e0e13',
                                border: '1px solid #20202d',
                                borderRadius: 12,
                                color: '#ffffff',
                              }}
                              itemStyle={{ color: '#ffffff' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <ul className="mt-2 space-y-1.5">
                        {byCategory.slice(0, 5).map((c, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs text-text-muted">
                            <span className="size-2 rounded-full shrink-0" style={{ background: c.color }} />
                            <span className="truncate">{c.name}</span>
                            {c.isPrivateToOther && (
                              <span className="rounded bg-surface-2 px-1 text-[10px] text-text-dim">
                                privada
                              </span>
                            )}
                            <span className="ml-auto font-medium text-white tabular-nums">{formatMoney(c.value)}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </Card>
              </div>

              <Card onClick={() => setTab('cards')} className="cursor-pointer p-4 transition hover:border-violet/40">
                <div className="mb-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setTab('cards')
                    }}
                    className="inline-flex items-center gap-1 font-semibold text-white hover:text-lime transition"
                  >
                    Cartões de crédito <ChevronRight className="size-4 text-text-dim" />
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
                          className="flex items-center justify-between text-sm hover:text-lime transition"
                        >
                          <div>
                            <p className="font-medium text-white">
                              {c.name}
                              {c.owner ? <span className="text-xs font-normal text-text-dim"> · {fullName(c.owner)}</span> : null}
                            </p>
                            <p className="text-xs text-text-dim">
                              Disponível: <span className="text-lime">{formatMoney(c.availableLimit)}</span> · Vence
                              dia {c.dueDay}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] text-text-dim">Fatura atual</p>
                            <p className="font-semibold text-white tabular-nums">−{formatMoney(c.currentInvoiceAmount)}</p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-semibold text-white">Próximas pendentes</h2>
                  {upcoming.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTab('transactions')}
                      className="text-xs font-medium text-lime hover:underline"
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
                          <p className="font-medium text-white">{t.title}</p>
                          <p className="text-xs text-text-dim">
                            {formatDate(t.date)}
                            {accountNames.get(t.accountId) ? ` · ${accountNames.get(t.accountId)}` : ''}
                          </p>
                        </div>
                        <span
                          className={
                            t.type === 'INCOME'
                              ? 'font-semibold text-lime tabular-nums'
                              : 'font-semibold text-white tabular-nums'
                          }
                        >
                          {t.type === 'INCOME' ? '+' : '−'}
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
                      <span className="rounded-full bg-violet px-1.5 py-0.2 text-[10px] font-bold text-white">
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
                <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-dim" />
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
                    <p className="mb-2 text-xs font-medium text-text-dim">Tipo</p>
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
                    <p className="mb-2 text-xs font-medium text-text-dim">Situação</p>
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
                      <button
                        className={chip(txFilters.hideCreditCards)}
                        onClick={() => setTxF('hideCreditCards', !txFilters.hideCreditCards)}
                      >
                        Sem cartão de crédito
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
                        <option value="none">Ocultar cartão de crédito (apenas contas)</option>
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
                  <p className="text-xs text-text-dim">Receitas</p>
                  <p className="text-sm font-semibold text-lime tabular-nums">{formatMoney(txIncome)}</p>
                </div>
                <div className="p-3">
                  <p className="text-xs text-text-dim">Despesas</p>
                  <p className="text-sm font-semibold text-white tabular-nums">−{formatMoney(txExpense)}</p>
                </div>
                <div className="p-3">
                  <p className="text-xs text-text-dim">Resultado</p>
                  <p className={clsx('text-sm font-semibold tabular-nums', txNet > 0 ? 'text-lime' : 'text-white')}>
                    {txNet > 0 ? '+' : txNet < 0 ? '−' : ''}
                    {formatMoney(Math.abs(txNet))}
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

          {tab === 'reports' && id && (
            <div className="space-y-4">
              <GroupReportsView groupId={id} />
            </div>
          )}

          {tab === 'settlements' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4 bg-surface-1">
                  <p className="text-xs text-text-dim">Você deve no total (todos os meses)</p>
                  <p className="mt-1 text-2xl font-bold text-rose-400 tabular-nums">
                    {formatMoney(groupDebts?.totalOwedByMe ?? 0)}
                  </p>
                </Card>
                <Card className="p-4 bg-surface-1">
                  <p className="text-xs text-text-dim">Você tem a receber (todos os meses)</p>
                  <p className="mt-1 text-2xl font-bold text-lime tabular-nums">
                    {formatMoney(groupDebts?.totalReceivableByMe ?? 0)}
                  </p>
                </Card>
              </div>

              {groupDebtsQuery.isLoading ? (
                <Spinner />
              ) : !groupDebts?.monthlyBalances.length || groupDebts.monthlyBalances.every((m) => !m.userBalances.length) ? (
                <Empty title="Nenhum acerto pendente ou compra compartilhada no grupo.">
                  <p className="text-xs text-text-dim">
                    Quando um membro utilizar o cartão de outro membro neste grupo, o rateio e controle de quitação por fatura aparecerão aqui.
                  </p>
                </Empty>
              ) : (
                <div className="space-y-4">
                  {groupDebts.monthlyBalances
                    .filter((m) => m.userBalances.length > 0)
                    .map((m) => {
                      const now = new Date()
                      const isCurrentMonth = m.month === now.getMonth() + 1 && m.year === now.getFullYear()
                      const isFutureMonth = m.year > now.getFullYear() || (m.year === now.getFullYear() && m.month > now.getMonth() + 1)

                      return (
                        <Card key={`${m.year}-${m.month}`} className="p-4">
                          <div className="mb-3 flex items-center justify-between border-b border-border/60 pb-3">
                            <div className="flex items-center gap-2">
                              <Calendar className="size-4 text-violet" />
                              <h3 className="font-semibold text-white capitalize">
                                {monthLabel(m.month, m.year)}
                              </h3>
                            </div>
                            <div className="flex items-center gap-2">
                              {isCurrentMonth && <Badge tone="primary">Mês Atual</Badge>}
                              {isFutureMonth && <Badge tone="default">Fatura Futura</Badge>}
                            </div>
                          </div>

                          <ul className="divide-y divide-border/60">
                            {m.userBalances.map((b) => {
                              const pairKey = `${m.year}-${m.month}-${b.debtor.id}-${b.creditor.id}`
                              const isExpanded = expandedPairs.has(pairKey)
                              const isDebtor = b.debtor.id === user?.id
                              const isCreditor = b.creditor.id === user?.id

                              return (
                                <li key={pairKey} className="py-3">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-white">
                                        {isDebtor ? (
                                          <>
                                            Você deve{' '}
                                            <span className="font-bold text-rose-400 tabular-nums">
                                              {formatMoney(b.netAmount)}
                                            </span>{' '}
                                            para {fullName(b.creditor)}
                                          </>
                                        ) : isCreditor ? (
                                          <>
                                            {fullName(b.debtor)} deve{' '}
                                            <span className="font-bold text-lime tabular-nums">
                                              {formatMoney(b.netAmount)}
                                            </span>{' '}
                                            para você
                                          </>
                                        ) : (
                                          <>
                                            {fullName(b.debtor)} deve{' '}
                                            <span className="font-semibold text-white tabular-nums">
                                              {formatMoney(b.netAmount)}
                                            </span>{' '}
                                            para {fullName(b.creditor)}
                                          </>
                                        )}
                                      </p>
                                      {b.netAmount === 0 && (
                                        <p className="text-xs text-lime mt-0.5">Quitado para este mês 🎉</p>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {isDebtor && b.netAmount > 0 && (
                                        <Button
                                          size="sm"
                                          variant="primary"
                                          onClick={() =>
                                            setSettleTarget({
                                              creditor: b.creditor,
                                              targetMonth: m.month,
                                              targetYear: m.year,
                                              suggestedAmount: b.netAmount,
                                            })
                                          }
                                        >
                                          Quitar mês
                                        </Button>
                                      )}

                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs gap-1"
                                        onClick={() => toggleExpandPair(pairKey)}
                                      >
                                        {isExpanded ? (
                                          <>
                                            Ocultar detalhes <ChevronUp className="size-3.5" />
                                          </>
                                        ) : (
                                          <>
                                            Ver detalhes <ChevronDown className="size-3.5" />
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  </div>

                                  {isExpanded && (
                                    <div className="mt-3 rounded-xl bg-surface-2 p-3 space-y-3">
                                      <p className="text-xs font-semibold text-text-dim">
                                        Detalhamento das compras na fatura ({m.month.toString().padStart(2, '0')}/{m.year})
                                      </p>

                                      {b.grossDebts.map((gd, idx) => (
                                        <div key={idx} className="space-y-2 border-t border-border/40 pt-2 text-xs">
                                          <div className="flex items-center justify-between text-text-muted">
                                            <span>
                                              Compras no cartão do credor:{' '}
                                              <strong className="text-white tabular-nums">
                                                {formatMoney(gd.grossAmount)}
                                              </strong>
                                            </span>
                                            {gd.settledAmount > 0 && (
                                              <span className="text-lime">
                                                Já abatido: {formatMoney(gd.settledAmount)}
                                              </span>
                                            )}
                                          </div>

                                          <ul className="space-y-1">
                                            {gd.transactions.map((tx) => (
                                              <li
                                                key={tx.id}
                                                className="flex items-center justify-between rounded-lg bg-surface-1 px-2.5 py-1.5"
                                              >
                                                <div className="min-w-0 pr-2">
                                                  <p className="truncate text-white font-medium">{tx.title}</p>
                                                  <p className="text-[11px] text-text-dim">
                                                    {formatDate(tx.date)}
                                                    {tx.installmentNumber && tx.totalInstallments
                                                      ? ` · Parcela ${tx.installmentNumber}/${tx.totalInstallments}`
                                                      : ''}
                                                  </p>
                                                </div>
                                                <span className="shrink-0 font-semibold text-white tabular-nums">
                                                  {formatMoney(tx.amount)}
                                                </span>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        </Card>
                      )
                    })}
                </div>
              )}

              {groupDebts && groupDebts.settlements.length > 0 && (
                <Card className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Receipt className="size-4 text-lime" />
                    <h3 className="font-semibold text-white">Histórico de Quitações / Acertos</h3>
                  </div>

                  <ul className="divide-y divide-border/60">
                    {groupDebts.settlements.map((s) => (
                      <li key={s.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <p className="text-white font-medium">
                            {fullName(s.debtor)} transferiu{' '}
                            <span className="text-lime font-bold tabular-nums">
                              {formatMoney(s.amount)}
                            </span>{' '}
                            para {fullName(s.creditor)}
                          </p>
                          <p className="text-text-dim text-[11px]">
                            {formatDate(s.date)} · Referente à fatura{' '}
                            {s.targetMonth.toString().padStart(2, '0')}/{s.targetYear}
                            {s.notes ? ` · "${s.notes}"` : ''}
                          </p>
                        </div>
                        <Badge tone="primary">Acerto Efetuado</Badge>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}

          {tab === 'members' && (
            <Card className="divide-y divide-border">
              {g.members.map((m) => (
                <div key={m.user.id} className="flex items-center gap-3 p-3.5 hover:bg-surface-2/40 transition">
                  <div className="grid size-10 place-items-center rounded-full bg-violet/20 text-xs font-bold text-violet-hover">
                    {initials(m.user)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{fullName(m.user)}</p>
                    <p className="truncate text-xs text-text-dim">{m.user.email}</p>
                  </div>
                  {canManage(m) && isOwner ? (
                    <div className="w-32">
                      <Select
                        className="!h-9 text-xs"
                        value={m.role}
                        onChange={(e) => setRole.mutate({ email: m.user.email, role: e.target.value as GroupRole })}
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="MEMBER">Membro</option>
                      </Select>
                    </div>
                  ) : (
                    <Badge tone={m.role === 'OWNER' ? 'primary' : 'default'}>{roleLabel[m.role]}</Badge>
                  )}
                  {canManage(m) && (
                    <button
                      type="button"
                      onClick={() => setRemoving(m)}
                      className="p-1.5 text-text-dim hover:text-white transition"
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
                    <Link
                      key={a.id}
                      to={`/contas/${a.id}`}
                      className="flex items-center justify-between gap-3 p-3.5 hover:bg-surface-2/50 transition"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{a.name}</p>
                        <p className="truncate text-xs text-text-dim">
                          {accountTypeLabel[a.type]} · {fullName(a.owner)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-white tabular-nums">{formatMoney(a.balance)}</p>
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
                      className="flex items-center justify-between gap-3 p-3.5 hover:bg-surface-2/50 transition"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid size-9 place-items-center rounded-xl bg-violet/15 text-violet-hover">
                          <CardIcon className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{c.name}</p>
                          <p className="truncate text-xs text-text-dim">
                            Fecha dia {c.closingDay} · Vence dia {c.dueDay}
                            {c.owner ? ` · ${fullName(c.owner)}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-text-dim">Disponível</p>
                        <p className="text-sm font-semibold text-lime tabular-nums">{formatMoney(c.availableLimit)}</p>
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
                    <div key={r.id} className="flex items-center gap-3 p-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">Conta: {r.account.name}</p>
                        <p className="truncate text-xs text-text-dim">Solicitada por {fullName(r.requester)}</p>
                      </div>
                      <Button size="sm" variant="lime" onClick={() => acceptReq.mutate(r.id)}>
                        <Check className="size-4" />
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => rejectReq.mutate(r.id)}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))}
                  {cardRequests.data?.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">Cartão: {r.creditCard.name}</p>
                        <p className="truncate text-xs text-text-dim">Solicitado por {fullName(r.requester)}</p>
                      </div>
                      <Button size="sm" variant="lime" onClick={() => acceptCardReq.mutate(r.id)}>
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
                    noValidate
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
                    noValidate
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
                {isOwner && <p className="text-xs text-text-dim">Para sair, transfira a propriedade antes.</p>}
              </Card>
            </div>
          )}

          <Modal open={inviting} onClose={() => setInviting(false)} title="Convidar membro">
            <form
              noValidate
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (email.trim()) invite.mutate(email.trim())
              }}
            >
              <Field label="E-mail">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  required
                  autoFocus
                />
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
          {settleTarget && (
            <SettleDebtModal
              open={!!settleTarget}
              onClose={() => setSettleTarget(null)}
              groupId={id!}
              creditor={settleTarget.creditor}
              targetMonth={settleTarget.targetMonth}
              targetYear={settleTarget.targetYear}
              suggestedAmount={settleTarget.suggestedAmount}
              groupAccounts={accounts.data ?? []}
              groupCards={cards.data ?? []}
            />
          )}
        </>
      )}
    </QueryState>
  )
}
