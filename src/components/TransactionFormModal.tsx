import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Layers, Plus, RotateCcw, Split, Trash2, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage, updateGroupInstallments } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { isGeneralCategory, isTypeCompatibleWithTransaction, resolveTransactionCategory } from '@/lib/categories'
import { ALL_MONEY, useAccessibleAccounts, useAction, useAllCategories, useCreditCards, useTransactionGroup } from '@/lib/hooks'
import {
  DEFAULT_REMAINDER_STRATEGY,
  MAX_AMOUNT_CENTS,
  REMAINDER_STRATEGY_OPTIONS,
  allocateInstallments,
  summarizeInstallments,
} from '@/lib/installments'
import { canTransferGenerateDebt, filterTransferSourceAccounts, pickTransferSourceAccountId } from '@/lib/jointAccounts'
import type {
  Account,
  Category,
  CategoryInput,
  CategoryType,
  CreateTransactionInput,
  InstallmentAmountMode,
  RecurrenceFrequency,
  RemainderStrategy,
  Transaction,
  TransactionStatus,
  TransactionType,
  UpdateInstallmentGroupAmountsInput,
  UpdateTransactionInput,
} from '@/lib/types'
import { defaultInvoicePeriod, formatAccountLabel, formatDate, formatMoney, freqLabel, fullName, monthLabel, toISODate, txTypeLabel } from '@/lib/format'
import { PALETTE, normalizeCategoryColor } from '@/lib/palette'
import { Alert, Badge, Button, Checkbox, DatePicker, Field, InfoTooltip, Input, Modal, MoneyInput, NumberInput, Select, Skeleton } from './ui'
import clsx from 'clsx'

interface Props {
  open: boolean
  onClose: () => void
  transaction?: Transaction
  defaultAccountId?: string
  defaultCreditCardId?: string
  defaultInvoicePeriod?: { month: number; year: number }
  defaultType?: TransactionType
  defaultDestinationAccountId?: string
  defaultAmount?: number
}

function inferTransactionCategorySelection(
  t: Transaction | undefined,
  catMap: Map<string, Category>,
): { generalId: string; specificId: string } {
  if (!t) return { generalId: '', specificId: '' }
  const hasAny = Boolean(
    t.generalCategoryId ||
      t.specificCategoryId ||
      t.categoryId ||
      t.generalCategory ||
      t.specificCategory ||
      t.category,
  )
  if (!hasAny) return { generalId: '', specificId: '' }

  const resolved = resolveTransactionCategory(t, catMap)
  if (resolved.general) {
    return {
      generalId: resolved.general.id,
      specificId: resolved.specific?.id ?? '',
    }
  }
  if (t.generalCategoryId) {
    return {
      generalId: t.generalCategoryId,
      specificId: t.specificCategoryId ?? resolved.specific?.id ?? '',
    }
  }
  if (resolved.specific) {
    return {
      generalId: '__missing__',
      specificId: resolved.specific.id,
    }
  }
  return {
    generalId: '__missing__',
    specificId: t.specificCategoryId ?? '',
  }
}

function resolveDefaultSourceAccountId(params: {
  accounts: Account[]
  transferSourceAccounts: Account[]
  type: TransactionType
  defaultAccountId?: string
  defaultDestinationAccountId?: string
  destId?: string
  userId?: string
}): string {
  const {
    accounts,
    transferSourceAccounts,
    type,
    defaultAccountId,
    defaultDestinationAccountId,
    destId = '',
    userId,
  } = params
  const allowedAccounts = type === 'TRANSFER' ? transferSourceAccounts : accounts
  const excludedDestId = defaultDestinationAccountId || destId
  const validDefaultAccountId =
    defaultAccountId &&
    (!excludedDestId || type !== 'TRANSFER' || defaultAccountId !== excludedDestId) &&
    allowedAccounts.some((a) => a.id === defaultAccountId)
      ? defaultAccountId
      : undefined

  if (validDefaultAccountId) return validDefaultAccountId
  if (defaultDestinationAccountId) {
    return pickTransferSourceAccountId(accounts, defaultDestinationAccountId, userId) ?? ''
  }
  if (type === 'TRANSFER') {
    return pickTransferSourceAccountId(accounts, destId, userId) ?? ''
  }
  return allowedAccounts[0]?.id ?? ''
}

