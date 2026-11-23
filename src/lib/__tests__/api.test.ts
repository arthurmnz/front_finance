import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, assertValidUuid, getTransactionsByGroup, updateGroupInstallments } from '@/lib/api'

const VALID_GROUP_ID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_TX_ID = '550e8400-e29b-41d4-a716-446655440001'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Validação de UUID nos endpoints de grupo (src/lib/api.ts)', () => {
  it('aceita UUID válido e aplica encodeURIComponent na URL', () => {
    expect(assertValidUuid(VALID_GROUP_ID)).toBe(encodeURIComponent(VALID_GROUP_ID))
    expect(assertValidUuid(VALID_GROUP_ID.toUpperCase())).toBe(encodeURIComponent(VALID_GROUP_ID.toUpperCase()))
  })

  it('rejeita UUIDs inválidos, path traversal, strings vazias e quebras de linha', () => {
    const invalidInputs = [
      '',
      'not-a-uuid',
      '../admin',
      `${VALID_GROUP_ID}/../other`,
      `${VALID_GROUP_ID}?force=true`,
      `${VALID_GROUP_ID}\n`,
      `${VALID_GROUP_ID} `,
      '550e8400-e29b-41d4-a716-44665544000g',
      '550e8400-e29b-41d4-a716-44665544000',
    ]

    for (const bad of invalidInputs) {
      expect(() => assertValidUuid(bad)).toThrow(/inválido/i)
    }
  })

  it('getTransactionsByGroup rejeita UUID inválido sem disparar requisição HTTP e chama URL correta quando válido', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: [] })

    await expect(getTransactionsByGroup('../evil')).rejects.toThrow(/inválido/i)
    await expect(getTransactionsByGroup(`${VALID_GROUP_ID}\n`)).rejects.toThrow(/inválido/i)
    expect(getSpy).not.toHaveBeenCalled()

    await getTransactionsByGroup(VALID_GROUP_ID)
    expect(getSpy).toHaveBeenCalledTimes(1)
    expect(getSpy).toHaveBeenCalledWith(`/transactions/group/${encodeURIComponent(VALID_GROUP_ID)}`)
  })

  it('updateGroupInstallments valida groupId e transactionId dos itens antes de chamar PUT', async () => {
    const putSpy = vi.spyOn(api, 'put').mockResolvedValue({ data: [] })

    await expect(
      updateGroupInstallments('invalid-group-id', {
        items: [{ transactionId: VALID_TX_ID, amount: 5000 }],
      }),
    ).rejects.toThrow(/inválido/i)

    await expect(
      updateGroupInstallments(VALID_GROUP_ID, {
        items: [{ transactionId: '../bad-tx-id', amount: 5000 }],
      }),
    ).rejects.toThrow(/inválido/i)

    expect(putSpy).not.toHaveBeenCalled()

    const payload = { items: [{ transactionId: VALID_TX_ID, amount: 5000 }] }
    await updateGroupInstallments(VALID_GROUP_ID, payload)
    expect(putSpy).toHaveBeenCalledTimes(1)
    expect(putSpy).toHaveBeenCalledWith(
      `/transactions/group/${encodeURIComponent(VALID_GROUP_ID)}/installments`,
      payload,
    )
  })
})
