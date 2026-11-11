import { useEffect, useMemo, useState } from 'react'
import { Plus, Split, Trash2, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { ALL_MONEY, useAccessibleAccounts, useAction, useAllCategories, useCreditCards } from '@/lib/hooks'
import type {
  CreateTransactionInput,
  RecurrenceFrequency,
  Transaction,
  TransactionStatus,
  TransactionType,
  UpdateTransactionInput,
} from '@/lib/types'
import { defaultInvoicePeriod, formatMoney, freqLabel, fullName, monthLabel, toISODate, txTypeLabel } from '@/lib/format'
import { Button, Checkbox, DatePicker, Field, Input, Modal, MoneyInput, NumberInput, Select } from './ui'
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
  const { data: allCategories = [], myCategories = [], groupsCategories = [] } = useAllCategories()

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
  const [splitUnit, setSplitUnit] = useState<'AMOUNT' | 'PERCENT'>('AMOUNT')
  const [splits, setSplits] = useState<{ accountId: string; amount: number; percentage: number }[]>([])

  const canSplit = !editing && sourceMode === 'ACCOUNT' && type !== 'TRANSFER' && accounts.length >= 2
  const activeSplit = canSplit && splitMode
  const splitsSum = useMemo(() => splits.reduce((s, item) => s + item.amount, 0), [splits])
  const splitsPctSum = useMemo(
    () => Number(splits.reduce((s, item) => s + (Number.isFinite(item.percentage) ? item.percentage : 0), 0).toFixed(2)),
    [splits],
  )

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
    setSplitUnit('AMOUNT')
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

  const filterCat = (c: { type: string }) => type === 'TRANSFER' || c.type === 'BOTH' || c.type === type

  const sortedGroupsCategories = useMemo(() => {
    if (!effectiveGroupId) return groupsCategories
    return [...groupsCategories].sort((a, b) => {
      if (a.group.id === effectiveGroupId) return -1
      if (b.group.id === effectiveGroupId) return 1
      return 0
    })
  }, [groupsCategories, effectiveGroupId])

  const filteredMyCategories = useMemo(
    () => myCategories.filter(filterCat),
    [myCategories, type],
  )

  const renderedCategoryIds = useMemo(() => {
    const ids = new Set<string>()
    filteredMyCategories.forEach((c) => ids.add(c.id))
    sortedGroupsCategories.forEach(({ categories: gCats }) => {
      gCats.filter(filterCat).forEach((c) => ids.add(c.id))
    })
    return ids
  }, [filteredMyCategories, sortedGroupsCategories, type])

  const missingCategory = useMemo(() => {
    if (!categoryId || renderedCategoryIds.has(categoryId)) return null
    return (
      allCategories.find((c) => c.id === categoryId) ??
      ({ id: categoryId, name: 'Categoria selecionada', icon: null } as {
        id: string
        name: string
        icon?: string | null
      })
    )
  }, [categoryId, renderedCategoryIds, allCategories])

  const handleTypeChange = (newType: TransactionType) => {
    if (newType === type) return
    setType(newType)
    if (categoryId) {
      const selectedCat = allCategories.find((c) => c.id === categoryId)
      if (newType !== 'TRANSFER' && selectedCat && selectedCat.type !== 'BOTH' && selectedCat.type !== newType) {
        setCategoryId('')
      }
    }
  }

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

  const applyPercentagesToAmounts = (
    rows: { accountId: string; amount: number; percentage: number }[],
    totalCents: number,
  ) => {
    const pctSum = rows.reduce((s, r) => s + (Number.isFinite(r.percentage) ? r.percentage : 0), 0)
    const computed = rows.map((r) => ({
      ...r,
      amount: totalCents > 0 ? Math.round((totalCents * (r.percentage || 0)) / 100) : 0,
    }))
    if (totalCents > 0 && Math.abs(pctSum - 100) < 0.05 && computed.length > 0) {
      const currentSum = computed.reduce((s, r) => s + r.amount, 0)
      const diff = totalCents - currentSum
      if (diff !== 0) {
        const targetIdx = computed.findIndex((r) => r.percentage > 0)
        const idx = targetIdx >= 0 ? targetIdx : 0
        computed[idx] = { ...computed[idx], amount: Math.max(0, computed[idx].amount + diff) }
      }
    }
    return computed
  }

  const handleTotalAmountChange = (newCents: number) => {
    setAmount(newCents)
    if (activeSplit && splitUnit === 'PERCENT') {
      setSplits((prev) => applyPercentagesToAmounts(prev, newCents))
    }
  }

  const switchSplitUnit = (unit: 'AMOUNT' | 'PERCENT') => {
    if (unit === splitUnit) return
    setSplitUnit(unit)
    if (unit === 'PERCENT' && splits.length > 0) {
      const refTotal = splitsSum > 0 ? splitsSum : amount
      if (refTotal > 0 && splitsSum > 0) {
        const withPct = splits.map((s) => ({
          ...s,
          percentage: Number(((s.amount / splitsSum) * 100).toFixed(2)),
        }))
        const sumPct = Number(withPct.reduce((acc, r) => acc + r.percentage, 0).toFixed(2))
        const diffPct = Number((100 - sumPct).toFixed(2))
        if (Math.abs(diffPct) <= 0.1 && withPct.length > 0) {
          withPct[0].percentage = Number((withPct[0].percentage + diffPct).toFixed(2))
        }
        setSplits(withPct)
      } else {
        const eqPct = Number((100 / splits.length).toFixed(2))
        const remPct = Number((100 - eqPct * splits.length).toFixed(2))
        const withPct = splits.map((s, i) => ({
          ...s,
          percentage: i === 0 ? Number((eqPct + remPct).toFixed(2)) : eqPct,
        }))
        setSplits(applyPercentagesToAmounts(withPct, amount))
      }
    }
  }

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
      { accountId: firstId, amount: base + rem, percentage: secondId ? 50 : 100 },
      ...(secondId ? [{ accountId: secondId, amount: base, percentage: 50 }] : []),
    ])
    setSplitMode(true)
  }

  const addSplitRow = () => {
    if (splits.length >= 10 || splits.length >= accounts.length) return
    const used = new Set(splits.map((s) => s.accountId))
    const nextAcc = accounts.find((a) => !used.has(a.id))
    if (!nextAcc) return
    if (splitUnit === 'PERCENT') {
      const remPct = Math.max(0, Number((100 - splitsPctSum).toFixed(2)))
      setSplits((prev) =>
        applyPercentagesToAmounts([...prev, { accountId: nextAcc.id, amount: 0, percentage: remPct }], amount),
      )
    } else {
      const remaining = Math.max(0, amount - splitsSum)
      const pct = amount > 0 ? Number(((remaining / amount) * 100).toFixed(2)) : 0
      setSplits((prev) => [...prev, { accountId: nextAcc.id, amount: remaining, percentage: pct }])
    }
  }

  const removeSplitRow = (idx: number) => {
    if (splits.length <= 2) return
    setSplits((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      if (splitUnit === 'PERCENT') {
        return applyPercentagesToAmounts(next, amount)
      }
      const nextSum = next.reduce((s, item) => s + item.amount, 0)
      if (amount === splitsSum) setAmount(nextSum)
      return next
    })
  }

  const updateSplitAmount = (idx: number, cents: number) => {
    setSplits((prev) => {
      const next = prev.map((item, i) => (i === idx ? { ...item, amount: cents } : item))
      const nextSum = next.reduce((s, item) => s + item.amount, 0)
      const effectiveTotal = amount === 0 || amount === splitsSum ? nextSum : amount
      if (amount === 0 || amount === splitsSum) {
        setAmount(nextSum)
      }
      return next.map((item) => ({
        ...item,
        percentage: effectiveTotal > 0 ? Number(((item.amount / effectiveTotal) * 100).toFixed(2)) : 0,
      }))
    })
  }

  const updateSplitPercentage = (idx: number, rawPct: string) => {
    const parsed = rawPct === '' ? 0 : Math.min(100, Math.max(0, Number(rawPct)))
    setSplits((prev) => {
      const next = prev.map((item, i) => (i === idx ? { ...item, percentage: parsed } : item))
      return applyPercentagesToAmounts(next, amount)
    })
  }

  const updateSplitAccount = (idx: number, newAccId: string) => {
    setSplits((prev) => prev.map((item, i) => (i === idx ? { ...item, accountId: newAccId } : item)))
  }

  const divideEqually = () => {
    if (splits.length === 0) return
    const targetTotal = amount > 0 ? amount : splitsSum
    const eqPct = Number((100 / splits.length).toFixed(2))
    const remPct = Number((100 - eqPct * splits.length).toFixed(2))
    const base = targetTotal > 0 ? Math.floor(targetTotal / splits.length) : 0
    const rem = targetTotal > 0 ? targetTotal - base * splits.length : 0
    setSplits((prev) =>
      prev.map((item, i) => ({
        ...item,
        amount: i === 0 ? base + rem : base,
        percentage: i === 0 ? Number((eqPct + remPct).toFixed(2)) : eqPct,
      })),
    )
    if (targetTotal > 0) setAmount(targetTotal)
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
      if (splitUnit === 'PERCENT') {
        if (amount <= 0) {
          toast.error('Informe o valor total da transação para dividir por porcentagem.')
          return
        }
        if (Math.abs(splitsPctSum - 100) > 0.1) {
          toast.error(`A soma das porcentagens (${splitsPctSum}%) deve ser igual a 100%.`)
          return
        }
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
        splits: splits.map(({ accountId: accId, amount: rowAmount }) => ({
          accountId: accId,
          amount: rowAmount,
        })),
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
        categoryId: categoryId || null,
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
      <form noValidate className="space-y-4" onSubmit={submit}>
        {!editing && creditCards.length > 0 && (
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1 border border-border card-highlight">
            <button
              type="button"
              onClick={() => setSourceMode('ACCOUNT')}
              className={clsx(
                'rounded-lg py-2 text-xs font-medium transition-all duration-150 cursor-pointer select-none active:scale-[0.98]',
                sourceMode === 'ACCOUNT' ? 'bg-violet text-white font-semibold shadow-[0_1px_3px_rgba(125,57,235,0.3)]' : 'text-text-muted hover:text-white',
              )}
            >
              Conta bancária
            </button>
            <button
              type="button"
              onClick={() => {
                setSourceMode('CARD')
                handleTypeChange('EXPENSE')
                if (!creditCardId && creditCards[0]) setCreditCardId(creditCards[0].id)
              }}
              className={clsx(
                'rounded-lg py-2 text-xs font-medium transition-all duration-150 cursor-pointer select-none active:scale-[0.98]',
                sourceMode === 'CARD' ? 'bg-violet text-white font-semibold shadow-[0_1px_3px_rgba(125,57,235,0.3)]' : 'text-text-muted hover:text-white',
              )}
            >
              Cartão de crédito
            </button>
          </div>
        )}

        {!editing && sourceMode === 'ACCOUNT' && (
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1 border border-border card-highlight">
            {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => handleTypeChange(t)}
                className={clsx(
                  'rounded-lg py-2 text-xs font-semibold transition-all duration-150 cursor-pointer select-none active:scale-[0.98]',
                  type === t
                    ? t === 'EXPENSE'
                      ? 'bg-expense text-white shadow-[0_1px_4px_rgba(255,77,106,0.35)] font-bold'
                      : t === 'INCOME'
                        ? 'bg-lime text-black shadow-[0_1px_4px_rgba(198,255,51,0.35)] font-bold'
                        : 'bg-violet text-white shadow-[0_1px_4px_rgba(125,57,235,0.35)] font-bold'
                    : 'text-text-muted hover:text-white',
                )}
              >
                {txTypeLabel[t]}
              </button>
            ))}
          </div>
        )}

        <Field label="Título">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ex.: Mercado, Salário, Transferência…" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={isInstallmentPlan ? (installmentAmountMode === 'TOTAL' ? 'Valor total' : 'Valor da parcela') : 'Valor'}>
            <MoneyInput value={amount} onChange={handleTotalAmountChange} />
          </Field>
          <Field label="Data da compra">
            <DatePicker value={date} onChange={(e) => setDate(e.target.value)} required />
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
                <span className="text-xs font-medium text-text-dim">
                  {activeSplit ? `Dividindo entre ${splits.length} contas (máx. 10)` : 'Conta'}
                </span>
                <button
                  type="button"
                  onClick={toggleSplitMode}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer select-none',
                    activeSplit
                      ? 'bg-violet text-white font-semibold'
                      : 'bg-surface-2 text-violet-hover hover:bg-violet/20',
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
                  <div className="inline-flex rounded-xl bg-surface-1 p-0.5 border border-border">
                    <button
                      type="button"
                      onClick={() => switchSplitUnit('AMOUNT')}
                      className={clsx(
                        'rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer',
                        splitUnit === 'AMOUNT' ? 'bg-violet text-white font-semibold' : 'text-text-muted hover:text-white',
                      )}
                    >
                      Por valor (R$)
                    </button>
                    <button
                      type="button"
                      onClick={() => switchSplitUnit('PERCENT')}
                      className={clsx(
                        'rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer',
                        splitUnit === 'PERCENT' ? 'bg-violet text-white font-semibold' : 'text-text-muted hover:text-white',
                      )}
                    >
                      Por porcentagem (%)
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={divideEqually}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-1 px-2.5 py-1 text-xs font-medium text-white hover:bg-surface-2 transition cursor-pointer"
                    >
                      <Wand2 className="size-3" /> Dividir igualmente
                    </button>
                    {splits.length < 10 && splits.length < accounts.length && (
                      <button
                        type="button"
                        onClick={addSplitRow}
                        className="inline-flex items-center gap-1 rounded-lg bg-violet/15 px-2.5 py-1 text-xs font-medium text-violet-hover hover:bg-violet/25 transition cursor-pointer"
                      >
                        <Plus className="size-3" /> Conta
                      </button>
                    )}
                  </div>
                </div>

                {splitUnit === 'PERCENT' && amount <= 0 && (
                  <p className="rounded-xl bg-surface-2 border border-border px-3 py-2 text-xs text-text-muted">
                    Preencha o campo <b className="text-white">Valor</b> acima para calcular os valores de cada conta a partir da porcentagem.
                  </p>
                )}

                <div className="space-y-2">
                  {splits.map((row, idx) => {
                    const usedByOthers = new Set(splits.filter((_, i) => i !== idx).map((s) => s.accountId))
                    const availableAccounts = accounts.filter((a) => !usedByOthers.has(a.id))
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="grid grid-cols-[1fr_9rem_auto] items-center gap-2">
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
                          {splitUnit === 'AMOUNT' ? (
                            <MoneyInput value={row.amount} onChange={(cents) => updateSplitAmount(idx, cents)} />
                          ) : (
                            <div className="relative">
                              <NumberInput
                                min={0}
                                max={100}
                                step="0.01"
                                value={row.percentage || ''}
                                placeholder="0"
                                onChange={(e) => updateSplitPercentage(idx, e.target.value)}
                                className="pr-7 text-right"
                              />
                              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-text-dim">
                                %
                              </span>
                            </div>
                          )}
                          <button
                            type="button"
                            disabled={splits.length <= 2}
                            onClick={() => removeSplitRow(idx)}
                            className="rounded-lg p-2 text-text-dim hover:text-white transition disabled:opacity-20 cursor-pointer"
                            aria-label="Remover conta da divisão"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        {splitUnit === 'PERCENT' && amount > 0 && (
                          <div className="flex justify-end pr-10 text-[11px] text-text-dim">
                            Equivale a <b className="ml-1 text-white tabular-nums">{formatMoney(row.amount)}</b>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-xs">
                  {splitUnit === 'PERCENT' ? (
                    <>
                      <span className="text-text-dim">
                        Total:{' '}
                        <b className={clsx('tabular-nums', Math.abs(splitsPctSum - 100) <= 0.05 ? 'text-lime' : 'text-white')}>
                          {splitsPctSum}%
                        </b>{' '}
                        ({formatMoney(splitsSum)})
                      </span>
                      {Math.abs(splitsPctSum - 100) > 0.05 && (
                        <span className="font-medium text-white tabular-nums">
                          {splitsPctSum < 100
                            ? `Faltam ${Number((100 - splitsPctSum).toFixed(2))}% para 100%`
                            : `Passou ${Number((splitsPctSum - 100).toFixed(2))}% de 100%`}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-text-dim">
                        Soma das contas: <b className="text-white tabular-nums">{formatMoney(splitsSum)}</b>
                      </span>
                      {amount > 0 && splitsSum !== amount && (
                        <button
                          type="button"
                          onClick={() => setAmount(splitsSum)}
                          className="font-medium underline text-lime hover:text-white transition cursor-pointer"
                        >
                          {splitsSum < amount
                            ? `Faltam ${formatMoney(amount - splitsSum)} (usar soma)`
                            : `Passou ${formatMoney(splitsSum - amount)} (usar soma)`}
                        </button>
                      )}
                    </>
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

        <Field label="Categoria">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sem categoria</option>
            {missingCategory && (
              <option value={missingCategory.id}>
                {missingCategory.icon ? `${missingCategory.icon} ` : ''}
                {missingCategory.name}
              </option>
            )}
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
            {sortedGroupsCategories.map(({ group, categories: gCats }) => {
              const filtered = gCats.filter(filterCat)
              if (filtered.length === 0) return null
              return (
                <optgroup key={group.id} label={`Categorias: ${group.name}`}>
                  {filtered.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon ? `${c.icon} ` : ''}
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </Select>
        </Field>

        {sourceMode === 'ACCOUNT' && !transaction?.creditCardId && (
          <div className="rounded-xl bg-surface-2 p-3 border border-border">
            <Checkbox
              checked={status === 'COMPLETED'}
              onChange={(checked) => setStatus(checked ? 'COMPLETED' : 'PENDING')}
            >
              {type === 'INCOME' ? 'Recebida' : type === 'TRANSFER' ? 'Efetivada' : 'Paga'}
            </Checkbox>
          </div>
        )}

        {!editing && (
          <div className="space-y-3 rounded-2xl border border-border p-3.5 bg-surface-1">
            <Checkbox checked={recurring} onChange={setRecurring}>
              {sourceMode === 'CARD' ? 'Parcelado ou Assinatura recorrente' : 'Transação recorrente'}
            </Checkbox>
            {recurring && (
              <>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1 border border-border">
                  <button
                    type="button"
                    onClick={() => setInfinite(false)}
                    className={clsx(
                      'rounded-lg py-1.5 text-xs font-medium transition cursor-pointer select-none',
                      !infinite ? 'bg-violet text-white font-semibold' : 'text-text-muted hover:text-white',
                    )}
                  >
                    Parcelado (compromete total)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfinite(true)}
                    className={clsx(
                      'rounded-lg py-1.5 text-xs font-medium transition cursor-pointer select-none',
                      infinite ? 'bg-violet text-white font-semibold' : 'text-text-muted hover:text-white',
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
                      <NumberInput
                        showControls
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
                        <NumberInput
                          showControls
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
                      <p className="text-xs text-text-dim">
                        Resumo: <b className="text-white">{installments}x</b> de{' '}
                        <b className="text-white tabular-nums">{formatMoney(perInstallmentPreview)}</b> (total{' '}
                        <b className="text-white tabular-nums">{formatMoney(totalPreview)}</b>)
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {editing && transaction?.recurrenceGroupId && (
          <div className="rounded-xl border border-border p-3 bg-surface-2">
            <Checkbox checked={allFuture} onChange={setAllFuture}>
              Aplicar a todas as futuras
            </Checkbox>
          </div>
        )}

        <Button type="submit" className="w-full" loading={save.isPending}>
          Salvar
        </Button>
      </form>
    </Modal>
  )
}
