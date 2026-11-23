import { formatMoney } from './format'

export const MAX_AMOUNT_CENTS = 2_147_483_647

export type RemainderStrategy =
  | 'FIRST_INSTALLMENT'
  | 'LAST_INSTALLMENT'
  | 'DISTRIBUTE_FIRST'
  | 'DISTRIBUTE_LAST'

export const DEFAULT_REMAINDER_STRATEGY: RemainderStrategy = 'FIRST_INSTALLMENT'

export const REMAINDER_STRATEGY_OPTIONS: {
  value: RemainderStrategy
  label: string
  description: string
}[] = [
  {
    value: 'FIRST_INSTALLMENT',
    label: 'Na 1ª parcela',
    description: 'Concentra os centavos restantes na 1ª parcela (comum na maioria dos bancos).',
  },
  {
    value: 'LAST_INSTALLMENT',
    label: 'Na última parcela',
    description: 'Mantém as primeiras parcelas iguais e soma os centavos restantes na última.',
  },
  {
    value: 'DISTRIBUTE_FIRST',
    label: 'Distribuir +R$ 0,01 nas primeiras',
    description: 'Distribui +R$ 0,01 nas primeiras parcelas até zerar a diferença.',
  },
  {
    value: 'DISTRIBUTE_LAST',
    label: 'Distribuir +R$ 0,01 nas últimas',
    description: 'Distribui +R$ 0,01 nas últimas parcelas até zerar a diferença.',
  },
]

/**
 * Divide `totalCents` em `count` parcelas inteiras em centavos segundo a estratégia de resto.
 * Espelha exatamente `InstallmentAmountAllocator` do backend, garantindo soma exata
 * (`sum === totalCents`) e mínimo de 1 centavo por parcela.
 */
export function allocateInstallments(
  totalCents: number,
  count: number,
  strategy: RemainderStrategy = DEFAULT_REMAINDER_STRATEGY,
): number[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('A quantidade de parcelas deve ser um inteiro maior ou igual a 1.')
  }
  if (!Number.isInteger(totalCents) || totalCents <= 0) {
    throw new Error('O valor total em centavos deve ser um inteiro positivo.')
  }
  if (totalCents < count) {
    throw new Error(
      `O valor total em centavos (${totalCents}) deve ser maior ou igual à quantidade de parcelas (${count}).`,
    )
  }

  const base = Math.floor(totalCents / count)
  const remainder = totalCents % count
  const amounts = new Array<number>(count).fill(base)

  if (remainder === 0) {
    return amounts
  }

  switch (strategy) {
    case 'FIRST_INSTALLMENT':
      amounts[0] += remainder
      return amounts
    case 'LAST_INSTALLMENT':
      amounts[count - 1] += remainder
      return amounts
    case 'DISTRIBUTE_FIRST':
      for (let i = 0; i < remainder; i++) {
        amounts[i] += 1
      }
      return amounts
    case 'DISTRIBUTE_LAST':
      for (let i = 0; i < remainder; i++) {
        amounts[count - 1 - i] += 1
      }
      return amounts
    default:
      throw new Error(`Estratégia de distribuição de centavos inválida: ${String(strategy)}`)
  }
}

/**
 * Resume uma lista de valores de parcelas em centavos agrupando parcelas consecutivas iguais.
 * Ex.: `[5000, 4998, 4998, 4998]` -> `"1x de R$ 50,00 + 3x de R$ 49,98"`
 * Ex.: `[5000, 5000, 5000, 5000]` -> `"4x de R$ 50,00"`
 */
export function summarizeInstallments(amounts: number[]): string {
  if (amounts.length === 0) return ''

  const groups: { count: number; cents: number }[] = []
  for (const cents of amounts) {
    const prev = groups[groups.length - 1]
    if (prev && prev.cents === cents) {
      prev.count += 1
    } else {
      groups.push({ count: 1, cents })
    }
  }

  return groups
    .map((group) => `${group.count}x de ${formatMoney(group.cents).replace(/\u00a0/g, ' ')}`)
    .join(' + ')
}
