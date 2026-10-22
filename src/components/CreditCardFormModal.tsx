import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useAccounts, useAction } from '@/lib/hooks'
import type { CreditCard, CreditCardInput } from '@/lib/types'
import { Button, Field, Input, Modal, MoneyInput, Select } from './ui'

export default function CreditCardFormModal({
  open,
  onClose,
  card,
}: {
  open: boolean
  onClose: () => void
  card?: CreditCard
}) {
  const accounts = useAccounts().data ?? []
  const [name, setName] = useState('')
  const [accountId, setAccountId] = useState('')
  const [limitAmount, setLimitAmount] = useState(0)
  const [closingDay, setClosingDay] = useState(25)
  const [dueDay, setDueDay] = useState(5)

  useEffect(() => {
    if (!open) return
    setName(card?.name ?? '')
    setAccountId(card?.accountId ?? accounts[0]?.id ?? '')
    setLimitAmount(card?.limitAmount ?? 0)
    setClosingDay(card?.closingDay ?? 25)
    setDueDay(card?.dueDay ?? 5)
  }, [open, card, accounts])

  const save = useAction(
    (body: CreditCardInput) => (card ? api.put(`/credit-cards/${card.id}`, body) : api.post('/credit-cards', body)),
    {
      invalidate: [['credit-cards'], ['groups']],
      success: card ? 'Cartão atualizado' : 'Cartão criado',
      onSuccess: onClose,
    },
  )

  return (
    <Modal open={open} onClose={onClose} title={card ? 'Editar cartão de crédito' : 'Novo cartão de crédito'}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim() || !accountId) return
          save.mutate({
            name: name.trim(),
            accountId,
            limitAmount,
            closingDay: Math.min(31, Math.max(1, closingDay)),
            dueDay: Math.min(31, Math.max(1, dueDay)),
          })
        }}
      >
        <Field label="Nome do cartão">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Nubank, Inter…" required autoFocus />
        </Field>
        <Field label="Conta vinculada (para débito da fatura)">
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
            <option value="">Selecione uma conta…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Limite total">
          <MoneyInput value={limitAmount} onChange={setLimitAmount} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dia de fechamento (faturamento)" hint="1 a 31">
            <Input
              type="number"
              min={1}
              max={31}
              value={closingDay}
              onChange={(e) => setClosingDay(Number(e.target.value))}
              required
            />
          </Field>
          <Field label="Dia de vencimento" hint="1 a 31">
            <Input
              type="number"
              min={1}
              max={31}
              value={dueDay}
              onChange={(e) => setDueDay(Number(e.target.value))}
              required
            />
          </Field>
        </div>
        <Button type="submit" className="w-full" loading={save.isPending}>
          Salvar
        </Button>
      </form>
    </Modal>
  )
}
