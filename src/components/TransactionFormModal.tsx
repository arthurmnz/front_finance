import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { ALL_MONEY, useAccessibleAccounts, useAction, useCreditCards, useGroupCategories, useMyCategories } from '@/lib/hooks'
import type {
  CreateTransactionInput,
  RecurrenceFrequency,
  Transaction,
  TransactionStatus,
  TransactionType,
  UpdateTransactionInput,
} from '@/lib/types'
import { defaultInvoicePeriod, formatMoney, freqLabel, monthLabel, toISODate, txTypeLabel } from '@/lib/format'
import { Button, Field, Input, Modal, MoneyInput, Select } from './ui'
import clsx from 'clsx'

interface Props {
  open: boolean
  onClose: () => void
  transaction?: Transaction
  defaultAccountId?: string
  defaultCreditCardId?: string
  defaultInvoicePeriod?: { month: number; year: number }
}

export default function TransactionFormModal({
  open,
  onClose,
  transaction,
  defaultAccountId,
  defaultCreditCardId,
  defaultInvoicePeriod: initialInvoicePeriod,
}: Props) {
  const editing = !!transaction
  const accounts = useAccessibleAccounts().data ?? []
  const creditCards = useCreditCards().data ?? []
  const myCategories = useMyCategories().data ?? []

  const [sourceMode, setSourceMode] = useState<'ACCOUNT' | 'CARD'>('ACCOUNT')
  const [type, setType] = useState<TransactionType>('EXPENSE')
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(toISODate(new Date()))
  const [accountId, setAccountId] = useState('')
  const [creditCardId, setCreditCardId] = useState('')
  const [invoiceMonth, setInvoiceMonth] = useState(new Date().getMonth() + 1)
  const [invoiceYear, setInvoiceYear] = useState(new Date().getFullYear())
  const [invoiceManual, setInvoiceManual] = useState(false)
  const [destId, setDestId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [status, setStatus] = useState<TransactionStatus>('PENDING')
  const [recurring, setRecurring] = useState(false)
  const [freq, setFreq] = useState<RecurrenceFrequency>('MONTHLY')
  const [interval, setInterval_] = useState(1)
  const [installments, setInstallments] = useState(12)
  const [infinite, setInfinite] = useState(false)
  const [installmentAmountMode, setInstallmentAmountMode] = useState<'INSTALLMENT' | 'TOTAL'>('TOTAL')
  const [allFuture, setAllFuture] = useState(false)

  const selectedCard = useMemo(() => creditCards.find((c) => c.id === creditCardId), [creditCards, creditCardId])
  const effectiveAccountId = useMemo(() => {
    if (editing) return transaction?.accountId ?? ''
    return sourceMode === 'CARD' ? (selectedCard?.accountId ?? '') : accountId
  }, [editing, transaction, sourceMode, selectedCard, accountId])
  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === effectiveAccountId),
    [accounts, effectiveAccountId],
  )
  const effectiveGroupId = useMemo(() => {
    if (sourceMode === 'CARD' || transaction?.creditCardId) {
      return selectedCard?.groupId ?? selectedAccount?.groupId ?? undefined
    }
    return selectedAccount?.groupId ?? undefined
  }, [sourceMode, transaction, selectedCard, selectedAccount])
  const groupCategories = useGroupCategories(effectiveGroupId).data ?? []

  useEffect(() => {
    if (!open) return
    const t = transaction
    const isCard = !!(t?.creditCardId || defaultCreditCardId)
    setSourceMode(isCard ? 'CARD' : 'ACCOUNT')
    setType(isCard ? 'EXPENSE' : (t?.type ?? 'EXPENSE'))
    setTitle(t?.title ?? '')
    setAmount(t?.amount ?? 0)
    const dt = t?.date.slice(0, 10) ?? toISODate(new Date())
    setDate(dt)
    setAccountId(t?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? '')
    const cid = t?.creditCardId ?? defaultCreditCardId ?? creditCards[0]?.id ?? ''
    setCreditCardId(cid)
    setDestId(t?.destinationAccountId ?? '')
    setCategoryId(t?.categoryId ?? '')
    setStatus(t?.status ?? 'PENDING')
    setRecurring(false)
    setFreq('MONTHLY')
    setInterval_(1)
    setInstallments(2)
    setInfinite(false)
    setInstallmentAmountMode('TOTAL')
    setAllFuture(false)

    const cardObj = creditCards.find((c) => c.id === cid)
    if (t?.invoiceMonth && t?.invoiceYear) {
      setInvoiceMonth(t.invoiceMonth)
      setInvoiceYear(t.invoiceYear)
      setInvoiceManual(true)
    } else if (initialInvoicePeriod) {
      setInvoiceMonth(initialInvoicePeriod.month)
      setInvoiceYear(initialInvoicePeriod.year)
      setInvoiceManual(true)
    } else if (cardObj) {
      const def = defaultInvoicePeriod(dt, cardObj.closingDay, cardObj.dueDay)
      setInvoiceMonth(def.month)
      setInvoiceYear(def.year)
      setInvoiceManual(false)
    } else {
      setInvoiceManual(false)
    }
  }, [open, transaction, defaultAccountId, defaultCreditCardId, initialInvoicePeriod, accounts, creditCards])

  // Recalcula automaticamente a fatura quando a data ou cartão mudam (se o usuário não editou manualmente a fatura)
  useEffect(() => {
    if (!open || editing || sourceMode !== 'CARD' || !selectedCard || invoiceManual) return
    const def = defaultInvoicePeriod(date, selectedCard.closingDay, selectedCard.dueDay)
    setInvoiceMonth(def.month)
    setInvoiceYear(def.year)
  }, [open, editing, sourceMode, selectedCard, date, invoiceManual])

  const filteredGroupCategories = useMemo(
    () => groupCategories.filter((c) => type === 'TRANSFER' || c.type === 'BOTH' || c.type === type),
    [groupCategories, type],
  )
  const filteredMyCategories = useMemo(
    () => myCategories.filter((c) => type === 'TRANSFER' || c.type === 'BOTH' || c.type === type),
    [myCategories, type],
  )

  const invoiceOptions = useMemo(() => {
    const base = new Date()
    return Array.from({ length: 18 }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth() - 3 + i, 1)
      const m = d.getMonth() + 1
      const y = d.getFullYear()
      return { value: `${y}-${m}`, month: m, year: y, label: monthLabel(m, y) }
    })
  }, [])

  const save = useAction(
    (body: CreateTransactionInput | UpdateTransactionInput) =>
      transaction ? api.put(`/transactions/${transaction.id}`, body) : api.post('/transactions', body),
    { invalidate: ALL_MONEY, success: editing ? 'Transação atualizada' : 'Transação criada', onSuccess: onClose },
  )

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || amount <= 0) return
    if (editing) {
      save.mutate({
        title: title.trim(),
        amount,
        date,
        categoryId: categoryId || null,
        status,
        updateAllFuture: allFuture,
        invoiceMonth: transaction?.creditCardId ? invoiceMonth : null,
        invoiceYear: transaction?.creditCardId ? invoiceYear : null,
      })
    } else if (sourceMode === 'CARD') {
      if (!selectedCard) return
      save.mutate({
        title: title.trim(),
        amount,
        date,
        accountId: selectedCard.accountId,
        type: 'EXPENSE',
        status: 'COMPLETED',
        destinationAccountId: null,
        categoryId: categoryId || null,
        isRecurring: recurring,
        recurrenceFrequency: recurring ? (infinite ? freq : 'MONTHLY') : null,
        recurrenceInterval: interval,
        recurrenceInstallments: installments,
        isInfinite: recurring && infinite,
        creditCardId: selectedCard.id,
        invoiceMonth,
        invoiceYear,
        installmentAmountMode: recurring && !infinite ? installmentAmountMode : 'INSTALLMENT',
      })
    } else {
      if (!accountId || (type === 'TRANSFER' && !destId)) return
      save.mutate({
        title: title.trim(),
        amount,
        date,
        accountId,
        type,
        status,
        destinationAccountId: type === 'TRANSFER' ? destId : null,
        categoryId: type !== 'TRANSFER' && categoryId ? categoryId : null,
        isRecurring: recurring,
        recurrenceFrequency: recurring ? freq : null,
        recurrenceInterval: interval,
        recurrenceInstallments: installments,
        isInfinite: recurring && infinite,
        installmentAmountMode: recurring && !infinite ? installmentAmountMode : 'INSTALLMENT',
      })
    }
  }

  const isInstallmentPlan = recurring && !infinite && installments > 1
  const perInstallmentPreview =
    isInstallmentPlan && installmentAmountMode === 'TOTAL' ? Math.floor(amount / installments) : amount
  const totalPreview = isInstallmentPlan && installmentAmountMode === 'INSTALLMENT' ? amount * installments : amount

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar transação' : 'Nova transação'}>
      <form className="space-y-4" onSubmit={submit}>
        {!editing && creditCards.length > 0 && (
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
            <button
              type="button"
              onClick={() => setSourceMode('ACCOUNT')}
              className={clsx(
                'rounded-lg py-2 text-xs font-medium transition',
                sourceMode === 'ACCOUNT' ? 'bg-primary text-white' : 'text-muted hover:text-text',
              )}
            >
              Conta bancária
            </button>
            <button
              type="button"
              onClick={() => {
                setSourceMode('CARD')
                setType('EXPENSE')
                if (!creditCardId && creditCards[0]) setCreditCardId(creditCards[0].id)
              }}
              className={clsx(
                'rounded-lg py-2 text-xs font-medium transition',
                sourceMode === 'CARD' ? 'bg-primary text-white' : 'text-muted hover:text-text',
              )}
            >
              Cartão de crédito
            </button>
          </div>
        )}

        {!editing && sourceMode === 'ACCOUNT' && (
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
            {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => {
                  setType(t)
                  setCategoryId('')
                }}
                className={clsx(
                  'rounded-lg py-2 text-sm font-medium transition',
                  type === t
                    ? t === 'EXPENSE'
                      ? 'bg-expense text-white'
                      : t === 'INCOME'
                        ? 'bg-income text-black'
                        : 'bg-primary text-white'
                    : 'text-muted',
                )}
              >
                {txTypeLabel[t]}
              </button>
            ))}
          </div>
        )}

        <Field label="Título">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={isInstallmentPlan ? (installmentAmountMode === 'TOTAL' ? 'Valor total' : 'Valor da parcela') : 'Valor'}>
            <MoneyInput value={amount} onChange={setAmount} />
          </Field>
          <Field label="Data da compra">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
        </div>

        {!editing && sourceMode === 'CARD' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cartão de crédito">
              <Select
                value={creditCardId}
                onChange={(e) => {
                  setCreditCardId(e.target.value)
                  setInvoiceManual(false)
                }}
                required
              >
                <option value="">Selecione…</option>
                {creditCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fatura de referência" hint="Calculada pelo fechamento (editável)">
              <Select
                value={`${invoiceYear}-${invoiceMonth}`}
                onChange={(e) => {
                  const [y, m] = e.target.value.split('-').map(Number)
                  setInvoiceYear(y)
                  setInvoiceMonth(m)
                  setInvoiceManual(true)
                }}
              >
                {invoiceOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        {editing && transaction?.creditCardId && (
          <Field label="Fatura de referência">
            <Select
              value={`${invoiceYear}-${invoiceMonth}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-').map(Number)
                setInvoiceYear(y)
                setInvoiceMonth(m)
              }}
            >
              {invoiceOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {!editing && sourceMode === 'ACCOUNT' && (
          <Field label={type === 'TRANSFER' ? 'Conta de origem' : 'Conta'}>
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
              <option value="">Selecione…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {!editing && sourceMode === 'ACCOUNT' && type === 'TRANSFER' && (
          <Field label="Conta de destino">
            <Select value={destId} onChange={(e) => setDestId(e.target.value)} required>
              <option value="">Selecione…</option>
              {accounts
                .filter((a) => a.id !== accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </Select>
          </Field>
        )}

        {type !== 'TRANSFER' && (
          <Field label="Categoria">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Sem categoria</option>
              {effectiveGroupId && filteredGroupCategories.length > 0 ? (
                <>
                  <optgroup label="Categorias do grupo">
                    {filteredGroupCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon ? `${c.icon} ` : ''}
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                  {filteredMyCategories.length > 0 && (
                    <optgroup label="Minhas categorias">
                      {filteredMyCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icon ? `${c.icon} ` : ''}
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </>
              ) : (
                filteredMyCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ''}
                    {c.name}
                  </option>
                ))
              )}
            </Select>
          </Field>
        )}

        {sourceMode === 'ACCOUNT' && !transaction?.creditCardId && (
          <label className="flex items-center gap-3 rounded-xl bg-surface-2 p-3 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-indigo-500"
              checked={status === 'COMPLETED'}
              onChange={(e) => setStatus(e.target.checked ? 'COMPLETED' : 'PENDING')}
            />
            {type === 'INCOME' ? 'Recebida' : type === 'TRANSFER' ? 'Efetivada' : 'Paga'}
          </label>
        )}

        {!editing && (
          <div className="space-y-3 rounded-xl border border-border p-3">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-indigo-500"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
              />
              {sourceMode === 'CARD' ? 'Parcelado ou Assinatura recorrente' : 'Transação recorrente'}
            </label>
            {recurring && (
              <>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
                  <button
                    type="button"
                    onClick={() => setInfinite(false)}
                    className={clsx(
                      'rounded-lg py-1.5 text-xs font-medium transition',
                      !infinite ? 'bg-primary text-white' : 'text-muted',
                    )}
                  >
                    Parcelado (compromete total)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfinite(true)}
                    className={clsx(
                      'rounded-lg py-1.5 text-xs font-medium transition',
                      infinite ? 'bg-primary text-white' : 'text-muted',
                    )}
                  >
                    Assinatura (mês a mês)
                  </button>
                </div>

                {infinite ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Frequência">
                      <Select value={freq} onChange={(e) => setFreq(e.target.value as RecurrenceFrequency)}>
                        {Object.entries(freqLabel).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="A cada (intervalo)">
                      <Input
                        type="number"
                        min={1}
                        value={interval}
                        onChange={(e) => setInterval_(Math.max(1, Number(e.target.value)))}
                      />
                    </Field>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Nº de parcelas">
                        <Input
                          type="number"
                          min={2}
                          value={installments}
                          onChange={(e) => setInstallments(Math.max(2, Number(e.target.value)))}
                        />
                      </Field>
                      <Field label="O valor digitado acima é">
                        <Select
                          value={installmentAmountMode}
                          onChange={(e) => setInstallmentAmountMode(e.target.value as 'INSTALLMENT' | 'TOTAL')}
                        >
                          <option value="TOTAL">Valor total da compra</option>
                          <option value="INSTALLMENT">Valor de cada parcela</option>
                        </Select>
                      </Field>
                    </div>
                    {amount > 0 && (
                      <p className="text-xs text-muted">
                        Resumo: <b>{installments}x</b> de <b>{formatMoney(perInstallmentPreview)}</b> (total{' '}
                        <b>{formatMoney(totalPreview)}</b>)
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {editing && transaction?.recurrenceGroupId && (
          <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-indigo-500"
              checked={allFuture}
              onChange={(e) => setAllFuture(e.target.checked)}
            />
            Aplicar a todas as futuras
          </label>
        )}

        <Button type="submit" className="w-full" loading={save.isPending}>
          Salvar
        </Button>
      </form>
    </Modal>
  )
}
