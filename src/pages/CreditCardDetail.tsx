import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Percent, Plus, Trash2, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { ALL_MONEY, useAccounts, useAction, useCreditCardInvoice, useCreditCards, useMyCategories } from '@/lib/hooks'
import { useAuth } from '@/lib/auth'
import { formatDate, formatMoney, fullName, initials, toISODate } from '@/lib/format'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
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
  const accounts = useAccounts().data ?? []
  const cats = useMyCategories().data ?? []

  const [period, setPeriod] = useState(currentPeriod())
  const [periodInitialized, setPeriodInitialized] = useState(false)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [paying, setPaying] = useState(false)
  const [editingRevolving, setEditingRevolving] = useState(false)

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
      setPeriod({ month: card.currentInvoiceMonth, year: card.currentInvoiceYear })
      setPeriodInitialized(true)
    }
  }, [card, periodInitialized])

  const invoice = useCreditCardInvoice(id, period.month, period.year)
  const inv = invoice.data

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

  if (cards.isSuccess && !card) return <Empty title="Cartão não encontrado." />

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
        <MonthPicker value={period} onChange={setPeriod} />
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

            {inv.byResponsible.length > 0 && (
              <Card className="mb-4 p-4">
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  <Users className="size-3.5" /> Gastos por responsável nesta fatura
                </h3>
                <div className="divide-y divide-border">
                  {inv.byResponsible.map((r) => (
                    <div key={r.user.id} className="flex items-center gap-3 py-2 text-sm">
                      <div className="grid size-7 place-items-center rounded-full bg-primary/20 text-[11px] font-bold text-primary-hover">
                        {initials(r.user)}
                      </div>
                      <span className="flex-1 truncate">{fullName(r.user)}</span>
                      <span className="font-semibold">{formatMoney(r.amount)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <TransactionList items={inv.transactions} categories={cats} showResponsible />
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
