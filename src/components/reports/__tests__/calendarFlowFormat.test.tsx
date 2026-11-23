import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CalendarFlowSection from '../CalendarFlowSection'
import type { CalendarProjection, DayProjection } from '../types'

function makeDay(overrides: Partial<DayProjection> & Pick<DayProjection, 'day' | 'date'>): DayProjection {
  return {
    txs: [],
    invoices: [],
    delta: 0,
    balance: 0,
    ...overrides,
  }
}

describe('Formatação de valores no CalendarFlowSection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 15, 12, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('exibe no mínimo 2 casas decimais em saldos, variações diárias e resumos do calendário quando o valor é inteiro (ex.: 6 -> 6,00)', () => {
    const day1 = makeDay({ day: 1, date: '2026-11-01', delta: 600, balance: 600 })
    const day2 = makeDay({ day: 2, date: '2026-11-02', delta: -600, balance: 0 })
    const day3 = makeDay({ day: 3, date: '2026-11-03', delta: 0, balance: -600 })
    const day4 = makeDay({
      day: 4,
      date: '2026-11-04',
      delta: 0,
      balance: 650,
      pendingDelta: 600,
      pendingTxs: [
        {
          id: 'tx_pending',
          title: 'Recebimento pendente',
          amount: 600,
          date: '2026-11-04T12:00:00Z',
          accountId: 'acc_1',
          type: 'INCOME',
          status: 'PENDING',
          responsibleId: 'user_1',
          destinationAccountId: null,
          categoryId: null,
          recurrenceGroupId: null,
          recurrenceFrequency: null,
          recurrenceInterval: null,
          isInfinite: false,
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-01T00:00:00Z',
        },
      ],
    })

    const projection: CalendarProjection = {
      days: [day1, day2, day3, day4],
      opening: 600,
      closing: 600,
      min: day3,
    }

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <CalendarFlowSection
          period={{ month: 11, year: 2026 }}
          projection={projection}
          threshold={10000}
          accounts={[]}
          categories={[]}
        />
      </MemoryRouter>,
    ).replace(/\u00a0/g, ' ')

    // Células do calendário: valores inteiros exibem ,00 e não são renderizados sem casas decimais
    expect(html).toContain('>+6,00<')
    expect(html).toContain('>−6,00<')
    expect(html).toContain('>6,00<')
    expect(html).toContain('>0,00<')
    expect(html).toContain('>-6,00<')
    expect(html).toContain('>6,50<')

    expect(html).not.toContain('>+6<')
    expect(html).not.toContain('>−6<')
    expect(html).not.toContain('>-6<')

    // Cards de resumo e tooltips continuam formatados em BRL com 2 casas decimais
    expect(html).toContain('R$ 6,00')
    expect(html).toContain('Lançamento não pago: R$ 6,00')
  })
})
