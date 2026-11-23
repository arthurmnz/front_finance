import { describe, expect, it } from 'vitest'
import { formatCompact, formatMoney } from '@/lib/format'

const normalizeSpaces = (value: string) => value.replace(/\u00a0/g, ' ')

describe('Formatação monetária e compacta para o calendário (src/lib/format.ts)', () => {
  it('formatCompact exibe no mínimo 2 casas decimais para valores inteiros sem decimais', () => {
    expect(formatCompact(0)).toBe('0,00')
    expect(formatCompact(600)).toBe('6,00')
    expect(formatCompact(-600)).toBe('-6,00')
    expect(formatCompact(4500)).toBe('45,00')
    expect(formatCompact(-4500)).toBe('-45,00')
    expect(formatCompact(99900)).toBe('999,00')
    expect(formatCompact(-99900)).toBe('-999,00')
  })

  it('formatCompact preserva 2 casas decimais quando há centavos', () => {
    expect(formatCompact(5)).toBe('0,05')
    expect(formatCompact(50)).toBe('0,50')
    expect(formatCompact(650)).toBe('6,50')
    expect(formatCompact(625)).toBe('6,25')
    expect(formatCompact(-1234)).toBe('-12,34')
    expect(formatCompact(99999)).toBe('999,99')
  })

  it('formatCompact mantém a compactação de milhares e milhões', () => {
    expect(formatCompact(100000)).toBe('1 mil')
    expect(formatCompact(120000)).toBe('1,2 mil')
    expect(formatCompact(-120000)).toBe('-1,2 mil')
    expect(formatCompact(1500000)).toBe('15 mil')
    expect(formatCompact(-1500000)).toBe('-15 mil')
    expect(formatCompact(150000000)).toBe('1,5 mi')
  })

  it('formatCompact evita -0,00 e entradas não finitas', () => {
    expect(formatCompact(-0)).toBe('0,00')
    expect(formatCompact(-0.1)).toBe('0,00')
    expect(formatCompact(Number.NaN)).toBe('0,00')
  })

  it('formatMoney sempre exibe 2 casas decimais em BRL', () => {
    expect(normalizeSpaces(formatMoney(0))).toBe('R$ 0,00')
    expect(normalizeSpaces(formatMoney(600))).toBe('R$ 6,00')
    expect(normalizeSpaces(formatMoney(-600))).toBe('-R$ 6,00')
    expect(normalizeSpaces(formatMoney(650))).toBe('R$ 6,50')
  })
})
