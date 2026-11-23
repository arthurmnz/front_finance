import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Users } from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/lib/api'
import { useAction } from '@/lib/hooks'
import type { Account, AccountType, GroupAccount, GroupMember, JointAccountInput } from '@/lib/types'
import { accountTypeLabel, fullName, initials, roleLabel } from '@/lib/format'
import { Badge, Button, Field, Input, Modal, MoneyInput, NumberInput, Select, Switch } from './ui'

interface JointAccountFormModalProps {
  open: boolean
  onClose: () => void
  groupId: string
  members: GroupMember[]
  account?: Account | GroupAccount
}

export default function JointAccountFormModal({
  open,
  onClose,
  groupId,
  members,
  account,
}: JointAccountFormModalProps) {
  const editing = !!account
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('CHECKING')
  const [moneyValue, setMoneyValue] = useState(0)
  const [tax, setTax] = useState('')
  const [includeInTotal, setIncludeInTotal] = useState(true)
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [nameError, setNameError] = useState('')
  const [membersError, setMembersError] = useState('')
  const [taxError, setTaxError] = useState('')
  const hydratedMembersRef = useRef(false)

  const memberIdsKey = useMemo(() => members.map((m) => m.user.id).join(','), [members])
  const allMemberIds = useMemo(() => members.map((m) => m.user.id), [members])

  useEffect(() => {
    if (!open) {
      hydratedMembersRef.current = false
      return
    }
    setName(account?.name ?? '')
    setType(account?.type ?? 'CHECKING')
    setMoneyValue(account ? account.balance : 0)
    setTax(account?.tax != null ? String(account.tax) : '')
    setIncludeInTotal(account?.includeInTotal ?? true)
    setNameError('')
    setMembersError('')
    setTaxError('')

    if (account) {
      if (account.allowedMembers) {
        setSelectedMemberIds(account.allowedMembers.map((m) => m.id))
        hydratedMembersRef.current = true
      } else {
        setSelectedMemberIds([])
        hydratedMembersRef.current = false
      }
    } else {
      setSelectedMemberIds(allMemberIds)
      hydratedMembersRef.current = allMemberIds.length > 0
    }
    // Inicializa estado quando o modal abre ou a conta alvo muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, account?.id])

  // Caso allowedMembers ou membros carreguem após a abertura, hidrata apenas uma vez
  useEffect(() => {
    if (!open || hydratedMembersRef.current) return
    if (editing && account?.allowedMembers) {
      setSelectedMemberIds(account.allowedMembers.map((m) => m.id))
      hydratedMembersRef.current = true
    } else if (!editing && allMemberIds.length > 0) {
      setSelectedMemberIds(allMemberIds)
      hydratedMembersRef.current = true
    }
  }, [open, editing, account?.allowedMembers, memberIdsKey, allMemberIds])

  const save = useAction(
    (body: JointAccountInput) =>
      editing
        ? api.put<GroupAccount>(`/groups/${groupId}/joint-accounts/${account.id}`, body)
        : api.post<GroupAccount>(`/groups/${groupId}/joint-accounts`, body),
    {
      invalidate: [
        ['groups', groupId, 'accounts'],
        ['groups', groupId, 'joint-accounts'],
        ['accounts'],
        ['transactions'],
        ['groups'],
      ],
      success: editing ? 'Conta conjunta atualizada' : 'Conta conjunta criada',
      onSuccess: onClose,
    },
  )

  const toggleMember = (userId: string) => {
    setSelectedMemberIds((prev) => {
      const exists = prev.includes(userId)
      const next = exists ? prev.filter((id) => id !== userId) : [...prev, userId]
      if (next.length > 0) setMembersError('')
      return next
    })
  }

  const selectAllMembers = () => {
    setSelectedMemberIds(allMemberIds)
    if (allMemberIds.length > 0) setMembersError('')
  }

  const showTax = type === 'SAVINGS' || type === 'INVESTMENTS'
  const allSelected = allMemberIds.length > 0 && allMemberIds.every((id) => selectedMemberIds.includes(id))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    let hasError = false

    if (!trimmedName) {
      setNameError('Informe o nome da conta conjunta.')
      hasError = true
    } else {
      setNameError('')
    }

    if (selectedMemberIds.length === 0) {
      setMembersError('Selecione ao menos 1 membro com acesso à conta conjunta.')
      hasError = true
    } else {
      setMembersError('')
    }

    if (hasError) return

    const parsedTax = showTax ? Number(tax) : null
    if (showTax && (tax.trim() === '' || !Number.isInteger(parsedTax) || (parsedTax ?? 0) < 0)) {
      setTaxError('Informe a taxa como número inteiro (0 ou maior).')
      return
    }
    const safeTax = parsedTax

    if (editing) {
      save.mutate({
        name: trimmedName,
        type,
        startBalance: account.startBalance,
        balance: moneyValue,
        tax: safeTax,
        includeInTotal,
        memberIds: selectedMemberIds,
      })
    } else {
      save.mutate({
        name: trimmedName,
        type,
        startBalance: moneyValue,
        tax: safeTax,
        includeInTotal,
        memberIds: selectedMemberIds,
      })
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar conta conjunta' : 'Nova conta conjunta'}
    >
      <form noValidate className="space-y-4" onSubmit={handleSubmit}>
        <Field label="Nome da conta conjunta" error={nameError}>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (nameError && e.target.value.trim()) setNameError('')
            }}
            required
            autoFocus
            maxLength={100}
            placeholder="Ex.: Conta Conjunta da Casa"
          />
        </Field>

        <div className={clsx('grid gap-3', showTax ? 'sm:grid-cols-2' : 'grid-cols-1')}>
          <Field label="Tipo da conta">
            <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
              {Object.entries(accountTypeLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>

          {showTax && (
            <Field
              label="Taxa (obrigatória)"
              hint="Informe um número inteiro (ex.: 1 para 1%)."
              error={taxError}
            >
              <NumberInput
                min={0}
                step="1"
                required
                value={tax}
                onChange={(e) => {
                  setTax(e.target.value)
                  if (taxError) setTaxError('')
                }}
                placeholder="0"
              />
            </Field>
          )}
        </div>

        <Field
          label={editing ? 'Saldo atual' : 'Saldo inicial'}
          hint={
            editing
              ? 'O saldo atual informado é aplicado diretamente à conta; o saldo inicial permanece o mesmo.'
              : undefined
          }
        >
          <MoneyInput value={moneyValue} onChange={setMoneyValue} />
        </Field>

        <div className="space-y-1 py-1">
          <Switch checked={includeInTotal} onChange={setIncludeInTotal}>
            <span className="text-sm font-medium text-white">Incluir no saldo total do grupo</span>
          </Switch>
          <p className="text-xs text-text-muted pl-14">
            Quando ativo, o saldo e os lançamentos desta conta entram nos totais consolidados do grupo.
          </p>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
                <Users className="size-3.5 text-violet-hover" />
                Membros com acesso
              </label>
              <p className="text-xs text-text-dim mt-0.5 tabular-nums">
                {selectedMemberIds.length} de {members.length} selecionado(s)
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={allSelected || members.length === 0}
              onClick={selectAllMembers}
            >
              Selecionar todos
            </Button>
          </div>

          {members.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface-2/60 px-3 py-3 text-xs text-text-dim">
              Carregando membros do grupo…
            </p>
          ) : (
            <div className="max-h-52 space-y-1.5 overflow-y-auto pr-0.5">
              {members.map((m) => {
                const checked = selectedMemberIds.includes(m.user.id)
                return (
                  <button
                    key={m.user.id}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggleMember(m.user.id)}
                    className={clsx(
                      'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition cursor-pointer select-none',
                      checked
                        ? 'border-violet/45 bg-violet-subtle/50 text-white'
                        : 'border-border bg-surface-2/40 text-text-muted hover:border-border-strong hover:text-white',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={clsx(
                        'grid size-5 shrink-0 place-items-center rounded-lg border transition',
                        checked
                          ? 'border-accent bg-accent text-canvas'
                          : 'border-border-strong bg-surface text-transparent',
                      )}
                    >
                      <Check className="size-3.5 stroke-[2.5]" />
                    </span>
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-violet/20 text-xs font-bold text-violet-hover">
                      {initials(m.user)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">
                        {fullName(m.user)}
                      </span>
                      <span className="block truncate text-xs text-text-dim">{m.user.email}</span>
                    </span>
                    <Badge tone={m.role === 'OWNER' ? 'primary' : 'default'} className="shrink-0">
                      {roleLabel[m.role]}
                    </Badge>
                  </button>
                )
              })}
            </div>
          )}

          {membersError && (
            <span className="flex items-center gap-1 text-xs text-expense font-medium">
              <span className="size-1 rounded-full bg-expense shrink-0" />
              {membersError}
            </span>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" loading={save.isPending}>
            {editing ? 'Salvar alterações' : 'Criar conta conjunta'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
