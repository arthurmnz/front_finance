import { useEffect, useState } from 'react'
import { useForgiveDebt } from '@/lib/hooks'
import type { UserSummary } from '@/lib/types'
import { formatMoney, fullName } from '@/lib/format'
import { Button, ConfirmDialog, Field, Input, Modal, MoneyInput } from '@/components/ui'

interface ForgiveDebtModalProps {
  open: boolean
  onClose: () => void
  groupId: string
  debtor: UserSummary
  targetMonth: number
  targetYear: number
  maxAmount: number
  onSuccess?: () => void
}

export default function ForgiveDebtModal({
  open,
  onClose,
  groupId,
  debtor,
  targetMonth,
  targetYear,
  maxAmount,
  onSuccess,
}: ForgiveDebtModalProps) {
  const forgiveMutation = useForgiveDebt(groupId)

  const [amount, setAmount] = useState(maxAmount)
  const [notes, setNotes] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setAmount(maxAmount)
      setNotes('')
      setConfirmOpen(false)
    }
  }, [open, debtor.id, targetMonth, targetYear, maxAmount])

  const formattedCompetence = `${targetMonth.toString().padStart(2, '0')}/${targetYear}`
  const exceedsMax = amount > maxAmount

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (amount <= 0 || exceedsMax) return
    setConfirmOpen(true)
  }

  const handleConfirm = () => {
    forgiveMutation.mutate(
      {
        debtorId: debtor.id,
        amount,
        targetMonth,
        targetYear,
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
        title={`Perdoar dívida de ${fullName(debtor)}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3 text-xs text-text-muted">
            <p>
              Competência da dívida:{' '}
              <span className="font-semibold text-white tabular-nums">{formattedCompetence}</span>
            </p>
            <p>
              Saldo que <span className="font-semibold text-white">{fullName(debtor)}</span> deve para você:{' '}
              <span className="font-semibold text-lime tabular-nums">{formatMoney(maxAmount)}</span>
            </p>
            <p className="border-t border-border/60 pt-1.5 text-text-dim leading-relaxed">
              O perdão abate o saldo devedor no grupo sem movimentar o saldo de nenhuma conta bancária.
            </p>
          </div>

          <Field
            label="Valor a perdoar"
            hint="Você pode perdoar parte da dívida ou o valor total."
            error={exceedsMax ? 'O valor não pode exceder o saldo devedor pendente.' : undefined}
          >
            <MoneyInput value={amount} onChange={setAmount} required />
            {amount !== maxAmount && (
              <button
                type="button"
                onClick={() => setAmount(maxAmount)}
                className="mt-1 inline-block text-xs font-medium text-lime hover:text-lime-hover underline underline-offset-4 cursor-pointer tabular-nums"
              >
                Usar valor total ({formatMoney(maxAmount)})
              </button>
            )}
          </Field>

          <Field label="Motivo / Observação (opcional)">
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="Ex.: Perdão de dívida, presente, desconto…"
            />
          </Field>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={amount <= 0 || exceedsMax}
            >
              Prosseguir
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        confirmVariant="primary"
        title="Confirmar perdão de dívida"
        message={`Deseja perdoar ${formatMoney(amount)} da dívida de ${fullName(debtor)} referente a ${formattedCompetence}?`}
        confirmLabel="Confirmar Perdão"
        loading={forgiveMutation.isPending}
        onConfirm={handleConfirm}
      />
    </>
  )
}