export default function TransactionFormModal({
  open,
  onClose,
  transaction,
  defaultAccountId,
  defaultCreditCardId,
  defaultInvoicePeriod: initialInvoicePeriod,
  defaultType,
  defaultDestinationAccountId,
  defaultAmount,
}: Props) {
  const { user } = useAuth()
  const editing = !!transaction
  const accountsQuery = useAccessibleAccounts()
  const accounts = accountsQuery.data ?? []
  const transferSourceAccounts = useMemo(
    () => filterTransferSourceAccounts(accounts, user?.id),
    [accounts, user?.id],
  )
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
  const [generatesDebt, setGeneratesDebt] = useState(false)
  const [generalCategoryId, setGeneralCategoryId] = useState('')
  const [specificCategoryId, setSpecificCategoryId] = useState('')
  const [addingSpecific, setAddingSpecific] = useState(false)
  const [newSpecificName, setNewSpecificName] = useState('')
  const [newSpecificIcon, setNewSpecificIcon] = useState('')
  const [newSpecificColor, setNewSpecificColor] = useState<string>(PALETTE[0])
  const [localCreatedSpecifics, setLocalCreatedSpecifics] = useState<Category[]>([])
  const [status, setStatus] = useState<TransactionStatus>('PENDING')
  const [recurring, setRecurring] = useState(false)
  const [freq, setFreq] = useState<RecurrenceFrequency>('MONTHLY')
  const [interval, setInterval_] = useState(1)
  const [installments, setInstallments] = useState(12)
  const [infinite, setInfinite] = useState(false)
  const [installmentAmountMode, setInstallmentAmountMode] = useState<'INSTALLMENT' | 'TOTAL'>('TOTAL')
  const [remainderStrategy, setRemainderStrategy] = useState<RemainderStrategy>(DEFAULT_REMAINDER_STRATEGY)
  const [customizeInstallments, setCustomizeInstallments] = useState(false)
  const [customAmounts, setCustomAmounts] = useState<number[]>([])
  const [allFuture, setAllFuture] = useState(false)
  const [updateFutureAmounts, setUpdateFutureAmounts] = useState(false)
  const [showGroupInstallments, setShowGroupInstallments] = useState(false)
  const [groupDraftAmounts, setGroupDraftAmounts] = useState<Record<string, number>>({})
  const [splitMode, setSplitMode] = useState(false)
  const [splitUnit, setSplitUnit] = useState<'AMOUNT' | 'PERCENT'>('AMOUNT')
  const [splits, setSplits] = useState<{ accountId: string; amount: number; percentage: number }[]>([])

  const qc = useQueryClient()
  const groupQuery = useTransactionGroup(
    transaction?.recurrenceGroupId ?? undefined,
    open && editing && showGroupInstallments && transaction?.installmentNumber != null,
  )

  const sourceAccounts = type === 'TRANSFER' ? transferSourceAccounts : accounts
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
  const destAccount = useMemo(() => accounts.find((a) => a.id === destId), [accounts, destId])
  const editDestAccount = useMemo(
    () => accounts.find((a) => a.id === transaction?.destinationAccountId),
    [accounts, transaction?.destinationAccountId],
  )
  const canGenerateDebt =
    !editing &&
    canTransferGenerateDebt({
      sourceMode,
      type,
      sourceAccount: selectedAccount,
      destAccount,
      userId: user?.id,
    })
  const canEditGeneratesDebt =
    editing &&
    canTransferGenerateDebt({
      sourceMode: 'ACCOUNT',
      type: transaction?.type,
      isCreditCardTx: Boolean(transaction?.creditCardId),
      sourceAccount: selectedAccount,
      destAccount: editDestAccount,
      userId: user?.id,
    })
  const debtRecipientOwner = !editing ? destAccount?.owner : editDestAccount?.owner
  const debtRecipientName = debtRecipientOwner ? fullName(debtRecipientOwner) : 'o destinatário'
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
    const nextType: TransactionType = isCard ? 'EXPENSE' : (t?.type ?? defaultType ?? 'EXPENSE')
    setSourceMode(isCard ? 'CARD' : 'ACCOUNT')
    setType(nextType)
    setTitle(t?.title ?? '')
    setAmount(t?.amount ?? defaultAmount ?? 0)
    const dt = t?.date.slice(0, 10) ?? toISODate(new Date())
    setDate(dt)
    const initialSourceAccount = resolveDefaultSourceAccountId({
      accounts,
      transferSourceAccounts,
      type: nextType,
      defaultAccountId,
      defaultDestinationAccountId,
      destId: defaultDestinationAccountId ?? '',
      userId: user?.id,
    })
    setAccountId(t?.accountId ?? initialSourceAccount)
    const cid = t?.creditCardId ?? defaultCreditCardId ?? creditCards[0]?.id ?? ''
    setCreditCardId(cid)
    setDestId(t?.destinationAccountId ?? defaultDestinationAccountId ?? '')
    setGeneratesDebt(Boolean(t?.generatesDebt))
    const allCatsMap = new Map(allCategories.map((c) => [c.id, c]))
    const initialCatSelection = inferTransactionCategorySelection(t, allCatsMap)
    setGeneralCategoryId(initialCatSelection.generalId)
    setSpecificCategoryId(initialCatSelection.specificId)
    setAddingSpecific(false)
    setNewSpecificName('')
    setNewSpecificIcon('')
    setLocalCreatedSpecifics([])
    setStatus(t?.status ?? 'PENDING')
    setRecurring(false)
    setFreq('MONTHLY')
    setInterval_(1)
    setInstallments(2)
    setInfinite(false)
    setInstallmentAmountMode('TOTAL')
    setRemainderStrategy(DEFAULT_REMAINDER_STRATEGY)
    setCustomizeInstallments(false)
    setCustomAmounts([])
    setAllFuture(false)
    setUpdateFutureAmounts(Boolean(t?.isInfinite))
    setShowGroupInstallments(false)
    setGroupDraftAmounts({})
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
  }, [
    open,
    transaction?.id,
    defaultAccountId,
    defaultCreditCardId,
    initialInvoicePeriod?.month,
    initialInvoicePeriod?.year,
    defaultType,
    defaultDestinationAccountId,
    defaultAmount,
  ])

  useEffect(() => {
    if (!open || editing) return
    const allowedAccounts = type === 'TRANSFER' ? transferSourceAccounts : accounts
    const isCurrentValid = Boolean(accountId && allowedAccounts.some((a) => a.id === accountId))
    if (!isCurrentValid) {
      const fallbackId = resolveDefaultSourceAccountId({
        accounts,
        transferSourceAccounts,
        type,
        defaultAccountId,
        defaultDestinationAccountId,
        destId,
        userId: user?.id,
      })
      if (fallbackId !== accountId) {
        setAccountId(fallbackId)
      }
    }
    if (!creditCardId && creditCards[0]?.id) setCreditCardId(defaultCreditCardId ?? creditCards[0].id)
  }, [
    open,
    editing,
    type,
    accountId,
    destId,
    creditCardId,
    accounts,
    transferSourceAccounts,
    creditCards,
    defaultAccountId,
    defaultCreditCardId,
    defaultDestinationAccountId,
    user?.id,
  ])

  useEffect(() => {
    if (!editing && !canGenerateDebt && generatesDebt) {
      setGeneratesDebt(false)
    }
  }, [editing, canGenerateDebt, generatesDebt])

  // Recalcula automaticamente a fatura quando a data ou cartão mudam (se o usuário não editou manualmente a fatura)
  useEffect(() => {
    if (!open || editing || sourceMode !== 'CARD' || !selectedCard || invoiceManual) return
    const def = defaultInvoicePeriod(date, selectedCard.closingDay, selectedCard.dueDay)
    setInvoiceMonth(def.month)
    setInvoiceYear(def.year)
  }, [open, editing, sourceMode, selectedCard, date, invoiceManual])

  const filterCat = (c: { type: CategoryType }) => isTypeCompatibleWithTransaction(c.type, type)

  const mergedCategories = useMemo(() => {
    const map = new Map<string, Category>()
    allCategories.forEach((c) => map.set(c.id, c))
    localCreatedSpecifics.forEach((c) => map.set(c.id, c))
    return [...map.values()]
  }, [allCategories, localCreatedSpecifics])

  const mergedCatMap = useMemo(() => new Map(mergedCategories.map((c) => [c.id, c])), [mergedCategories])

  // Se as categorias carregarem após a abertura do modal em edição, hidrata geral e específica automaticamente
  useEffect(() => {
    if (!open || !editing || !transaction || generalCategoryId !== '__missing__') return
    const inferred = inferTransactionCategorySelection(transaction, mergedCatMap)
    if (inferred.generalId && inferred.generalId !== '__missing__') {
      setGeneralCategoryId(inferred.generalId)
      setSpecificCategoryId(inferred.specificId)
    } else if (inferred.specificId && inferred.specificId !== specificCategoryId) {
      setSpecificCategoryId(inferred.specificId)
    }
  }, [open, editing, transaction, generalCategoryId, specificCategoryId, mergedCatMap])

  const sortedGroupsCategories = useMemo(() => {
    if (!effectiveGroupId) return groupsCategories
    return [...groupsCategories].sort((a, b) => {
      if (a.group.id === effectiveGroupId) return -1
      if (b.group.id === effectiveGroupId) return 1
      return 0
    })
  }, [groupsCategories, effectiveGroupId])

  const filteredMyGeneralCategories = useMemo(
    () =>
      myCategories
        .filter((c) => !c.groupId && isGeneralCategory(c) && filterCat(c))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [myCategories, type],
  )

  const filteredGroupGeneralCategories = useMemo(
    () =>
      sortedGroupsCategories
        .map(({ group, categories: gCats }) => ({
          group,
          categories: gCats
            .filter((c) => c.groupId === group.id && isGeneralCategory(c) && filterCat(c))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        }))
        .filter((entry) => entry.categories.length > 0),
    [sortedGroupsCategories, type],
  )

  const renderedGeneralCategoryIds = useMemo(() => {
    const ids = new Set<string>()
    filteredMyGeneralCategories.forEach((c) => ids.add(c.id))
    filteredGroupGeneralCategories.forEach(({ categories: gCats }) => {
      gCats.forEach((c) => ids.add(c.id))
    })
    return ids
  }, [filteredMyGeneralCategories, filteredGroupGeneralCategories])

  const selectedGeneralCategory = useMemo(() => {
    if (!generalCategoryId || generalCategoryId === '__missing__') return undefined
    const found = mergedCatMap.get(generalCategoryId)
    if (found) return found
    if (transaction?.generalCategory?.id === generalCategoryId) {
      const g = transaction.generalCategory
      return {
        id: g.id,
        name: g.name,
        color: g.color ?? null,
        icon: g.icon ?? null,
        description: null,
        userId: null,
        groupId: null,
        type: g.type,
        level: 'GENERAL' as const,
        parentId: null,
        parent: null,
        createdAt: '',
        updatedAt: '',
      }
    }
    const parentCandidate = transaction?.specificCategory?.parent ?? transaction?.category?.parent
    if (parentCandidate?.id === generalCategoryId) {
      return {
        id: parentCandidate.id,
        name: parentCandidate.name,
        color: parentCandidate.color ?? null,
        icon: parentCandidate.icon ?? null,
        description: null,
        userId: null,
        groupId: null,
        type: parentCandidate.type,
        level: 'GENERAL' as const,
        parentId: null,
        parent: null,
        createdAt: '',
        updatedAt: '',
      }
    }
    if (transaction?.category?.id === generalCategoryId && isGeneralCategory({ level: transaction.category.level ?? 'GENERAL', parentId: transaction.category.parentId })) {
      const c = transaction.category
      return {
        id: c.id,
        name: c.name,
        color: c.color ?? null,
        icon: c.icon ?? null,
        description: null,
        userId: null,
        groupId: null,
        type: c.type,
        level: 'GENERAL' as const,
        parentId: null,
        parent: null,
        createdAt: '',
        updatedAt: '',
      }
    }
    return undefined
  }, [generalCategoryId, mergedCatMap, transaction?.generalCategory, transaction?.specificCategory, transaction?.category])

  const missingGeneralFallback = useMemo(() => {
    if (!generalCategoryId) return null
    if (generalCategoryId === '__missing__') {
      const txGen = transaction?.generalCategory ?? transaction?.specificCategory?.parent ?? transaction?.category?.parent
      const txSpec = transaction?.specificCategory ?? transaction?.category
      return {
        id: '__missing__',
        label: txGen
          ? `${txGen.icon ? `${txGen.icon} ` : ''}${txGen.name}`
          : txSpec
            ? `${txSpec.icon ? `${txSpec.icon} ` : ''}${txSpec.name} (categoria atual)`
            : 'Categoria atual (membro)',
      }
    }
    if (!renderedGeneralCategoryIds.has(generalCategoryId)) {
      const cat = selectedGeneralCategory
      if (cat) {
        return {
          id: cat.id,
          label: `${cat.icon ? `${cat.icon} ` : ''}${cat.name}`,
        }
      }
    }
    return null
  }, [generalCategoryId, renderedGeneralCategoryIds, selectedGeneralCategory, transaction?.generalCategory, transaction?.specificCategory, transaction?.category])

  const specificCategories = useMemo(() => {
    if (!generalCategoryId || generalCategoryId === '__missing__') return []
    const expectedGroupId = selectedGeneralCategory?.groupId ?? null
    return mergedCategories
      .filter((c) => {
        if (isGeneralCategory(c)) return false
        if (c.parentId !== generalCategoryId && c.parent?.id !== generalCategoryId) return false
        if (selectedGeneralCategory) {
          if (expectedGroupId ? c.groupId !== expectedGroupId : Boolean(c.groupId)) return false
        }
        return filterCat(c)
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [generalCategoryId, mergedCategories, selectedGeneralCategory, type])

  const canCreateSpecificInSelectedGeneral = useMemo(() => {
    if (!selectedGeneralCategory || generalCategoryId === '__missing__') return false
    if (!allCategories.some((c) => c.id === selectedGeneralCategory.id)) return false
    if (selectedGeneralCategory.groupId) {
      const grp = groupsCategories.find((g) => g.group.id === selectedGeneralCategory.groupId)?.group
      return grp?.myRole === 'OWNER' || grp?.myRole === 'ADMIN'
    }
    return !selectedGeneralCategory.userId || selectedGeneralCategory.userId === user?.id
  }, [selectedGeneralCategory, generalCategoryId, allCategories, groupsCategories, user?.id])

  const missingSpecificFallback = useMemo(() => {
    if (!specificCategoryId || !generalCategoryId || generalCategoryId === '__missing__') return null
    if (specificCategories.some((c) => c.id === specificCategoryId)) return null
    const found =
      mergedCatMap.get(specificCategoryId) ??
      (transaction?.specificCategory?.id === specificCategoryId ? transaction.specificCategory : undefined) ??
      (transaction?.category?.id === specificCategoryId ? transaction.category : undefined)
    if (found) {
      return {
        id: found.id,
        label: `${found.icon ? `${found.icon} ` : ''}${found.name}`,
      }
    }
    return { id: specificCategoryId, label: 'Categoria específica atual' }
  }, [specificCategoryId, generalCategoryId, specificCategories, mergedCatMap, transaction?.specificCategory, transaction?.category])

  const selectedSpecificCategory = useMemo(() => {
    if (!specificCategoryId) return undefined
    return (
      mergedCatMap.get(specificCategoryId) ??
      (transaction?.specificCategory?.id === specificCategoryId ? transaction.specificCategory : undefined) ??
      (transaction?.category?.id === specificCategoryId ? transaction.category : undefined)
    )
  }, [specificCategoryId, mergedCatMap, transaction?.specificCategory, transaction?.category])

  const createSpecific = useAction<CategoryInput, Category>(
    (b) => api.post<Category>('/categories', b).then((r) => r.data),
    {
      invalidate: [['categories']],
      success: 'Categoria específica criada',
      onSuccess: (created) => {
        setLocalCreatedSpecifics((prev) => [...prev.filter((x) => x.id !== created.id), created])
        setSpecificCategoryId(created.id)
        setNewSpecificName('')
        setNewSpecificIcon('')
        setAddingSpecific(false)
      },
    },
  )

  const handleCreateSpecific = () => {
    const trimmed = newSpecificName.trim()
    if (!trimmed) {
      toast.error('Informe o nome da categoria específica.')
      return
    }
    if (!selectedGeneralCategory || !canCreateSpecificInSelectedGeneral) return
    const newSubType: CategoryType =
      selectedGeneralCategory.type !== 'BOTH'
        ? selectedGeneralCategory.type
        : type === 'EXPENSE' || type === 'INCOME'
          ? type
          : 'BOTH'

    createSpecific.mutate({
      name: trimmed,
      type: newSubType,
      level: 'SPECIFIC',
      parentId: selectedGeneralCategory.id,
      color: newSpecificColor || selectedGeneralCategory.color || null,
      icon: newSpecificIcon.trim() || null,
      groupId: selectedGeneralCategory.groupId ?? null,
    })
  }

  const handleGeneralCategoryChange = (nextGeneralId: string) => {
    setGeneralCategoryId(nextGeneralId)
    setAddingSpecific(false)
    setNewSpecificName('')
    setNewSpecificIcon('')
    const gen = mergedCatMap.get(nextGeneralId)
    setNewSpecificColor(normalizeCategoryColor(gen?.color))
    if (!nextGeneralId) {
      setSpecificCategoryId('')
      return
    }
    if (nextGeneralId === '__missing__') {
      const inferred = inferTransactionCategorySelection(transaction, mergedCatMap)
      setSpecificCategoryId(inferred.specificId)
      return
    }
    setSpecificCategoryId('')
  }

  const handleTypeChange = (newType: TransactionType) => {
    if (newType === type) return
    setType(newType)
    if (newType === 'TRANSFER') {
      const isValidSource = Boolean(accountId && transferSourceAccounts.some((a) => a.id === accountId))
      if (!isValidSource) {
        const nextSourceId = pickTransferSourceAccountId(accounts, destId, user?.id) ?? ''
        setAccountId(nextSourceId)
        if (nextSourceId && nextSourceId === destId) {
          setDestId('')
        }
      } else if (accountId === destId) {
        setDestId('')
      }
    }
    if (generalCategoryId && generalCategoryId !== '__missing__') {
      const genCat = mergedCatMap.get(generalCategoryId)
      if (genCat && !isTypeCompatibleWithTransaction(genCat.type, newType)) {
        setGeneralCategoryId('')
        setSpecificCategoryId('')
        setAddingSpecific(false)
        return
      }
    }
    if (specificCategoryId) {
      const selectedCat = mergedCatMap.get(specificCategoryId)
      if (selectedCat && !isTypeCompatibleWithTransaction(selectedCat.type, newType)) {
        setSpecificCategoryId('')
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
    setCustomizeInstallments(false)
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

  const isInstallmentPlan = !editing && recurring && !infinite && installments > 1
  const isCustomInstallmentMode = isInstallmentPlan && !activeSplit && customizeInstallments

  const buildDefaultCustomAmounts = (
    targetAmount: number,
    count: number,
    mode: 'INSTALLMENT' | 'TOTAL',
    strategy: RemainderStrategy,
  ): number[] => {
    const safeCount = Math.min(365, Math.max(2, Math.floor(count || 2)))
    if (mode === 'TOTAL') {
      return targetAmount >= safeCount
        ? allocateInstallments(targetAmount, safeCount, strategy)
        : new Array<number>(safeCount).fill(0)
    }
    return new Array<number>(safeCount).fill(Math.max(0, targetAmount))
  }

  const handleInstallmentsChange = (rawCount: number) => {
    const nextCount = Math.min(365, Math.max(2, Math.floor(rawCount || 2)))
    setInstallments(nextCount)
    if (customizeInstallments) {
      setCustomAmounts((prev) => {
        if (nextCount <= prev.length) return prev.slice(0, nextCount)
        const fillValue = prev[prev.length - 1] ?? 0
        return [...prev, ...new Array<number>(nextCount - prev.length).fill(fillValue)]
      })
    }
  }

  const handleToggleCustomizeInstallments = () => {
    if (customizeInstallments) {
      setCustomizeInstallments(false)
      return
    }
    setCustomAmounts(buildDefaultCustomAmounts(amount, installments, installmentAmountMode, remainderStrategy))
    setCustomizeInstallments(true)
  }

  const handleCustomAmountChange = (idx: number, cents: number) => {
    setCustomAmounts((prev) => prev.map((v, i) => (i === idx ? cents : v)))
  }

  const handleResetCustomAmounts = () => {
    setCustomAmounts(buildDefaultCustomAmounts(amount, installments, installmentAmountMode, remainderStrategy))
  }

  const customTotal = useMemo(() => customAmounts.reduce((sum, v) => sum + v, 0), [customAmounts])
  const expectedTotalForCustom = installmentAmountMode === 'TOTAL' ? amount : amount * installments
  const customDiff = customTotal - expectedTotalForCustom

  const effectiveInstallmentAmounts = useMemo(() => {
    if (!isInstallmentPlan) return []
    if (isCustomInstallmentMode) return customAmounts
    if (installmentAmountMode === 'TOTAL') {
      return amount >= installments ? allocateInstallments(amount, installments, remainderStrategy) : []
    }
    return amount > 0 ? new Array<number>(installments).fill(amount) : []
  }, [isInstallmentPlan, isCustomInstallmentMode, customAmounts, installmentAmountMode, amount, installments, remainderStrategy])

  const installmentSummaryText = useMemo(
    () => (effectiveInstallmentAmounts.length > 0 ? summarizeInstallments(effectiveInstallmentAmounts) : ''),
    [effectiveInstallmentAmounts],
  )

  const effectiveTotalPreview = isCustomInstallmentMode
    ? customTotal
    : isInstallmentPlan && installmentAmountMode === 'INSTALLMENT'
      ? amount * installments
      : amount

  const sortedGroupTransactions = useMemo(() => {
    const list = groupQuery.data ?? []
    return [...list].sort((a, b) => {
      const nDiff = (a.installmentNumber ?? Number.MAX_SAFE_INTEGER) - (b.installmentNumber ?? Number.MAX_SAFE_INTEGER)
      if (nDiff !== 0) return nDiff
      return a.date.localeCompare(b.date)
    })
  }, [groupQuery.data])

  useEffect(() => {
    if (!open || !editing || !showGroupInstallments || !groupQuery.data) return
    const nextDraft: Record<string, number> = {}
    groupQuery.data.forEach((item) => {
      nextDraft[item.id] = item.amount
    })
    setGroupDraftAmounts(nextDraft)
  }, [open, editing, showGroupInstallments, groupQuery.data, groupQuery.dataUpdatedAt])

  const groupDraftAmountsList = useMemo(
    () => sortedGroupTransactions.map((item) => groupDraftAmounts[item.id] ?? item.amount),
    [sortedGroupTransactions, groupDraftAmounts],
  )
  const groupDraftTotal = useMemo(
    () => groupDraftAmountsList.reduce((sum, v) => sum + v, 0),
    [groupDraftAmountsList],
  )
  const originalGroupTotal = useMemo(
    () => sortedGroupTransactions.reduce((sum, item) => sum + item.amount, 0),
    [sortedGroupTransactions],
  )
  const hasGroupChanges = useMemo(
    () => sortedGroupTransactions.some((item) => (groupDraftAmounts[item.id] ?? item.amount) !== item.amount),
    [sortedGroupTransactions, groupDraftAmounts],
  )
  const hasInvalidGroupAmount = useMemo(
    () => sortedGroupTransactions.some((item) => (groupDraftAmounts[item.id] ?? item.amount) <= 0),
    [sortedGroupTransactions, groupDraftAmounts],
  )
  const hasOverLimitGroupAmount = useMemo(
    () =>
      groupDraftTotal > MAX_AMOUNT_CENTS ||
      sortedGroupTransactions.some((item) => (groupDraftAmounts[item.id] ?? item.amount) > MAX_AMOUNT_CENTS),
    [groupDraftTotal, sortedGroupTransactions, groupDraftAmounts],
  )

  const saveGroupInstallments = useMutation({
    mutationFn: (payload: UpdateInstallmentGroupAmountsInput) =>
      updateGroupInstallments(transaction!.recurrenceGroupId!, payload),
    onSuccess: (updatedList, payload) => {
      ALL_MONEY.forEach((k) => qc.invalidateQueries({ queryKey: k }))
      if (transaction?.recurrenceGroupId) {
        qc.invalidateQueries({ queryKey: ['transactions', 'group', transaction.recurrenceGroupId] })
      }
      const selfUpdated =
        updatedList.find((tx) => tx.id === transaction?.id) ??
        payload.items.find((item) => item.transactionId === transaction?.id)
      if (selfUpdated && typeof selfUpdated.amount === 'number') {
        setAmount(selfUpdated.amount)
      }
      toast.success('Valores das parcelas atualizados com sucesso!')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const handleSaveGroupInstallments = () => {
    if (!transaction?.recurrenceGroupId || sortedGroupTransactions.length === 0) return
    if (hasInvalidGroupAmount) {
      toast.error('Todas as parcelas devem ter valor maior que R$ 0,00.')
      return
    }
    if (hasOverLimitGroupAmount) {
      toast.error(`Os valores e o total das parcelas não podem ultrapassar ${formatMoney(MAX_AMOUNT_CENTS)}.`)
      return
    }
    saveGroupInstallments.mutate({
      items: sortedGroupTransactions.map((item) => ({
        transactionId: item.id,
        amount: groupDraftAmounts[item.id] ?? item.amount,
      })),
    })
  }

  const handleResetGroupDrafts = () => {
    const nextDraft: Record<string, number> = {}
    sortedGroupTransactions.forEach((item) => {
      nextDraft[item.id] = item.amount
    })
    setGroupDraftAmounts(nextDraft)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Informe o título da transação.')
      return
    }

    if (!editing && recurring && infinite && (interval < 1 || interval > 120)) {
      toast.error('O intervalo de recorrência deve estar entre 1 e 120.')
      return
    }

    if (isCustomInstallmentMode) {
      if (customAmounts.length !== installments || customAmounts.some((v) => v <= 0)) {
        toast.error('Todas as parcelas personalizadas devem ter valor maior que R$ 0,00.')
        return
      }
      if (customAmounts.some((v) => v > MAX_AMOUNT_CENTS) || customTotal > MAX_AMOUNT_CENTS) {
        toast.error(`O valor total e o de cada parcela não podem ultrapassar ${formatMoney(MAX_AMOUNT_CENTS)}.`)
        return
      }
    } else {
      const effectiveTotal = activeSplit ? (amount > 0 ? amount : splitsSum) : amount
      if (effectiveTotal <= 0) {
        toast.error('Informe um valor maior que zero.')
        return
      }
      if (effectiveTotal > MAX_AMOUNT_CENTS) {
        toast.error(`O valor não pode ultrapassar ${formatMoney(MAX_AMOUNT_CENTS)}.`)
        return
      }
      if (activeSplit && (splits.some((s) => s.amount > MAX_AMOUNT_CENTS) || splitsSum > MAX_AMOUNT_CENTS)) {
        toast.error(`O valor das contas não pode ultrapassar ${formatMoney(MAX_AMOUNT_CENTS)}.`)
        return
      }
      if (isInstallmentPlan && installmentAmountMode === 'INSTALLMENT') {
        const projectedTotal = activeSplit ? splitsSum * installments : amount * installments
        if (projectedTotal > MAX_AMOUNT_CENTS) {
          toast.error(`O valor total do parcelamento não pode ultrapassar ${formatMoney(MAX_AMOUNT_CENTS)}.`)
          return
        }
      }
      if (isInstallmentPlan && installmentAmountMode === 'TOTAL') {
        if (!activeSplit && amount < installments) {
          toast.error(
            `No modo Valor total para ${installments}x, o valor deve ser de pelo menos ${formatMoney(installments)} (R$ 0,01 por parcela).`,
          )
          return
        }
        if (activeSplit && splits.some((s) => s.amount < installments)) {
          toast.error(
            `No rateio em ${installments}x pelo valor total, cada conta deve ter pelo menos ${formatMoney(installments)}.`,
          )
          return
        }
      }
    }

    let effectiveGeneralId: string | null = null
    let effectiveSpecificId: string | null = null
    if (generalCategoryId === '__missing__') {
      const resolvedOriginal = transaction ? resolveTransactionCategory(transaction, mergedCatMap) : undefined
      effectiveGeneralId = transaction?.generalCategoryId ?? resolvedOriginal?.general?.id ?? null
      effectiveSpecificId = transaction?.specificCategoryId ?? resolvedOriginal?.specific?.id ?? null
    } else if (generalCategoryId) {
      effectiveGeneralId = generalCategoryId
      effectiveSpecificId = specificCategoryId || null
    }
    const effectiveCategoryId = effectiveSpecificId || effectiveGeneralId || null

    const createMode: InstallmentAmountMode = !isInstallmentPlan
      ? 'INSTALLMENT'
      : isCustomInstallmentMode
        ? 'CUSTOM'
        : installmentAmountMode

    if (editing) {
      save.mutate({
        title: title.trim(),
        amount,
        date,
        categoryId: effectiveCategoryId,
        generalCategoryId: effectiveGeneralId,
        specificCategoryId: effectiveSpecificId,
        status,
        updateAllFuture: allFuture,
        updateFutureAmounts: allFuture ? updateFutureAmounts : false,
        invoiceMonth: transaction?.creditCardId ? invoiceMonth : null,
        invoiceYear: transaction?.creditCardId ? invoiceYear : null,
        generatesDebt: canEditGeneratesDebt ? generatesDebt : undefined,
      })
    } else if (sourceMode === 'CARD') {
      if (!selectedCard) return
      save.mutate({
        title: title.trim(),
        amount: isCustomInstallmentMode ? customTotal : amount,
        date,
        accountId: selectedCard.accountId,
        type: 'EXPENSE',
        status: 'COMPLETED',
        destinationAccountId: null,
        categoryId: effectiveCategoryId,
        generalCategoryId: effectiveGeneralId,
        specificCategoryId: effectiveSpecificId,
        isRecurring: recurring,
        recurrenceFrequency: recurring ? (infinite ? freq : 'MONTHLY') : null,
        recurrenceInterval: interval,
        recurrenceInstallments: installments,
        isInfinite: recurring && infinite,
        creditCardId: selectedCard.id,
        invoiceMonth,
        invoiceYear,
        installmentAmountMode: createMode,
        ...(createMode === 'TOTAL' ? { remainderStrategy } : {}),
        ...(createMode === 'CUSTOM' ? { installmentAmounts: customAmounts } : {}),
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
      const splitInstallmentMode: InstallmentAmountMode = isInstallmentPlan ? installmentAmountMode : 'INSTALLMENT'
      save.mutate({
        title: title.trim(),
        amount: splitsSum,
        date,
        accountId: splits[0].accountId,
        type,
        status,
        destinationAccountId: null,
        categoryId: effectiveCategoryId,
        generalCategoryId: effectiveGeneralId,
        specificCategoryId: effectiveSpecificId,
        isRecurring: recurring,
        recurrenceFrequency: recurring ? freq : null,
        recurrenceInterval: interval,
        recurrenceInstallments: installments,
        isInfinite: recurring && infinite,
        installmentAmountMode: splitInstallmentMode,
        ...(splitInstallmentMode === 'TOTAL' ? { remainderStrategy } : {}),
        splits: splits.map(({ accountId: accId, amount: rowAmount }) => ({
          accountId: accId,
          amount: rowAmount,
        })),
      })
    } else {
      if (!accountId) {
        toast.error(
          type === 'TRANSFER'
            ? 'Selecione uma conta própria ou conjunta com acesso como origem.'
            : 'Selecione uma conta para a transação.',
        )
        return
      }
      if (type === 'TRANSFER') {
        if (!transferSourceAccounts.some((a) => a.id === accountId)) {
          toast.error('Selecione uma conta própria ou conjunta com acesso como origem da transferência.')
          return
        }
        if (!destId) {
          toast.error('Selecione a conta de destino da transferência.')
          return
        }
        if (accountId === destId) {
          toast.error('A conta de destino deve ser diferente da conta de origem.')
          return
        }
      }
      save.mutate({
        title: title.trim(),
        amount: isCustomInstallmentMode ? customTotal : amount,
        date,
        accountId,
        type,
        status,
        destinationAccountId: type === 'TRANSFER' ? destId : null,
        categoryId: effectiveCategoryId,
        generalCategoryId: effectiveGeneralId,
        specificCategoryId: effectiveSpecificId,
        isRecurring: recurring,
        recurrenceFrequency: recurring ? freq : null,
        recurrenceInterval: interval,
        recurrenceInstallments: installments,
        isInfinite: recurring && infinite,
        installmentAmountMode: createMode,
        ...(createMode === 'TOTAL' ? { remainderStrategy } : {}),
        ...(createMode === 'CUSTOM' ? { installmentAmounts: customAmounts } : {}),
        generatesDebt: canGenerateDebt ? generatesDebt : false,
      })
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar transação' : 'Nova transação'}>
      <form noValidate className="space-y-4" onSubmit={submit}>
        {!editing && creditCards.length > 0 && (
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-elevated p-1 border border-border-subtle card-highlight">
            <button
              type="button"
              onClick={() => setSourceMode('ACCOUNT')}
              className={clsx(
                'rounded-lg py-2 text-xs font-medium transition-all duration-150 cursor-pointer select-none active:scale-[0.98]',
                sourceMode === 'ACCOUNT' ? 'bg-accent text-canvas font-semibold shadow-[0_1px_3px_rgba(251,191,36,0.3)]' : 'text-ink-secondary hover:text-ink-primary',
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
                sourceMode === 'CARD' ? 'bg-accent text-canvas font-semibold shadow-[0_1px_3px_rgba(251,191,36,0.3)]' : 'text-ink-secondary hover:text-ink-primary',
              )}
            >
              Cartão de crédito
            </button>
          </div>
        )}

        {!editing && sourceMode === 'ACCOUNT' && (
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-elevated p-1 border border-border-subtle card-highlight">
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
                      : 'bg-accent text-canvas shadow-[0_1px_4px_rgba(251,191,36,0.35)] font-bold'
                    : 'text-ink-secondary hover:text-ink-primary',
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
          <Field
            label={
              isInstallmentPlan
                ? isCustomInstallmentMode
                  ? 'Valor total (referência)'
                  : installmentAmountMode === 'TOTAL'
                    ? 'Valor total'
                    : 'Valor da parcela'
                : 'Valor'
            }
            error={amount > MAX_AMOUNT_CENTS ? `Máximo de ${formatMoney(MAX_AMOUNT_CENTS)}.` : undefined}
          >
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
                      ? 'bg-accent text-canvas font-semibold'
                      : 'bg-surface-elevated text-accent-soft hover:bg-accent/20',
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
                  <div className="inline-flex rounded-xl bg-surface p-0.5 border border-border-subtle">
                    <button
                      type="button"
                      onClick={() => switchSplitUnit('AMOUNT')}
                      className={clsx(
                        'rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer',
                        splitUnit === 'AMOUNT' ? 'bg-accent text-canvas font-semibold' : 'text-ink-secondary hover:text-ink-primary',
                      )}
                    >
                      Por valor (R$)
                    </button>
                    <button
                      type="button"
                      onClick={() => switchSplitUnit('PERCENT')}
                      className={clsx(
                        'rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer',
                        splitUnit === 'PERCENT' ? 'bg-accent text-canvas font-semibold' : 'text-ink-secondary hover:text-ink-primary',
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
                                {formatAccountLabel(a)}
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
              <Field
                label={type === 'TRANSFER' ? 'Conta de origem' : canSplit ? undefined : 'Conta'}
                hint={
                  type === 'TRANSFER' && !accountsQuery.isLoading && transferSourceAccounts.length === 0
                    ? 'Você precisa de uma conta própria ou conjunta com acesso para realizar transferências.'
                    : undefined
                }
              >
                <Select
                  value={accountId}
                  onChange={(e) => {
                    const nextId = e.target.value
                    setAccountId(nextId)
                    if (type === 'TRANSFER' && nextId === destId) {
                      setDestId('')
                    }
                  }}
                  required
                >
                  <option value="">Selecione…</option>
                  {sourceAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {formatAccountLabel(a)}
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
                    {formatAccountLabel(a)}
                  </option>
                ))}
            </Select>
          </Field>
        )}

        {(canGenerateDebt || canEditGeneratesDebt) && (
          <div className="space-y-1.5 rounded-xl border border-violet/30 bg-violet/10 p-3">
            <Checkbox
              checked={generatesDebt}
              onChange={(checked) => {
                setGeneratesDebt(checked)
                if (checked && status === 'PENDING') {
                  setStatus('COMPLETED')
                }
              }}
            >
              Adicionar como saldo devedor para <b className="text-white">{debtRecipientName}</b>
            </Checkbox>
            <p className="pl-6 text-xs text-text-dim">
              Registra esta transferência como empréstimo/adiantamento na aba Acertos do grupo (contabilizado quando a transferência está efetivada).
            </p>
          </div>
        )}

        <div className="space-y-3">
          <Field label="Categoria geral">
            <Select
              aria-label="Categoria geral"
              value={generalCategoryId}
              onChange={(e) => handleGeneralCategoryChange(e.target.value)}
            >
              <option value="">Sem categoria</option>
              {missingGeneralFallback && (
                <option value={missingGeneralFallback.id}>{missingGeneralFallback.label}</option>
              )}
              {filteredMyGeneralCategories.length > 0 && (
                <optgroup label="Minhas categorias">
                  {filteredMyGeneralCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon ? `${c.icon} ` : ''}
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {filteredGroupGeneralCategories.map(({ group, categories: gCats }) => (
                <optgroup key={group.id} label={`Categorias: ${group.name}`}>
                  {gCats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon ? `${c.icon} ` : ''}
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>

          {generalCategoryId === '__missing__' && (
            <p className="text-xs text-text-dim">
              Categoria original preservada. Para alterá-la, selecione uma categoria geral acima.
            </p>
          )}

          {generalCategoryId && generalCategoryId !== '__missing__' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-xs font-medium text-text-muted">
                  Categoria específica (opcional)
                </label>
                {canCreateSpecificInSelectedGeneral && (
                  <button
                    type="button"
                    onClick={() => setAddingSpecific((prev) => !prev)}
                    className="inline-flex items-center gap-1 rounded-lg bg-violet/15 px-2.5 py-1 text-xs font-medium text-violet-hover hover:bg-violet/25 transition cursor-pointer select-none"
                  >
                    <Plus className="size-3.5" />
                    {addingSpecific ? 'Fechar' : 'Nova específica'}
                  </button>
                )}
              </div>

              <Select
                aria-label="Categoria específica (opcional)"
                value={specificCategoryId}
                onChange={(e) => setSpecificCategoryId(e.target.value)}
              >
                <option value="">
                  {selectedGeneralCategory
                    ? `Não especificar (apenas ${selectedGeneralCategory.name})`
                    : 'Não especificar (apenas categoria geral)'}
                </option>
                {missingSpecificFallback && (
                  <option value={missingSpecificFallback.id}>{missingSpecificFallback.label}</option>
                )}
                {specificCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ''}
                    {c.name}
                  </option>
                ))}
              </Select>

              {selectedGeneralCategory && (
                <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-xs">
                  <span className="text-text-dim">Categorizada em:</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-1 px-2.5 py-0.5 font-medium text-white">
                    {selectedGeneralCategory.icon && <span aria-hidden="true">{selectedGeneralCategory.icon}</span>}
                    <span>{selectedGeneralCategory.name} (Geral)</span>
                  </span>
                  {selectedSpecificCategory && (
                    <>
                      <span className="text-text-dim font-semibold" aria-hidden="true">+</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-violet/35 bg-violet-subtle px-2.5 py-0.5 font-medium text-violet-hover">
                        {selectedSpecificCategory.icon && <span aria-hidden="true">{selectedSpecificCategory.icon}</span>}
                        <span>{selectedSpecificCategory.name} (Específica)</span>
                      </span>
                    </>
                  )}
                </div>
              )}

              {addingSpecific && canCreateSpecificInSelectedGeneral && selectedGeneralCategory && (
                <div className="space-y-2.5 rounded-2xl border border-accent/35 bg-surface-elevated/60 p-3">
                  <p className="text-xs font-medium text-ink-primary">
                    Nova específica em{' '}
                    <span className="text-accent">
                      {selectedGeneralCategory.icon ? `${selectedGeneralCategory.icon} ` : ''}
                      {selectedGeneralCategory.name}
                    </span>
                  </p>
                  <div className="grid grid-cols-[1fr_4.5rem_2.5rem] gap-2">
                    <Input
                      value={newSpecificName}
                      onChange={(e) => setNewSpecificName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleCreateSpecific()
                        }
                      }}
                      placeholder="Nome (ex.: Aluguel, Uber…)"
                      className="h-9 text-xs"
                    />
                    <Input
                      value={newSpecificIcon}
                      maxLength={4}
                      onChange={(e) => setNewSpecificIcon(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleCreateSpecific()
                        }
                      }}
                      placeholder="🏷️"
                      className="h-9 text-center text-xs"
                    />
                    <label
                      className="relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-border-strong bg-surface"
                      title="Escolher cor da categoria específica"
                    >
                      <input
                        type="color"
                        aria-label="Cor da categoria específica"
                        value={normalizeCategoryColor(newSpecificColor || selectedGeneralCategory.color)}
                        onChange={(e) => setNewSpecificColor(e.target.value)}
                        className="absolute inset-0 size-12 -translate-x-1 -translate-y-1 cursor-pointer opacity-0"
                      />
                      <span
                        className="size-5 rounded-md border border-white/20"
                        style={{ backgroundColor: normalizeCategoryColor(newSpecificColor || selectedGeneralCategory.color) }}
                      />
                    </label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setAddingSpecific(false)
                        setNewSpecificName('')
                        setNewSpecificIcon('')
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      loading={createSpecific.isPending}
                      onClick={handleCreateSpecific}
                    >
                      Criar e selecionar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

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
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-elevated p-1 border border-border-subtle">
                  <button
                    type="button"
                    onClick={() => setInfinite(false)}
                    className={clsx(
                      'rounded-lg py-1.5 text-xs font-medium transition cursor-pointer select-none',
                      !infinite ? 'bg-accent text-canvas font-semibold' : 'text-ink-secondary hover:text-ink-primary',
                    )}
                  >
                    Parcelado (compromete total)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfinite(true)}
                    className={clsx(
                      'rounded-lg py-1.5 text-xs font-medium transition cursor-pointer select-none',
                      infinite ? 'bg-accent text-canvas font-semibold' : 'text-ink-secondary hover:text-ink-primary',
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
                        max={120}
                        value={interval}
                        onChange={(e) =>
                          setInterval_(Math.min(120, Math.max(1, Math.floor(Number(e.target.value) || 1))))
                        }
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
                          max={365}
                          value={installments}
                          onChange={(e) => handleInstallmentsChange(Number(e.target.value))}
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

                    <div className="space-y-2 rounded-xl border border-border/80 bg-surface-2/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-text-muted">Divisão das parcelas</span>
                        <InfoTooltip
                          align="end"
                          side="top"
                          ariaLabel="Entenda como funciona a divisão de centavos nas parcelas"
                          title="Por que os centavos variam nas parcelas?"
                          content={
                            <span>
                              Quando o valor não divide exatamente (ex.: R$ 199,94 em 4x), cada banco lança os centavos
                              restantes em uma parcela — em geral na 1ª (1x de R$ 50,00 + 3x de R$ 49,98) ou na última.
                              Escolha abaixo onde lançar a diferença ou ative o ajuste manual para bater exatamente com
                              a sua fatura.
                            </span>
                          }
                        />
                      </div>

                      {isCustomInstallmentMode ? (
                        customTotal > MAX_AMOUNT_CENTS || customAmounts.some((v) => v > MAX_AMOUNT_CENTS) ? (
                          <p className="text-xs text-expense tabular-nums">
                            O valor total e o de cada parcela não podem ultrapassar {formatMoney(MAX_AMOUNT_CENTS)}.
                          </p>
                        ) : customAmounts.every((v) => v > 0) ? (
                          <p className="text-xs text-text-dim leading-relaxed">
                            Resumo:{' '}
                            <b className="text-white tabular-nums">{installmentSummaryText}</b>{' '}
                            <span className="tabular-nums">(total {formatMoney(customTotal)})</span>
                          </p>
                        ) : (
                          <p className="text-xs text-expense">
                            Preencha todas as parcelas abaixo com valor maior que R$ 0,00.
                          </p>
                        )
                      ) : amount > 0 ? (
                        effectiveTotalPreview > MAX_AMOUNT_CENTS ? (
                          <p className="text-xs text-expense tabular-nums">
                            O valor total do parcelamento não pode ultrapassar {formatMoney(MAX_AMOUNT_CENTS)}.
                          </p>
                        ) : installmentAmountMode === 'TOTAL' && amount < installments ? (
                          <p className="text-xs text-expense tabular-nums">
                            Valor insuficiente para {installments}x: informe ao menos {formatMoney(installments)} (R$
                            0,01 por parcela).
                          </p>
                        ) : (
                          <p className="text-xs text-text-dim leading-relaxed">
                            Resumo:{' '}
                            <b className="text-white tabular-nums">{installmentSummaryText}</b>{' '}
                            <span className="tabular-nums">(total {formatMoney(effectiveTotalPreview)})</span>
                          </p>
                        )
                      ) : (
                        <p className="text-xs text-text-dim">
                          Informe o valor acima para visualizar como as {installments} parcelas serão lançadas.
                        </p>
                      )}
                    </div>

                    {!isCustomInstallmentMode &&
                      installmentAmountMode === 'TOTAL' &&
                      amount >= installments &&
                      amount % installments !== 0 && (
                        <Field
                          label={`Distribuição dos centavos (${formatMoney(amount % installments)})`}
                          hint={
                            REMAINDER_STRATEGY_OPTIONS.find((opt) => opt.value === remainderStrategy)?.description
                          }
                        >
                          <Select
                            aria-label="Estratégia de distribuição dos centavos"
                            value={remainderStrategy}
                            onChange={(e) => setRemainderStrategy(e.target.value as RemainderStrategy)}
                          >
                            {REMAINDER_STRATEGY_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      )}

                    {!activeSplit ? (
                      <div className="border-t border-border/70 pt-2.5 space-y-2.5">
                        <button
                          type="button"
                          onClick={handleToggleCustomizeInstallments}
                          aria-expanded={customizeInstallments}
                          className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-surface-2/70 px-3 py-2 text-xs font-medium text-white hover:border-border-strong hover:bg-surface-2 transition cursor-pointer select-none"
                        >
                          <span className="inline-flex items-center gap-2">
                            <span>Personalizar valor de cada parcela</span>
                            {customizeInstallments && <Badge tone="primary">Manual</Badge>}
                          </span>
                          {customizeInstallments ? (
                            <ChevronUp className="size-4 text-text-dim shrink-0" />
                          ) : (
                            <ChevronDown className="size-4 text-text-dim shrink-0" />
                          )}
                        </button>

                        {customizeInstallments && (
                          <div className="space-y-2.5 rounded-xl border border-border bg-surface-2/50 p-3">
                            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                              {customAmounts.map((val, idx) => (
                                <div key={idx} className="grid grid-cols-[4.25rem_1fr] items-center gap-2">
                                  <span className="text-xs font-semibold text-text-muted tabular-nums">
                                    {idx + 1}/{installments}
                                  </span>
                                  <MoneyInput
                                    aria-label={`Valor da parcela ${idx + 1} de ${installments}`}
                                    value={val}
                                    onChange={(cents) => handleCustomAmountChange(idx, cents)}
                                  />
                                </div>
                              ))}
                            </div>

                            <div className="space-y-1.5 border-t border-border/70 pt-2 text-xs">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-text-dim">
                                  Soma das parcelas:{' '}
                                  <b className="text-white tabular-nums">{formatMoney(customTotal)}</b>
                                </span>
                                {expectedTotalForCustom > 0 && (
                                  <button
                                    type="button"
                                    onClick={handleResetCustomAmounts}
                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-text-muted hover:text-white transition cursor-pointer"
                                  >
                                    <RotateCcw className="size-3" />
                                    Redistribuir
                                  </button>
                                )}
                              </div>

                              {expectedTotalForCustom > 0 && customDiff !== 0 && (
                                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-1 px-2.5 py-1.5">
                                  <span className="text-[11px] text-text-muted tabular-nums">
                                    {customDiff < 0
                                      ? `Faltam ${formatMoney(Math.abs(customDiff))} para ${formatMoney(expectedTotalForCustom)}`
                                      : `Passou ${formatMoney(customDiff)} de ${formatMoney(expectedTotalForCustom)}`}
                                  </span>
                                  {customTotal > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setInstallmentAmountMode('TOTAL')
                                        setAmount(customTotal)
                                      }}
                                      className="text-[11px] font-semibold text-lime hover:underline cursor-pointer"
                                    >
                                      Atualizar total para {formatMoney(customTotal)}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-text-dim">
                        Personalização individual de parcelas fica indisponível quando a compra é dividida entre várias contas.
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {editing && transaction?.recurrenceGroupId && (
          <div className="space-y-3 rounded-xl border border-border p-3 bg-surface-2">
            <Checkbox checked={allFuture} onChange={setAllFuture}>
              Aplicar a todas as futuras
            </Checkbox>

            {allFuture && (
              <div className="space-y-1 border-t border-border/70 pt-2.5 pl-6">
                <Checkbox checked={updateFutureAmounts} onChange={setUpdateFutureAmounts}>
                  Aplicar também este valor às parcelas futuras
                </Checkbox>
                <p className="pl-7 text-[11px] text-text-dim leading-relaxed">
                  {transaction.isInfinite
                    ? 'Desmarque para alterar apenas título, categoria ou dados das próximas cobranças mantendo os valores atuais.'
                    : 'Desmarcado por padrão para preservar valores diferentes já definidos nas próximas parcelas.'}
                </p>
              </div>
            )}

            {transaction.installmentNumber != null && (
              <div className="space-y-2.5 border-t border-border/70 pt-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-between"
                  onClick={() => setShowGroupInstallments((prev) => !prev)}
                  aria-expanded={showGroupInstallments}
                >
                  <span className="inline-flex items-center gap-2">
                    <Layers className="size-4 text-violet-hover" />
                    <span>
                      Ver e ajustar todas as parcelas (
                      {transaction.totalInstallments ?? (sortedGroupTransactions.length || '…')})
                    </span>
                  </span>
                  {showGroupInstallments ? (
                    <ChevronUp className="size-4 text-text-dim shrink-0" />
                  ) : (
                    <ChevronDown className="size-4 text-text-dim shrink-0" />
                  )}
                </Button>

                {showGroupInstallments && (
                  <div className="space-y-3 rounded-xl border border-border bg-surface-1 p-3">
                    {groupQuery.isLoading ? (
                      <div className="space-y-2" aria-label="Carregando parcelas">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : groupQuery.isError ? (
                      <Alert tone="neutral">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>Não foi possível carregar as parcelas deste grupo.</span>
                          <Button size="sm" variant="outline" onClick={() => groupQuery.refetch()}>
                            Tentar novamente
                          </Button>
                        </div>
                      </Alert>
                    ) : sortedGroupTransactions.length === 0 ? (
                      <p className="text-xs text-text-dim">Nenhuma parcela encontrada para este grupo.</p>
                    ) : (
                      <>
                        <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                          {sortedGroupTransactions.map((item, idx) => {
                            const labelNum = `${item.installmentNumber ?? idx + 1}/${
                              item.totalInstallments ?? sortedGroupTransactions.length
                            }`
                            const draftCents = groupDraftAmounts[item.id] ?? item.amount
                            const isCurrent = item.id === transaction.id
                            return (
                              <div
                                key={item.id}
                                className={clsx(
                                  'flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border p-2.5',
                                  isCurrent
                                    ? 'border-violet/40 bg-violet-subtle/20'
                                    : 'border-border bg-surface-2/40',
                                )}
                              >
                                <div className="min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-xs font-semibold text-white tabular-nums">
                                      {labelNum}
                                    </span>
                                    {isCurrent && (
                                      <Badge tone="primary" className="text-[10px] px-2 py-0">
                                        Atual
                                      </Badge>
                                    )}
                                    <Badge
                                      tone={item.status === 'COMPLETED' ? 'income' : 'default'}
                                      className="text-[10px] px-2 py-0"
                                    >
                                      {item.status === 'COMPLETED' ? 'Concluída' : 'Pendente'}
                                    </Badge>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-text-dim tabular-nums">
                                    <span>{formatDate(item.date)}</span>
                                    {item.invoiceMonth != null && item.invoiceYear != null && (
                                      <span>
                                        · Fat. {String(item.invoiceMonth).padStart(2, '0')}/{item.invoiceYear}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="w-full sm:w-36 shrink-0">
                                  <MoneyInput
                                    aria-label={`Valor da parcela ${labelNum}`}
                                    value={draftCents}
                                    onChange={(cents) =>
                                      setGroupDraftAmounts((prev) => ({ ...prev, [item.id]: cents }))
                                    }
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <div className="space-y-2 border-t border-border/70 pt-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="text-text-dim">
                              Total recalculado:{' '}
                              <b className="text-white tabular-nums">{formatMoney(groupDraftTotal)}</b>
                            </span>
                            {groupDraftTotal !== originalGroupTotal && (
                              <span
                                className={clsx(
                                  'text-[11px] font-medium tabular-nums',
                                  groupDraftTotal > originalGroupTotal ? 'text-expense' : 'text-lime',
                                )}
                              >
                                {groupDraftTotal > originalGroupTotal ? '+' : '−'}
                                {formatMoney(Math.abs(groupDraftTotal - originalGroupTotal))} vs. atual
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-text-dim tabular-nums">
                            {summarizeInstallments(groupDraftAmountsList)}
                          </p>

                          {hasOverLimitGroupAmount && (
                            <p className="text-xs text-expense tabular-nums">
                              Os valores e a soma das parcelas não podem ultrapassar {formatMoney(MAX_AMOUNT_CENTS)}.
                            </p>
                          )}

                          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                            {hasGroupChanges && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleResetGroupDrafts}
                                disabled={saveGroupInstallments.isPending}
                              >
                                <RotateCcw className="size-3.5" />
                                Desfazer
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="lime"
                              loading={saveGroupInstallments.isPending}
                              disabled={!hasGroupChanges || hasInvalidGroupAmount || hasOverLimitGroupAmount}
                              onClick={handleSaveGroupInstallments}
                            >
                              Salvar parcelas
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <Button type="submit" className="w-full" loading={save.isPending}>
          Salvar
        </Button>
      </form>
    </Modal>
  )
}
