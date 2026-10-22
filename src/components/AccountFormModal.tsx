import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useAction } from '@/lib/hooks'
import type { Account, AccountInput, AccountType } from '@/lib/types'
import { accountTypeLabel } from '@/lib/format'
import { Button, Field, Input, Modal, MoneyInput, Select } from './ui'

export default function AccountFormModal({ open, onClose, account }: { open: boolean; onClose: () => void; account?: Account }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('CHECKING')
  const [start, setStart] = useState(0)
  const [tax, setTax] = useState('')

  useEffect(() => {
    if (!open) return
    setName(account?.name ?? ''); setType(account?.type ?? 'CHECKING')
    setStart(account?.startBalance ?? 0); setTax(account?.tax != null ? String(account.tax) : '')
  }, [open, account])

  const save = useAction(
    (body: AccountInput) => (account ? api.put(`/accounts/${account.id}`, body) : api.post('/accounts', body)),
    { invalidate: [['accounts'], ['total-balance']], success: account ? 'Conta atualizada' : 'Conta criada', onSuccess: onClose },
  )

  return (
    <Modal open={open} onClose={onClose} title={account ? 'Editar conta' : 'Nova conta'}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save.mutate({ name: name.trim(), type, startBalance: start, tax: tax === '' ? null : Number(tax) }) }}>
        <Field label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></Field>
        <Field label="Tipo">
          <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {Object.entries(accountTypeLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Saldo inicial"><MoneyInput value={start} onChange={setStart} /></Field>
        <Field label="Taxa (opcional)" hint="Taxa associada à conta, se houver."><Input type="number" min={0} value={tax} onChange={(e) => setTax(e.target.value)} /></Field>
        <Button type="submit" className="w-full" loading={save.isPending}>Salvar</Button>
      </form>
    </Modal>
  )
}
