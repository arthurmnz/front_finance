import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REMAINDER_STRATEGY,
  allocateInstallments,
  summarizeInstallments,
  type RemainderStrategy,
} from '@/lib/installments'

const sum = (values: number[]) => values.reduce((acc, v) => acc + v, 0)

describe('Utilitário de parcelamento em centavos (src/lib/installments.ts)', () => {
  it('usa FIRST_INSTALLMENT como estratégia padrão', () => {
    expect(DEFAULT_REMAINDER_STRATEGY).toBe('FIRST_INSTALLMENT')
    expect(allocateInstallments(19994, 4)).toEqual([5000, 4998, 4998, 4998])
  })

  it('divide R$ 199,94 em 4x corretamente nas 4 estratégias garantindo soma exata', () => {
    const first = allocateInstallments(19994, 4, 'FIRST_INSTALLMENT')
    expect(first).toEqual([5000, 4998, 4998, 4998])
    expect(sum(first)).toBe(19994)

    const last = allocateInstallments(19994, 4, 'LAST_INSTALLMENT')
    expect(last).toEqual([4998, 4998, 4998, 5000])
    expect(sum(last)).toBe(19994)

    const distFirst = allocateInstallments(19994, 4, 'DISTRIBUTE_FIRST')
    expect(distFirst).toEqual([4999, 4999, 4998, 4998])
    expect(sum(distFirst)).toBe(19994)

    const distLast = allocateInstallments(19994, 4, 'DISTRIBUTE_LAST')
    expect(distLast).toEqual([4998, 4998, 4999, 4999])
    expect(sum(distLast)).toBe(19994)
  })

  it('divide R$ 100,00 em 3x corretamente em todas as estratégias', () => {
    expect(allocateInstallments(10000, 3, 'FIRST_INSTALLMENT')).toEqual([3334, 3333, 3333])
    expect(allocateInstallments(10000, 3, 'LAST_INSTALLMENT')).toEqual([3333, 3333, 3334])
    expect(allocateInstallments(10000, 3, 'DISTRIBUTE_FIRST')).toEqual([3334, 3333, 3333])
    expect(allocateInstallments(10000, 3, 'DISTRIBUTE_LAST')).toEqual([3333, 3333, 3334])
  })

  it('divide R$ 0,04 em 4x mantendo o mínimo de 1 centavo por parcela', () => {
    const strategies: RemainderStrategy[] = [
      'FIRST_INSTALLMENT',
      'LAST_INSTALLMENT',
      'DISTRIBUTE_FIRST',
      'DISTRIBUTE_LAST',
    ]
    for (const strategy of strategies) {
      const result = allocateInstallments(4, 4, strategy)
      expect(result).toEqual([1, 1, 1, 1])
      expect(sum(result)).toBe(4)
    }
  })

  it('lança erro para entradas inválidas (parcelas < 1, total <= 0, total < count, não inteiros, estratégia inválida)', () => {
    expect(() => allocateInstallments(1000, 0)).toThrow()
    expect(() => allocateInstallments(1000, -2)).toThrow()
    expect(() => allocateInstallments(1000, 2.5)).toThrow()
    expect(() => allocateInstallments(0, 2)).toThrow()
    expect(() => allocateInstallments(-100, 2)).toThrow()
    expect(() => allocateInstallments(199.94, 4)).toThrow()
    expect(() => allocateInstallments(3, 4)).toThrow()
    expect(() => allocateInstallments(1000, 3, 'UNKNOWN' as RemainderStrategy)).toThrow()
  })

  it('resume corretamente parcelas iguais, com resto e personalizadas via summarizeInstallments', () => {
    expect(summarizeInstallments([])).toBe('')
    expect(summarizeInstallments([5000, 5000, 5000, 5000])).toBe('4x de R$ 50,00')
    expect(summarizeInstallments([5000, 4998, 4998, 4998])).toBe('1x de R$ 50,00 + 3x de R$ 49,98')
    expect(summarizeInstallments([4998, 4998, 4998, 5000])).toBe('3x de R$ 49,98 + 1x de R$ 50,00')
    expect(summarizeInstallments([4999, 4999, 4998, 4998])).toBe('2x de R$ 49,99 + 2x de R$ 49,98')
    expect(summarizeInstallments([5000, 4998, 5000])).toBe('1x de R$ 50,00 + 1x de R$ 49,98 + 1x de R$ 50,00')
  })
})
