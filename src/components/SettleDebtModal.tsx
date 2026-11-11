import { useEffect, useMemo, useState } from 'react'
import { useAccounts, useSettleDebt } from '@/lib/hooks'
import type { CreditCard, GroupAccount, UserSummary } from '@/lib/types'
import { formatMoney, fullName } from '@/lib/format'
import { Button, ConfirmDialog, Field, Modal, MoneyInput, Select } from '@/components/ui'

interface SettleDebtModalProps {
  open: boolean
  onClose: () => void
  groupId: string
  creditor: UserSummary
  targetMonth: number
  targetYear: number
  suggestedAmount: number
  groupAccounts: GroupAccount[]
  groupCards?: CreditCard[]
  onSuccess?: () => void
}

const EMPTY_CARDS: CreditCard[] = []

export default function SettleDebtModal({
  open,
  onClose,
  groupId,
  creditor,
  targetMonth,
  targetYear,
  suggestedAmount,
  groupAccounts,
  groupCards = EMPTY_CARDS,
  onSuccess,
}: SettleDebtModalProps) {
  const accounts = useAccounts()
  const settleMutation = useSettleDebt(groupId)

  const [amount, setAmount] = useState(suggestedAmount)
  const [sourceAccountId, setSourceAccountId] = useState('')
  const [destinationAccountId, setDestinationAccountId] = useState('')
  const [notes, setNotes] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Contas disponíveis do devedor (usuário logado)
  const myAccounts = useMemo(() => accounts.data ?? [], [accounts.data])

  // Contas pertencentes ao credor
  const creditorAccounts = useMemo(() => {
    const list: { id: string; name: string }[] = []
    const seen = new Set<string>()

    // Contas de grupo do credor
    groupAccounts
      .filter((a) => a.owner.id === creditor.id)
      .forEach((a) => {
        if (!seen.has(a.id)) {
          seen.add(a.id)
          list.push({ id: a.id, name: a.name })
        }
      })

    // Contas vinculadas a cartões do credor no grupo
    groupCards
      .filter((c) => c.ownerId === creditor.id && c.accountId)
      .forEach((c) => {
        if (!seen.has(c.accountId)) {
          seen.add(c.accountId)
          list.push({ id: c.accountId, name: `Conta do cartão (${c.name})` })
        }
      })

    return list
  }, [groupAccounts, groupCards, creditor.id])

  // Inicializa o valor e as notas somente quando o modal abrir ou o credor/período mudar
  useEffect(() => {
    if (open) {
      setAmount(suggestedAmount)
      setNotes(`Acerto de cartão - ${targetMonth.toString().padStart(2, '0')}/${targetYear}`)
    }
  }, [open, creditor.id, targetMonth, targetYear])

  // Inicializa contas padrão sem resetar o valor digitado
  useEffect(() => {
    if (!open) return
    if (myAccounts.length > 0 && !sourceAccountId) {
      setSourceAccountId(myAccounts[0].id)
    }
    if (!destinationAccountId) {
      const creditorCard = groupCards.find((c) => c.ownerId === creditor.id && c.accountId)
      if (creditorCard) {
        setDestinationAccountId(creditorCard.accountId)
      } else if (creditorAccounts.length > 0) {
        setDestinationAccountId(creditorAccounts[0].id)
      }
    }
  }, [open, myAccounts, creditorAccounts, groupCards, creditor.id, sourceAccountId, destinationAccountId])

  const sourceAccount = myAccounts.find((a) => a.id === sourceAccountId)
  const destAccount = creditorAccounts.find((a) => a.id === destinationAccountId)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!sourceAccountId || !destinationAccountId || amount <= 0) return
    setConfirmOpen(true)
  }

  const handleConfirm = () => {
    settleMutation.mutate(
      {
        creditorId: creditor.id,
        amount,
        targetMonth,
        targetYear,
        sourceAccountId,
        destinationAccountId,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          setConfirmOpen(false)
          onClose()
          onSuccess?.()
        },
      },
    )
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={`Quitar fatura com ${fullName(creditor)}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl bg-surface-2 p-3 text-xs text-text-muted">
            <p>
              Competência da dívida:{' '}
              <span className="font-semibold text-white">
                {targetMonth.toString().padStart(2, '0')}/{targetYear}
              </span>
            </p>
            <p className="mt-1">
              Saldo pendente no mês:{' '}
              <span className="font-semibold text-rose-400 tabular-nums">
                {formatMoney(suggestedAmount)}
              </span>
            </p>
          </div>

          <Field label="Valor do acerto" hint="Suporta pagamento parcial ou total.">
            <MoneyInput value={amount} onChange={setAmount} required />
          </Field>

          <Field label="Sua conta de origem (débito)">
            <Select
              value={sourceAccountId}
              onChange={(e) => setSourceAccountId(e.target.value)}
              required
            >
              <option value="">Selecione sua conta…</option>
              {myAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({formatMoney(a.balance)})
                </option>
              ))}
            </Select>
          </Field>

          <Field label={`Conta de destino de ${fullName(creditor)} (crédito)`}>
            <Select
              value={destinationAccountId}
              onChange={(e) => setDestinationAccountId(e.target.value)}
              required
            >
              <option value="">Selecione a conta do credor…</option>
              {creditorAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={amount <= 0 || !sourceAccountId || !destinationAccountId}
            >
              Prosseguir
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirmar transferência de acerto"
        message={`Deseja transferir ${formatMoney(amount)} da sua conta "${sourceAccount?.name ?? 'Origem'}" para a conta "${destAccount?.name ?? 'Destino'}" de ${fullName(creditor)}?`}
        confirmLabel="Transferir e Quitar"
        loading={settleMutation.isPending}
        onConfirm={handleConfirm}
      />
    </>
  )
}
