import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Percent, Plus, Search, SlidersHorizontal, Trash2, Users, X } from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/lib/api'
import { ALL_MONEY, useAccessibleAccounts, useAction, useAllCategories, useCreditCardInvoice, useCreditCards } from '@/lib/hooks'
import { useAuth } from '@/lib/auth'
import type { TransactionStatus, TransactionType, UserSummary } from '@/lib/types'
import { formatDate, formatMoney, fullName, initials, toISODate, txTypeLabel } from '@/lib/format'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DetailSkeleton,
  Empty,
  Field,
  Input,
  Modal,
  MoneyInput,
  PageHeader,
  QueryState,
  Select,
} from '@/components/ui'
import { MonthPicker, currentPeriod } from '@/components/MonthPicker'
import TransactionList from '@/components/TransactionList'
import TransactionFormModal from '@/components/TransactionFormModal'
import NotFound from './NotFound'

interface Filters {
  search: string
  accountId: string
  categoryId: string
  responsibleId: string
  type: '' | TransactionType
  status: '' | TransactionStatus
  recurring: boolean
}
const EMPTY_FILTERS: Filters = {
  search: '',
  accountId: '',
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

const statusLabel: Record<string, { label: string; tone: 'default' | 'income' | 'expense' | 'warn' | 'primary' }> = {
  OPEN: { label: 'Aberta', tone: 'primary' },
  CLOSED: { label: 'Fechada', tone: 'warn' },
  PARTIALLY_PAID: { label: 'Paga parcialmente', tone: 'warn' },
  PAID: { label: 'Paga', tone: 'income' },
}

export default function CreditCardDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const cards = useCreditCards()
  const card = cards.data?.find((c) => c.id === id)
  const accounts = useAccessibleAccounts().data ?? []
  const cats = useAllCategories().data

  const [period, setPeriod] = useState(currentPeriod())
  const [periodInitialized, setPeriodInitialized] = useState(false)
  const [f, setF] = useState<Filters>(EMPTY_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [paying, setPaying] = useState(false)
  const [editingRevolving, setEditingRevolving] = useState(false)
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((p) => ({ ...p, [k]: v }))

  // Campos de pagamento manual
  const [payAmount, setPayAmount] = useState(0)
  const [payAccountId, setPayAccountId] = useState('')
  const [payDate, setPayDate] = useState(toISODate(new Date()))
  const [rollRemaining, setRollRemaining] = useState(true)
  const [nextRevolving, setNextRevolving] = useState(0)

  // Campos de edição de rotativo da fatura atual
  const [revolvingAmount, setRevolvingAmount] = useState(0)
  const [carriedOverAmount, setCarriedOverAmount] = useState(0)

  useEffect(() => {
    if (card && !periodInitialized) {
      if (card.currentInvoiceMonth && card.currentInvoiceYear) {
        setPeriod({ month: card.currentInvoiceMonth, year: card.currentInvoiceYear })
      }
      setPeriodInitialized(true)
    }
  }, [card, periodInitialized])

  const invoice = useCreditCardInvoice(id, period.month, period.year)
  const rawInv = invoice.data as unknown
  const inv =
    rawInv && typeof rawInv === 'object' && 'invoice' in rawInv
      ? (rawInv as { invoice: typeof invoice.data }).invoice
      : invoice.data

  const allTransactions = useMemo(() => inv?.transactions ?? [], [inv?.transactions])

  const responsibles = useMemo(() => {
    const map = new Map<string, UserSummary>()
    if (user) {
      map.set(user.id, { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email })
    }
    if (card?.owner) map.set(card.owner.id, card.owner)
    ;(inv?.byResponsible ?? []).forEach((r) => {
      if (r.user) map.set(r.user.id, r.user)
    })
    allTransactions.forEach((t) => {
      if (t.responsible) map.set(t.responsible.id, t.responsible)
    })
    return [...map.values()].sort((a, b) => {
      if (a.id === user?.id) return -1
      if (b.id === user?.id) return 1
      return fullName(a).localeCompare(fullName(b), 'pt-BR')
    })
  }, [user, card?.owner, inv?.byResponsible, allTransactions])

  const filteredTransactions = useMemo(() => {
    const term = f.search.trim().toLowerCase()
    return allTransactions.filter(
      (t) =>
        (!term || t.title.toLowerCase().includes(term)) &&
        (!f.accountId || t.accountId === f.accountId || t.destinationAccountId === f.accountId) &&
        (!f.categoryId || (f.categoryId === 'none' ? !t.categoryId : t.categoryId === f.categoryId)) &&
        (!f.responsibleId || t.responsibleId === f.responsibleId) &&
        (!f.type || t.type === f.type) &&
        (!f.status || t.status === f.status) &&
        (!f.recurring || !!t.recurrenceGroupId),
    )
  }, [allTransactions, f])

  const activeCount = [f.accountId, f.categoryId, f.responsibleId, f.type, f.status, f.recurring].filter(Boolean).length
  const filteredTotal = useMemo(
    () => filteredTransactions.reduce((s, t) => s + t.amount, 0),
    [filteredTransactions],
  )

  const del = useAction(() => api.delete(`/credit-cards/${id}`), {
    invalidate: ALL_MONEY,
    success: 'Cartão excluído',
    onSuccess: () => nav('/cartoes'),
  })

  const pay = useAction(
    () =>
      api.post(`/credit-cards/${id}/invoice/pay`, {
        amount: payAmount,
        accountId: payAccountId || card?.accountId,
        date: payDate,
        rollRemainingToNextMonth: rollRemaining,
        nextMonthRevolvingInterest: nextRevolving > 0 ? nextRevolving : null,
      }, { params: period }),
    {
      invalidate: ALL_MONEY,
      success: 'Pagamento registrado com sucesso',
      onSuccess: () => setPaying(false),
    },
  )

  const saveRevolving = useAction(
    () =>
      api.put(
        `/credit-cards/${id}/invoice/revolving`,
        { revolvingInterestAmount: revolvingAmount, carriedOverAmount },
        { params: period },
      ),
    {
      invalidate: ALL_MONEY,
      success: 'Valores de rotativo atualizados',
      onSuccess: () => setEditingRevolving(false),
    },
  )

  if (cards.isLoading) return <DetailSkeleton />
  if (cards.isSuccess && !card) {
    return (
      <NotFound
        title="Cartão não encontrado"
        description="Este cartão de crédito não existe, foi excluído ou você não tem permissão para visualizá-lo."
        backTo="/cartoes"
        backLabel="Meus cartões"
      />
    )
  }

  const openPayModal = () => {
    setPayAmount(inv?.remainingAmount ?? 0)
    setPayAccountId(card?.accountId ?? accounts[0]?.id ?? '')
    setPayDate(toISODate(new Date()))
    setRollRemaining(true)
    setNextRevolving(0)
    setPaying(true)
  }

  const openRevolvingModal = () => {
    setRevolvingAmount(inv?.revolvingInterestAmount ?? 0)
    setCarriedOverAmount(inv?.carriedOverAmount ?? 0)
    setEditingRevolving(true)
  }

  const pct = card && card.limitAmount > 0 ? Math.min(100, Math.round((card.usedLimit / card.limitAmount) * 100)) : 0
  const st = inv ? statusLabel[inv.status] ?? { label: inv.status, tone: 'default' } : undefined
  const isPartialPayment = inv ? payAmount < inv.remainingAmount : false

  return (
    <>
      <PageHeader
        back={
          <Link to="/cartoes" className="mb-1 inline-flex items-center gap-1 text-xs text-muted hover:text-text">
            <ArrowLeft className="size-3" /> Cartões
          </Link>
        }
        title={card?.name ?? '…'}
        subtitle={card && `Fecha dia ${card.closingDay} · Vence dia ${card.dueDay}`}
        action={
          <div className="flex gap-2">
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Nova compra
            </Button>
            {card?.ownerId === user?.id && (
              <Button variant="danger" onClick={() => setDeleting(true)} aria-label="Excluir cartão">
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        }
      />

      {card && (
        <Card className="mb-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs text-muted">Limite disponível</p>
              <p className="text-2xl font-bold text-income">{formatMoney(card.availableLimit)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted">Limite comprometido</p>
              <p className="text-lg font-semibold">{formatMoney(card.usedLimit)}</p>
            </div>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full ${pct >= 90 ? 'bg-expense' : pct >= 70 ? 'bg-warn' : 'bg-primary'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted">Limite total: {formatMoney(card.limitAmount)}</p>
        </Card>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker value={period} onChange={setPeriod} />
          <Button variant="outline" size="sm" className="h-10" onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal className="size-4" /> Filtros
            {activeCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[11px] text-white">{activeCount}</span>
            )}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={openRevolvingModal}>
            <Percent className="size-4" /> Rotativo / Saldo anterior
          </Button>
          <Button size="sm" onClick={openPayModal}>
            <CheckCircle2 className="size-4" /> Pagar fatura
          </Button>
        </div>
      </div>

      <QueryState isLoading={invoice.isLoading} error={invoice.error}>
        {inv && (
          <>
            <Card className="mb-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted">Total da fatura</p>
                    {st && <Badge tone={st.tone}>{st.label}</Badge>}
                  </div>
                  <p className="text-3xl font-bold">{formatMoney(inv.totalAmount)}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    Fechamento: {formatDate(inv.closingDate)} · Vencimento: {formatDate(inv.dueDate)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted">Restante a pagar</p>
                  <p className={`text-xl font-bold ${inv.remainingAmount > 0 ? 'text-expense' : 'text-income'}`}>
                    {formatMoney(inv.remainingAmount)}
                  </p>
                  {inv.paidAmount > 0 && (
                    <p className="text-xs text-income">Já pago: {formatMoney(inv.paidAmount)}</p>
                  )}
                </div>
              </div>

              {(inv.carriedOverAmount > 0 || inv.revolvingInterestAmount > 0) && (
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
                  <div>
                    <p className="text-muted">Compras do mês</p>
                    <p className="font-semibold">{formatMoney(inv.purchasesAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted">Saldo anterior rolado</p>
                    <p className="font-semibold text-warn">{formatMoney(inv.carriedOverAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted">Juros do rotativo</p>
                    <p className="font-semibold text-expense">{formatMoney(inv.revolvingInterestAmount)}</p>
                  </div>
                </div>
              )}
            </Card>

            {(inv.byResponsible ?? []).length > 0 && (
              <Card className="mb-4 p-4">
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  <Users className="size-3.5" /> Gastos por responsável nesta fatura
                </h3>
                <div className="divide-y divide-border">
                  {(inv.byResponsible ?? []).map((r) => (
                    <button
                      type="button"
                      key={r.user.id}
                      onClick={() => set('responsibleId', f.responsibleId === r.user.id ? '' : r.user.id)}
                      className={clsx(
                        'flex w-full items-center gap-3 rounded-lg px-1.5 py-2 text-left text-sm transition hover:bg-surface-2',
                        f.responsibleId === r.user.id && 'bg-primary/15 text-primary-hover',
                      )}
                      title="Clique para filtrar por este responsável"
                    >
                      <div className="grid size-7 place-items-center rounded-full bg-primary/20 text-[11px] font-bold text-primary-hover">
                        {initials(r.user)}
                      </div>
                      <span className="flex-1 truncate">{fullName(r.user)}</span>
                      <span className="font-semibold">{formatMoney(r.amount)}</span>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                className="pl-9"
                placeholder="Buscar por título na fatura…"
                value={f.search}
                onChange={(e) => set('search', e.target.value)}
              />
            </div>

            {showFilters && (
              <Card className="mb-4 space-y-4 p-4">
                <div>
                  <p className="mb-2 text-xs font-medium text-muted">Tipo</p>
                  <div className="flex flex-wrap gap-2">
                    <button className={chip(f.type === '')} onClick={() => set('type', '')}>
                      Todos
                    </button>
                    {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((t) => (
                      <button key={t} className={chip(f.type === t)} onClick={() => set('type', t)}>
                        {txTypeLabel[t]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-muted">Situação</p>
                  <div className="flex flex-wrap gap-2">
                    <button className={chip(f.status === '')} onClick={() => set('status', '')}>
                      Todas
                    </button>
                    <button className={chip(f.status === 'PENDING')} onClick={() => set('status', 'PENDING')}>
                      Pendentes
                    </button>
                    <button className={chip(f.status === 'COMPLETED')} onClick={() => set('status', 'COMPLETED')}>
                      Concluídas
                    </button>
                    <button className={chip(f.recurring)} onClick={() => set('recurring', !f.recurring)}>
                      Recorrentes / Parceladas
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Conta vinculada">
                    <Select value={f.accountId} onChange={(e) => set('accountId', e.target.value)}>
                      <option value="">Todas as contas</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                          {a.owner ? ` (${fullName(a.owner)})` : ''}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Categoria">
                    <Select value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                      <option value="">Todas as categorias</option>
                      <option value="none">Sem categoria</option>
                      {cats.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Responsável">
                    <Select value={f.responsibleId} onChange={(e) => set('responsibleId', e.target.value)}>
                      <option value="">Todos os responsáveis</option>
                      {responsibles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {fullName(r)}
                          {r.id === user?.id ? ' (Você)' : ''}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                {activeCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setF((p) => ({ ...EMPTY_FILTERS, search: p.search }))}>
                    <X className="size-4" /> Limpar filtros
                  </Button>
                )}
              </Card>
            )}

            {(activeCount > 0 || f.search.trim().length > 0) && (
              <div className="mb-3 flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-xs">
                <span className="text-muted">
                  Exibindo <b className="text-text">{filteredTransactions.length}</b> de {allTransactions.length}{' '}
                  lançamento(s)
                </span>
                <span className="text-muted">
                  Total filtrado: <b className="text-expense">{formatMoney(filteredTotal)}</b>
                </span>
              </div>
            )}

            {allTransactions.length > 0 && !filteredTransactions.length ? (
              <Empty title="Nenhum lançamento na fatura com esses filtros." />
            ) : (
              <TransactionList items={filteredTransactions} categories={cats} showResponsible />
            )}
          </>
        )}
      </QueryState>

      <TransactionFormModal
        open={adding}
        onClose={() => setAdding(false)}
        defaultCreditCardId={id}
        defaultInvoicePeriod={period}
      />

      <Modal open={paying} onClose={() => setPaying(false)} title="Pagamento manual da fatura">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            pay.mutate()
          }}
        >
          <p className="text-xs text-muted">
            Informe quanto deseja pagar agora. Se pagar menos que o total (ou R$ 0,00 para apenas rolar a fatura), o
            saldo restante pode ser transferido para a fatura do mês seguinte junto com os juros do rotativo.
          </p>
          <Field
            label="Valor a pagar"
            hint={inv ? `Restante atual da fatura: ${formatMoney(inv.remainingAmount)}` : undefined}
          >
            <MoneyInput value={payAmount} onChange={setPayAmount} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Debitar da conta">
              <Select value={payAccountId} onChange={(e) => setPayAccountId(e.target.value)} required>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatMoney(a.balance)})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Data do pagamento">
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} required />
            </Field>
          </div>

          {isPartialPayment && inv && (
            <div className="space-y-3 rounded-xl border border-warn/40 bg-warn/10 p-3">
              <p className="text-xs font-medium text-warn">
                Restarão {formatMoney(Math.max(0, inv.remainingAmount - payAmount))} sem pagar nesta fatura.
              </p>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="size-4 accent-indigo-500"
                  checked={rollRemaining}
                  onChange={(e) => setRollRemaining(e.target.checked)}
                />
                Transferir saldo restante não pago para a fatura do mês seguinte
              </label>
              <Field
                label="Valor do rotativo (juros/encargos) para o mês seguinte"
                hint="Você também pode informar ou editar esse valor depois direto na fatura seguinte."
              >
                <MoneyInput value={nextRevolving} onChange={setNextRevolving} />
              </Field>
            </div>
          )}

          <Button type="submit" className="w-full" loading={pay.isPending}>
            Confirmar
          </Button>
        </form>
      </Modal>

      <Modal open={editingRevolving} onClose={() => setEditingRevolving(false)} title="Rotativo e saldo anterior desta fatura">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            saveRevolving.mutate()
          }}
        >
          <Field
            label="Saldo anterior rolado (não pago no mês passado)"
            hint="Preenchido automaticamente quando você rola o saldo da fatura anterior."
          >
            <MoneyInput value={carriedOverAmount} onChange={setCarriedOverAmount} />
          </Field>
          <Field label="Juros e encargos do rotativo adicionados neste mês">
            <MoneyInput value={revolvingAmount} onChange={setRevolvingAmount} />
          </Field>
          <Button type="submit" className="w-full" loading={saveRevolving.isPending}>
            Salvar
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Excluir cartão"
        confirmLabel="Excluir"
        loading={del.isPending}
        message={`Excluir "${card?.name}"? Todas as transações e faturas deste cartão serão removidas.`}
        onConfirm={() => del.mutate()}
      />
    </>
  )
}
