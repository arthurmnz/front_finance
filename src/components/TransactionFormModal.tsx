import { useEffect, useMemo, useState } from 'react'
import { Plus, Split, Trash2, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { ALL_MONEY, useAccessibleAccounts, useAction, useCreditCards, useGroupCategories, useMyCategories } from '@/lib/hooks'
import type {
  AccountSplitInput,
  CreateTransactionInput,
  RecurrenceFrequency,
  Transaction,
  TransactionStatus,
  TransactionType,
  UpdateTransactionInput,
} from '@/lib/types'
import { defaultInvoicePeriod, formatMoney, freqLabel, fullName, monthLabel, toISODate, txTypeLabel } from '@/lib/format'
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
  const [splitMode, setSplitMode] = useState(false)
  const [splits, setSplits] = useState<AccountSplitInput[]>([])

  const canSplit = !editing && sourceMode === 'ACCOUNT' && type !== 'TRANSFER' && accounts.length >= 2
  const activeSplit = canSplit && splitMode
  const splitsSum = useMemo(() => splits.reduce((s, item) => s + item.amount, 0), [splits])

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
    if (activeSplit) {
      for (const s of splits) {
        const acc = accounts.find((a) => a.id === s.accountId)
        if (acc?.groupId) return acc.groupId
      }
    }
    return selectedAccount?.groupId ?? undefined
  }, [sourceMode, transaction, selectedCard, selectedAccount, activeSplit, splits, accounts])
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
    setSplitMode(false)
    setSplits([])

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
    // Inicializa apenas quando o modal abre ou a transação alvo muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction?.id, defaultAccountId, defaultCreditCardId, initialInvoicePeriod?.month, initialInvoicePeriod?.year])

  useEffect(() => {
    if (!open || editing) return
    if (!accountId && accounts[0]?.id) setAccountId(defaultAccountId ?? accounts[0].id)
    if (!creditCardId && creditCards[0]?.id) setCreditCardId(defaultCreditCardId ?? creditCards[0].id)
  }, [open, editing, accountId, creditCardId, accounts, creditCards, defaultAccountId, defaultCreditCardId])

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

  const toggleSplitMode = () => {
    if (splitMode) {
      setSplitMode(false)
      return
    }
    const firstId = accountId || accounts[0]?.id || ''
    const secondId = accounts.find((a) => a.id !== firstId)?.id || ''
    const base = amount > 0 ? Math.floor(amount / 2) : 0
    const rem = amount > 0 ? amount - base * 2 : 0
    setSplits([
      { accountId: firstId, amount: base + rem },
      ...(secondId ? [{ accountId: secondId, amount: base }] : []),
    ])
    setSplitMode(true)
  }

  const addSplitRow = () => {
    if (splits.length >= 10 || splits.length >= accounts.length) return
    const used = new Set(splits.map((s) => s.accountId))
    const nextAcc = accounts.find((a) => !used.has(a.id))
    if (!nextAcc) return
    const remaining = Math.max(0, amount - splitsSum)
    setSplits((prev) => [...prev, { accountId: nextAcc.id, amount: remaining }])
  }

  const removeSplitRow = (idx: number) => {
    if (splits.length <= 2) return
    setSplits((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      const nextSum = next.reduce((s, item) => s + item.amount, 0)
      if (amount === splitsSum) setAmount(nextSum)
      return next
    })
  }

  const updateSplitAmount = (idx: number, cents: number) => {
    setSplits((prev) => {
      const next = prev.map((item, i) => (i === idx ? { ...item, amount: cents } : item))
      const nextSum = next.reduce((s, item) => s + item.amount, 0)
      if (amount === 0 || amount === splitsSum) {
        setAmount(nextSum)
      }
      return next
    })
  }

  const updateSplitAccount = (idx: number, newAccId: string) => {
    setSplits((prev) => prev.map((item, i) => (i === idx ? { ...item, accountId: newAccId } : item)))
  }

  const divideEqually = () => {
    const targetTotal = amount > 0 ? amount : splitsSum
    if (targetTotal <= 0 || splits.length === 0) return
    const base = Math.floor(targetTotal / splits.length)
    const rem = targetTotal - base * splits.length
    setSplits((prev) => prev.map((item, i) => ({ ...item, amount: i === 0 ? base + rem : base })))
    setAmount(targetTotal)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const effectiveTotal = activeSplit ? (amount > 0 ? amount : splitsSum) : amount
    if (!title.trim() || effectiveTotal <= 0) return
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
    } else if (activeSplit) {
      if (splits.length < 2 || splits.length > 10) {
        toast.error('Selecione entre 2 e 10 contas para dividir a transação.')
        return
      }
      if (splits.some((s) => !s.accountId)) {
        toast.error('Selecione a conta em todas as linhas da divisão.')
        return
      }
      const distinctIds = new Set(splits.map((s) => s.accountId))
      if (distinctIds.size !== splits.length) {
        toast.error('As contas selecionadas na divisão devem ser distintas.')
        return
      }
      if (splits.some((s) => s.amount <= 0)) {
        toast.error('Informe um valor maior que zero para cada conta participante.')
        return
      }
      if (amount > 0 && splitsSum !== amount) {
        toast.error(`A soma das contas (${formatMoney(splitsSum)}) deve ser igual ao valor total (${formatMoney(amount)}).`)
        return
      }
      save.mutate({
        title: title.trim(),
        amount: splitsSum,
        date,
        accountId: splits[0].accountId,
        type,
        status,
        destinationAccountId: null,
        categoryId: categoryId || null,
        isRecurring: recurring,
        recurrenceFrequency: recurring ? freq : null,
        recurrenceInterval: interval,
        recurrenceInstallments: installments,
        isInfinite: recurring && infinite,
        installmentAmountMode: recurring && !infinite ? installmentAmountMode : 'INSTALLMENT',
        splits,
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
          <div className="space-y-3">
            {canSplit && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">
                  {activeSplit ? `Dividindo entre ${splits.length} contas (máx. 10)` : 'Conta'}
                </span>
                <button
                  type="button"
                  onClick={toggleSplitMode}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition',
                    activeSplit
                      ? 'bg-primary text-white'
                      : 'bg-surface-2 text-primary-hover hover:bg-primary/20',
                  )}
                >
                  <Split className="size-3.5" />
                  {activeSplit ? 'Usar apenas 1 conta' : 'Dividir entre várias contas'}
                </button>
              </div>
            )}

            {activeSplit ? (
              <div className="space-y-2.5 rounded-2xl border border-border bg-surface-2/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted">
                    Escolha quanto cada conta vai {type === 'INCOME' ? 'receber' : 'pagar'}:
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={divideEqually}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text hover:bg-surface-2"
                    >
                      <Wand2 className="size-3" /> Dividir igualmente
                    </button>
                    {splits.length < 10 && splits.length < accounts.length && (
                      <button
                        type="button"
                        onClick={addSplitRow}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary-hover hover:bg-primary/25"
                      >
                        <Plus className="size-3" /> Conta
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {splits.map((row, idx) => {
                    const usedByOthers = new Set(splits.filter((_, i) => i !== idx).map((s) => s.accountId))
                    const availableAccounts = accounts.filter((a) => !usedByOthers.has(a.id))
                    return (
                      <div key={idx} className="grid grid-cols-[1fr_9rem_auto] items-center gap-2">
                        <Select
                          value={row.accountId}
                          onChange={(e) => updateSplitAccount(idx, e.target.value)}
                          required
                        >
                          <option value="">Selecione a conta…</option>
                          {availableAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                              {a.owner ? ` (${fullName(a.owner)})` : ''}
                            </option>
                          ))}
                        </Select>
                        <MoneyInput value={row.amount} onChange={(cents) => updateSplitAmount(idx, cents)} />
                        <button
                          type="button"
                          disabled={splits.length <= 2}
                          onClick={() => removeSplitRow(idx)}
                          className="rounded-lg p-2 text-muted hover:text-expense disabled:opacity-30"
                          aria-label="Remover conta da divisão"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-xs">
                  <span className="text-muted">
                    Soma das contas: <b className="text-text">{formatMoney(splitsSum)}</b>
                  </span>
                  {amount > 0 && splitsSum !== amount && (
                    <button
                      type="button"
                      onClick={() => setAmount(splitsSum)}
                      className={clsx(
                        'font-medium underline',
                        splitsSum < amount ? 'text-warn' : 'text-expense',
                      )}
                    >
                      {splitsSum < amount
                        ? `Faltam ${formatMoney(amount - splitsSum)} (usar soma)`
                        : `Passou ${formatMoney(splitsSum - amount)} (usar soma)`}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <Field label={type === 'TRANSFER' ? 'Conta de origem' : canSplit ? undefined : 'Conta'}>
                <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
                  <option value="">Selecione…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.owner ? ` (${fullName(a.owner)})` : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
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
