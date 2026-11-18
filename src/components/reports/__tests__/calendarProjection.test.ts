import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  MAX_CASCADE_INVOICE_MONTHS,
  buildCalendarProjection,
  buildFutureCommitments,
  buildProjectionInvoiceList,
  calculateFinancialPlanning,
  expandSimulationsForMonth,
  getInvoiceForCardPurchase,
  getMergedRequiredInvoicePeriods,
  getRequiredInvoicePeriods,
  isInvoicePaymentForCardPeriod,
  resolveTransactionInvoicePeriod,
  simulateMonthDays,
} from '../useReportsData'
import type {
  Account,
  CreditCard,
  CreditCardInvoice,
  Transaction,
} from '@/lib/types'
import type { DaySimulationItem, ReportPeriod, SimulatedTransaction } from '../types'

// Helpers para criação de mocks tipados
function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc_1',
    name: 'Conta Corrente Principal',
    type: 'CHECKING',
    balance: 39000, // R$ 390,00
    startBalance: 0,
    ownerId: 'user_1',
    tax: null,
    groupId: null,
    includeInTotal: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeCreditCard(overrides: Partial<CreditCard> = {}): CreditCard {
  return {
    id: 'card_1',
    name: 'Cartão Black',
    accountId: 'acc_1',
    ownerId: 'user_1',
    owner: null,
    groupId: null,
    limitAmount: 500000,
    usedLimit: 0,
    availableLimit: 500000,
    currentInvoiceMonth: 11,
    currentInvoiceYear: 2026,
    currentInvoiceAmount: 0,
    closingDay: 3,
    dueDay: 10,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeInvoice(
  card: CreditCard,
  month: number,
  year: number,
  remainingAmount: number,
  overrides: Partial<CreditCardInvoice> = {},
): { card: CreditCard; invoice: Partial<CreditCardInvoice>; month: number; year: number } {
  const padMonth = String(month).padStart(2, '0')
  const dueDay = String(card.dueDay || 10).padStart(2, '0')
  return {
    card,
    month,
    year,
    invoice: {
      creditCardId: card.id,
      month,
      year,
      closingDate: `${year}-${padMonth}-03T00:00:00Z`,
      dueDate: `${year}-${padMonth}-${dueDay}T00:00:00Z`,
      totalAmount: remainingAmount,
      paidAmount: 0,
      remainingAmount,
      status: 'CLOSED',
      purchasesAmount: remainingAmount,
      carriedOverAmount: 0,
      revolvingInterestAmount: 0,
      transactions: [],
      byResponsible: [],
      ...overrides,
    },
  }
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx_${Math.random().toString(36).slice(2, 8)}`,
    title: 'Transação teste',
    amount: 10000,
    date: '2026-11-15T12:00:00Z',
    accountId: 'acc_1',
    type: 'EXPENSE',
    status: 'COMPLETED',
    responsibleId: 'user_1',
    destinationAccountId: null,
    categoryId: 'cat_1',
    recurrenceGroupId: null,
    recurrenceFrequency: null,
    recurrenceInterval: null,
    isInfinite: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('Blindagem Contábil do Calendário Financeiro (buildCalendarProjection & simulateMonthDays)', () => {
  // Congela o tempo em 11 de Novembro de 2026 para testes determinísticos
  const FIXED_TODAY = new Date(2026, 10, 11, 12, 0, 0) // 2026-11-11

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_TODAY)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('1. Caso do bug real: Saldo 390 e fatura 1.180 no mês M fecha em -790 e abre M+1 rigorosamente em -790', () => {
    const account = makeAccount({ balance: 39000 }) // R$ 390,00
    const card = makeCreditCard({ accountId: account.id, dueDay: 10 })

    // Fatura de Novembro/2026 (Mês M): R$ 1.180,00 com vencimento em 10/11/2026 (dia anterior a hoje)
    const novInvoice = makeInvoice(card, 11, 2026, 118000, {
      dueDate: '2026-11-10T00:00:00Z',
      status: 'CLOSED',
    })

    // Fatura de Dezembro/2026 (Mês M+1): R$ 0,00
    const decInvoice = makeInvoice(card, 12, 2026, 0, {
      dueDate: '2026-12-10T00:00:00Z',
      status: 'OPEN',
    })

    const invoiceList = [novInvoice, decInvoice]
    const transactions: Transaction[] = []

    // --- CENÁRIO A: Visualizando o mês M (Novembro/2026) ---
    const periodM: ReportPeriod = { month: 11, year: 2026 }
    const projM = buildCalendarProjection(
      [account],
      transactions,
      invoiceList,
      periodM,
      undefined,
      transactions,
    )

    // O fechamento de Novembro deve descontar a fatura de 1.180 do saldo de 390, resultando exatamente em -790,00
    expect(projM.closing).toBe(-79000)
    expect(projM.realClosing).toBe(-79000)

    // --- CENÁRIO B: Avançando para o mês M+1 (Dezembro/2026) ---
    const periodM1: ReportPeriod = { month: 12, year: 2026 }
    const projM1 = buildCalendarProjection(
      [account],
      transactions,
      invoiceList,
      periodM1,
      undefined,
      transactions,
    )

    // Abertura de Dezembro DEVE ser rigorosamente igual ao fechamento de Novembro (-790,00)
    // Sem nunca reiniciar ou saltar falsamente para +390,00
    expect(projM1.opening).toBe(-79000)
    expect(projM1.realOpening).toBe(-79000)
    expect(projM1.opening).toBe(projM.closing)
    expect(projM1.realOpening).toBe(projM.realClosing)

    // O primeiro dia de Dezembro deve iniciar com o saldo encadeado correto
    expect(projM1.days[0].balance).toBe(-79000)
  })

  it('2. Garantia de Encadeamento Estrito: opening(M+1) === closing(M) em cascata contínua (M -> M+1 -> M+2 -> M+3)', () => {
    const account = makeAccount({ balance: 50000 }) // R$ 500,00
    const card = makeCreditCard({ accountId: account.id })

    const invoiceList = [
      makeInvoice(card, 11, 2026, 20000, { dueDate: '2026-11-15T00:00:00Z' }), // -200 em Nov
      makeInvoice(card, 12, 2026, 15000, { dueDate: '2026-12-10T00:00:00Z' }), // -150 em Dez
      makeInvoice(card, 1, 2027, 10000, { dueDate: '2027-01-10T00:00:00Z' }),  // -100 em Jan
      makeInvoice(card, 2, 2027, 5000, { dueDate: '2027-02-10T00:00:00Z' }),   // -50 em Fev
    ]

    const transactions: Transaction[] = [
      makeTx({ date: '2026-11-20T10:00:00Z', amount: 5000, type: 'INCOME', status: 'PENDING' }), // +50 em Nov
      makeTx({ date: '2026-12-05T10:00:00Z', amount: 3000, type: 'EXPENSE', status: 'PENDING' }), // -30 em Dez
      makeTx({ date: '2027-01-15T10:00:00Z', amount: 8000, type: 'INCOME', status: 'PENDING' }), // +80 em Jan
    ]

    const projNov = buildCalendarProjection([account], transactions, invoiceList, { month: 11, year: 2026 })
    const projDez = buildCalendarProjection([account], transactions, invoiceList, { month: 12, year: 2026 })
    const projJan = buildCalendarProjection([account], transactions, invoiceList, { month: 1, year: 2027 })
    const projFev = buildCalendarProjection([account], transactions, invoiceList, { month: 2, year: 2027 })

    // Regra da Continuidade Absoluta:
    // Abertura de M+1 DEVE ser idêntica ao fechamento de M
    expect(projDez.opening).toBe(projNov.closing)
    expect(projDez.realOpening).toBe(projNov.realClosing)

    expect(projJan.opening).toBe(projDez.closing)
    expect(projJan.realOpening).toBe(projDez.realClosing)

    expect(projFev.opening).toBe(projJan.closing)
    expect(projFev.realOpening).toBe(projJan.realClosing)
  })

  it('3. Transações PENDING do mês corrente afetam o fechamento de M e abrem M+1 corretamente', () => {
    const account = makeAccount({ balance: 100000 }) // R$ 1.000,00
    const card = makeCreditCard({ accountId: account.id })

    // Despesa pendente de R$ 350,00 agendada para 20/11/2026 (futuro relativo a 11/11/2026)
    const pendingExpense = makeTx({
      date: '2026-11-20T10:00:00Z',
      amount: 35000,
      type: 'EXPENSE',
      status: 'PENDING',
    })

    // Receita pendente de R$ 200,00 agendada para 25/11/2026
    const pendingIncome = makeTx({
      date: '2026-11-25T10:00:00Z',
      amount: 20000,
      type: 'INCOME',
      status: 'PENDING',
    })

    const transactions = [pendingExpense, pendingIncome]
    const invoiceList = [makeInvoice(card, 11, 2026, 0), makeInvoice(card, 12, 2026, 0)]

    const projM = buildCalendarProjection([account], transactions, invoiceList, { month: 11, year: 2026 })
    // Saldo projetado no fim de Nov: 1000 - 350 + 200 = 850
    expect(projM.closing).toBe(85000)

    const projM1 = buildCalendarProjection([account], transactions, invoiceList, { month: 12, year: 2026 })
    // Abertura de Dezembro reflete os lançamentos pendentes previstos de Novembro
    expect(projM1.opening).toBe(85000)
    expect(projM1.opening).toBe(projM.closing)
  })

  it('4. Faturas Vencidas Não Pagas (isOverdue): Débito é aplicado a partir de todayIso e sinalizado com isOverdue', () => {
    const account = makeAccount({ balance: 50000 }) // R$ 500,00
    const card = makeCreditCard({ accountId: account.id, dueDay: 5 })

    // Fatura com vencimento em 05/11/2026 (passado relativo a 11/11/2026), não paga (status CLOSED, remaining: 150)
    const overdueInvoice = makeInvoice(card, 11, 2026, 15000, {
      dueDate: '2026-11-05T00:00:00Z',
      status: 'CLOSED',
    })

    const invoiceList = [overdueInvoice]
    const proj = buildCalendarProjection([account], [], invoiceList, { month: 11, year: 2026 })

    // Nos dias passados anteriores a hoje (ex: dia 1 a 10), o saldo bancário confirmado era 500
    // porque a fatura NÃO havia sido paga e não debitou a conta bancária
    const day4 = proj.days.find((d) => d.day === 4)!
    expect(day4.balance).toBe(50000)

    // No dia de vencimento (dia 5), a fatura aparece para o usuário sinalizada como vencida
    const day5 = proj.days.find((d) => d.day === 5)!
    expect(day5.invoices.length).toBeGreaterThan(0)
    expect(day5.invoices.some((i) => i.isOverdue)).toBe(true)

    // No dia de hoje (11/11/2026), a pendência ativa entra no fluxo projetado da conta:
    // Saldo cai para 500 - 150 = 350
    const day11 = proj.days.find((d) => d.day === 11)!
    expect(day11.balance).toBe(35000)
    expect(day11.invoices.some((i) => i.isOverdue)).toBe(true)

    // O fechamento de Novembro mantém o débito de 150
    expect(proj.closing).toBe(35000)
  })

  it('5. Simulações Hipotéticas (SimulatedTransaction): Propagam através da transição entre meses', () => {
    const account = makeAccount({ balance: 100000 }) // R$ 1.000,00
    const card = makeCreditCard({ accountId: account.id })

    // Simulação hipotética em Novembro: despesa hipotética de R$ 400,00 no dia 22/11
    const simulation: SimulatedTransaction = {
      id: 'sim_1',
      title: 'Compra de Computador (Simulação)',
      amount: 40000,
      type: 'EXPENSE',
      date: '2026-11-22T10:00:00Z',
      accountId: account.id,
    }

    const invoiceList = [makeInvoice(card, 11, 2026, 0), makeInvoice(card, 12, 2026, 0)]

    // Simulação no mês M (Novembro):
    const projNov = buildCalendarProjection(
      [account],
      [],
      invoiceList,
      { month: 11, year: 2026 },
      undefined,
      [],
      [simulation],
    )

    // Saldo com simulação termina em 1000 - 400 = 600, mas saldo real é 1000
    expect(projNov.closing).toBe(60000)
    expect(projNov.realClosing).toBe(100000)

    // Avançando para M+1 (Dezembro):
    const projDez = buildCalendarProjection(
      [account],
      [],
      invoiceList,
      { month: 12, year: 2026 },
      undefined,
      [],
      [simulation],
    )

    // Abertura com simulação deve ser 600 e real deve ser 1000
    expect(projDez.opening).toBe(60000)
    expect(projDez.realOpening).toBe(100000)
    expect(projDez.hasSimulations).toBe(true)

    // Continuidade rigorosa preservada:
    expect(projDez.opening).toBe(projNov.closing)
    expect(projDez.realOpening).toBe(projNov.realClosing)
  })

  it('6. simulateMonthDays puro: Retorna métricas determinísticas e exatas para qualquer mês', () => {
    const result = simulateMonthDays({
      year: 2026,
      month: 11,
      opening: 50000,
      realOpening: 50000,
      todayIso: '2026-11-11',
      currentYear: 2026,
      currentMonth: 11,
      accountSource: [],
      displaySource: [],
      simulations: [],
      getMonthInvoices: () => [],
      effect: (t) => t.amount,
      simEffect: (s) => (s.type === 'INCOME' ? s.amount : -s.amount),
    })

    expect(result.days.length).toBe(30)
    expect(result.closing).toBe(50000)
    expect(result.realClosing).toBe(50000)
    expect(result.min.balance).toBe(50000)
    expect(result.firstNegative).toBeUndefined()
  })

  it('7. Simulação de Assinatura Recorrente em Conta Bancária: Repete mensalmente no dia determinado', () => {
    const account = makeAccount({ balance: 200000 }) // R$ 2.000,00
    const card = makeCreditCard({ accountId: account.id })

    // Assinatura de internet: R$ 120,00 todo dia 15 em conta, infinita
    const subscription: SimulatedTransaction = {
      id: 'sim_internet',
      title: 'Internet Fibra',
      amount: 12000,
      type: 'EXPENSE',
      date: '2026-11-15T00:00:00Z',
      accountId: account.id,
      sourceMode: 'ACCOUNT',
      isRecurring: true,
      recurrenceFrequency: 'MONTHLY',
      isInfinite: true,
    }

    const invoiceList = [
      makeInvoice(card, 11, 2026, 0),
      makeInvoice(card, 12, 2026, 0),
      makeInvoice(card, 1, 2027, 0),
    ]

    // Novembro 2026: deve incidir no dia 15
    const projNov = buildCalendarProjection(
      [account],
      [],
      invoiceList,
      { month: 11, year: 2026 },
      undefined,
      [],
      [subscription],
    )
    const day15Nov = projNov.days.find((d) => d.day === 15)!
    expect(day15Nov.simulations).toBeDefined()
    expect(day15Nov.simulations!.length).toBe(1)
    expect(projNov.closing).toBe(200000 - 12000) // 1.880,00

    // Dezembro 2026: deve abrir com 1.880, incidir no dia 15 e fechar com 1.760
    const projDez = buildCalendarProjection(
      [account],
      [],
      invoiceList,
      { month: 12, year: 2026 },
      undefined,
      [],
      [subscription],
    )
    expect(projDez.opening).toBe(188000)
    const day15Dez = projDez.days.find((d) => d.day === 15)!
    expect(day15Dez.simulations).toBeDefined()
    expect(day15Dez.simulations!.length).toBe(1)
    expect(projDez.closing).toBe(176000)
  })

  it('8. Simulação de Cartão Parcela Única: Impacta no vencimento real (dueDay < closingDay: antes e após fechamento)', () => {
    const account = makeAccount({ balance: 500000 }) // R$ 5.000,00
    // Cartão fecha dia 25 e vence dia 10 (dueDay < closingDay => vence no mês seguinte ao fechamento)
    const card = makeCreditCard({ accountId: account.id, closingDay: 25, dueDay: 10 })

    // Compra no dia 26/11 (após fechamento 25/11): fecha em 25/12/2026 e vence em 10/01/2027 (01/2027)
    const afterClosingSim: SimulatedTransaction = {
      id: 'sim_card_after_closing',
      title: 'Restaurante Fim de Semana',
      amount: 25000, // R$ 250,00
      type: 'EXPENSE',
      date: '2026-11-26T12:00:00Z',
      creditCardId: card.id,
      sourceMode: 'CARD',
      cardName: card.name,
      accountId: account.id,
    }

    // Compra no dia 20/11 (antes do fechamento 25/11): fecha em 25/11/2026 e vence em 10/12/2026 (12/2026)
    const beforeClosingSim: SimulatedTransaction = {
      id: 'sim_card_before_closing_due_next',
      title: 'Mercado Antes do Corte',
      amount: 15000, // R$ 150,00
      type: 'EXPENSE',
      date: '2026-11-20T12:00:00Z',
      creditCardId: card.id,
      sourceMode: 'CARD',
      cardName: card.name,
      accountId: account.id,
    }

    const invoiceList = [
      makeInvoice(card, 11, 2026, 0),
      makeInvoice(card, 12, 2026, 0),
      makeInvoice(card, 1, 2027, 0),
    ]

    // Novembro: exibe registros visuais nos dias 20 e 26, sem débito bancário em Novembro
    const projNov = buildCalendarProjection(
      [account],
      [],
      invoiceList,
      { month: 11, year: 2026 },
      undefined,
      [],
      [afterClosingSim, beforeClosingSim],
      [card],
    )

    const day20Nov = projNov.days.find((d) => d.day === 20)!
    expect(day20Nov.simulations).toHaveLength(1)
    expect((day20Nov.simulations![0] as DaySimulationItem).effectiveDebitDate).toBe('2026-12-10')

    const day26Nov = projNov.days.find((d) => d.day === 26)!
    expect(day26Nov.simulations).toHaveLength(1)
    expect((day26Nov.simulations![0] as DaySimulationItem).effectiveDebitDate).toBe('2027-01-10')
    expect(projNov.closing).toBe(500000)

    // Dezembro: apenas a compra de 20/11 (R$ 150,00) vence em 10/12/2026
    const projDez = buildCalendarProjection(
      [account],
      [],
      invoiceList,
      { month: 12, year: 2026 },
      undefined,
      [],
      [afterClosingSim, beforeClosingSim],
      [card],
    )

    expect(projDez.opening).toBe(500000)
    const day10Dez = projDez.days.find((d) => d.day === 10)!
    expect(day10Dez.simulations).toHaveLength(1)
    expect(projDez.closing).toBe(500000 - 15000)

    // Janeiro/2027: a compra de 26/11 (R$ 250,00) vence em 10/01/2027
    const projJan = buildCalendarProjection(
      [account],
      [],
      invoiceList,
      { month: 1, year: 2027 },
      undefined,
      [],
      [afterClosingSim, beforeClosingSim],
      [card],
    )

    expect(projJan.opening).toBe(projDez.closing)
    const day10Jan = projJan.days.find((d) => d.day === 10)!
    expect(day10Jan.simulations).toHaveLength(1)
    expect(projJan.closing).toBe(500000 - 15000 - 25000)
  })

  it('9. Simulação de Cartão Parcelado: Distribui N parcelas nas faturas seguintes com dueDay < closingDay (01/2027, 02/2027, 03/2027)', () => {
    const account = makeAccount({ balance: 300000 }) // R$ 3.000,00
    const card = makeCreditCard({ accountId: account.id, closingDay: 25, dueDay: 10 })

    // Compra de Smartphone em 3x de R$ 100,00 no dia 26/11/2026 (após fechamento 25/11, dueDay 10 < 25)
    // 1ª parcela: 01/2027 (10/01), 2ª parcela: 02/2027 (10/02), 3ª parcela: 03/2027 (10/03)
    const parcelSim: SimulatedTransaction = {
      id: 'sim_phone_parcel',
      title: 'Smartphone',
      amount: 10000, // R$ 100,00 por parcela
      type: 'EXPENSE',
      date: '2026-11-26T00:00:00Z',
      creditCardId: card.id,
      cardName: card.name,
      sourceMode: 'CARD',
      accountId: account.id,
      totalInstallments: 3,
    }

    const invoiceList = [
      makeInvoice(card, 11, 2026, 0),
      makeInvoice(card, 12, 2026, 0),
      makeInvoice(card, 1, 2027, 0),
      makeInvoice(card, 2, 2027, 0),
      makeInvoice(card, 3, 2027, 0),
    ]

    // Novembro 2026: exibe compra no dia 26 sem débito bancário
    const projNov = buildCalendarProjection(
      [account],
      [],
      invoiceList,
      { month: 11, year: 2026 },
      undefined,
      [],
      [parcelSim],
      [card],
    )
    expect(projNov.closing).toBe(300000)
    const day26Nov = projNov.days.find((d) => d.day === 26)!
    expect((day26Nov.simulations![0] as DaySimulationItem).effectiveDebitDate).toBe('2027-01-10')

    // Dezembro 2026: ainda não vence a 1ª parcela
    const projDez = buildCalendarProjection(
      [account],
      [],
      invoiceList,
      { month: 12, year: 2026 },
      undefined,
      [],
      [parcelSim],
      [card],
    )
    expect(projDez.opening).toBe(300000)
    expect(projDez.closing).toBe(300000)

    // Janeiro 2027: parcela 1/3 debita no dia 10
    const projJan = buildCalendarProjection(
      [account],
      [],
      invoiceList,
      { month: 1, year: 2027 },
      undefined,
      [],
      [parcelSim],
      [card],
    )
    expect(projJan.opening).toBe(300000)
    expect(projJan.closing).toBe(290000)

    // Fevereiro 2027: parcela 2/3 debita no dia 10
    const projFev = buildCalendarProjection(
      [account],
      [],
      invoiceList,
      { month: 2, year: 2027 },
      undefined,
      [],
      [parcelSim],
      [card],
    )
    expect(projFev.opening).toBe(290000)
    expect(projFev.closing).toBe(280000)

    // Março 2027: parcela 3/3 debita no dia 10
    const projMar = buildCalendarProjection(
      [account],
      [],
      invoiceList,
      { month: 3, year: 2027 },
      undefined,
      [],
      [parcelSim],
      [card],
    )
    expect(projMar.opening).toBe(280000)
    expect(projMar.closing).toBe(270000)
  })

  it('10. Simulação de Cartão Parcela Única ANTES do Fechamento: Impacta na fatura atual do mesmo mês', () => {
    const account = makeAccount({ balance: 500000 }) // R$ 5.000,00
    // Cartão fecha dia 20 e vence dia 28
    const card = makeCreditCard({ accountId: account.id, closingDay: 20, dueDay: 28 })

    // Compra no dia 15/11/2026 (antes do fechamento 20)
    const cardSim: SimulatedTransaction = {
      id: 'sim_card_before_closing',
      title: 'Supermercado Mensal',
      amount: 35000, // R$ 350,00
      type: 'EXPENSE',
      date: '2026-11-15T12:00:00Z',
      creditCardId: card.id,
      sourceMode: 'CARD',
      cardName: card.name,
      accountId: account.id,
    }

    const invoiceList = [
      makeInvoice(card, 11, 2026, 0),
      makeInvoice(card, 12, 2026, 0),
    ]

    // Novembro: a compra foi dia 15 (antes do corte 20).
    // Dia 15 exibe registro visual de compra no cartão (sem alterar saldo em conta).
    // Dia 28 (vencimento da fatura do mês 11) debita os R$ 350,00 da conta bancária.
    const projNov = buildCalendarProjection(
      [account],
      [],
      invoiceList,
      { month: 11, year: 2026 },
      undefined,
      [],
      [cardSim],
      [card],
    )

    const day15Nov = projNov.days.find((d) => d.day === 15)!
    expect(day15Nov.simulations).toBeDefined()
    expect(day15Nov.simulations!.some((s) => 'isCardPurchaseDay' in s && s.isCardPurchaseDay)).toBe(true)

    // Antes do vencimento no dia 28, o saldo da conta permanece R$ 5.000,00
    const day27Nov = projNov.days.find((d) => d.day === 27)!
    expect(day27Nov.balance).toBe(500000)

    // No dia 28 (vencimento), ocorre o débito de R$ 350,00
    const day28Nov = projNov.days.find((d) => d.day === 28)!
    expect(day28Nov.simulations).toBeDefined()
    expect(day28Nov.simulations!.some((s) => 'isCardInvoiceDebitDay' in s && s.isCardInvoiceDebitDay)).toBe(true)
    expect(day28Nov.balance).toBe(500000 - 35000) // R$ 4.650,00

    // Fechamento de Novembro reflete o débito
    expect(projNov.closing).toBe(465000)

    // Dezembro abre rigorosamente com o saldo de fechamento de Novembro
    const projDez = buildCalendarProjection(
      [account],
      [],
      invoiceList,
      { month: 12, year: 2026 },
      undefined,
      [],
      [cardSim],
      [card],
    )
    expect(projDez.opening).toBe(465000)
    expect(projDez.opening).toBe(projNov.closing)
    expect(projDez.closing).toBe(465000)
  })

  it('11. Simulação de Assinatura Recorrente no Cartão de Crédito: Cobra mensalmente e debita na fatura correspondente', () => {
    const account = makeAccount({ balance: 400000 }) // R$ 4.000,00
    // Cartão fecha dia 20 e vence dia 28
    const card = makeCreditCard({ accountId: account.id, closingDay: 20, dueDay: 28 })

    // Assinatura de streaming no cartão todo dia 5 (antes do fechamento 20)
    const cardSubscription: SimulatedTransaction = {
      id: 'sim_streaming_card',
      title: 'Streaming 4K',
      amount: 5500, // R$ 55,00
      type: 'EXPENSE',
      date: '2026-11-05T00:00:00Z',
      creditCardId: card.id,
      cardName: card.name,
      sourceMode: 'CARD',
      accountId: account.id,
      isRecurring: true,
      recurrenceFrequency: 'MONTHLY',
      isInfinite: true,
    }

    const invoiceList = [
      makeInvoice(card, 11, 2026, 0),
      makeInvoice(card, 12, 2026, 0),
      makeInvoice(card, 1, 2027, 0),
    ]

    // Novembro 2026:
    const projNov = buildCalendarProjection(
      [account],
      [],
      invoiceList,
      { month: 11, year: 2026 },
      undefined,
      [],
      [cardSubscription],
      [card],
    )

    // Dia 5 de Novembro: registro visual da cobrança no cartão
    const day5Nov = projNov.days.find((d) => d.day === 5)!
    expect(day5Nov.simulations).toBeDefined()
    expect(day5Nov.simulations!.some((s) => 'isCardPurchaseDay' in s && s.isCardPurchaseDay)).toBe(true)

    // Dia 28 de Novembro: débito na fatura de Novembro
    const day28Nov = projNov.days.find((d) => d.day === 28)!
    expect(day28Nov.simulations).toBeDefined()
    expect(day28Nov.simulations!.some((s) => 'isCardInvoiceDebitDay' in s && s.isCardInvoiceDebitDay)).toBe(true)
    expect(projNov.closing).toBe(400000 - 5500) // R$ 3.945,00

    // Dezembro 2026:
    const projDez = buildCalendarProjection(
      [account],
      [],
      invoiceList,
      { month: 12, year: 2026 },
      undefined,
      [],
      [cardSubscription],
      [card],
    )

    expect(projDez.opening).toBe(projNov.closing) // Invariante opening(M+1) === closing(M)
    expect(projDez.closing).toBe(400000 - 5500 * 2) // R$ 3.890,00
  })

  it('12. Cenário real Novembro -> Janeiro -> Fevereiro (-2.700 fechamento Jan === -2.700 abertura Fev) com carriedOverAmount, revolvingInterestAmount e compra de terceiro no cartão próprio', () => {
    const account = makeAccount({ balance: 100000 }) // R$ 1.000,00 em 11/11/2026
    const card = makeCreditCard({ accountId: account.id, closingDay: 25, dueDay: 10 })

    const ownPurchase = makeTx({
      id: 'tx_own_jan',
      title: 'Compra Própria Dezembro',
      amount: 100000, // R$ 1.000,00
      date: '2026-12-02T12:00:00Z',
      creditCardId: card.id,
      responsibleId: 'user_1',
    })
    const thirdPartyPurchase = makeTx({
      id: 'tx_third_jan',
      title: 'Compra de Terceiro no Meu Cartão',
      amount: 100000, // R$ 1.000,00
      date: '2026-12-03T12:00:00Z',
      creditCardId: card.id,
      responsibleId: 'user_2',
    })
    const personalTxs = [ownPurchase]
    const calendarAllTransactions = [ownPurchase, thirdPartyPurchase]

    // Faturas da API ao longo da cascata Nov/2026 -> Dez/2026 -> Jan/2027 -> Fev/2027
    const apiInvoicesByKey = new Map<string, CreditCardInvoice>([
      [
        '11/2026',
        makeInvoice(card, 11, 2026, 0, {
          status: 'PAID',
          dueDate: '2026-11-10T00:00:00Z',
        }).invoice as CreditCardInvoice,
      ],
      [
        '12/2026',
        makeInvoice(card, 12, 2026, 120000, {
          purchasesAmount: 95000,
          carriedOverAmount: 20000,
          revolvingInterestAmount: 5000,
          totalAmount: 120000,
          remainingAmount: 120000,
          dueDate: '2026-12-10T00:00:00Z',
        }).invoice as CreditCardInvoice,
      ],
      [
        '1/2027',
        makeInvoice(card, 1, 2027, 250000, {
          purchasesAmount: 200000, // R$ 1.000 própria + R$ 1.000 terceiro
          carriedOverAmount: 40000,
          revolvingInterestAmount: 10000,
          totalAmount: 250000,
          remainingAmount: 250000,
          dueDate: '2027-01-10T00:00:00Z',
        }).invoice as CreditCardInvoice,
      ],
      [
        '2/2027',
        makeInvoice(card, 2, 2027, 50000, {
          purchasesAmount: 50000,
          totalAmount: 50000,
          remainingAmount: 50000,
          dueDate: '2027-02-10T00:00:00Z',
        }).invoice as CreditCardInvoice,
      ],
    ])

    // Passo 1: Usuário visualiza Janeiro/2027
    const janPeriods = getRequiredInvoicePeriods(11, 2026, { month: 1, year: 2027 })
    expect(janPeriods).toEqual([
      { month: 11, year: 2026 },
      { month: 12, year: 2026 },
      { month: 1, year: 2027 },
    ])
    const janTargets = janPeriods.map((p) => ({ card, month: p.month, year: p.year }))
    const janInvoiceList = buildProjectionInvoiceList(
      janTargets,
      janTargets.map((t) => apiInvoicesByKey.get(`${t.month}/${t.year}`)),
    )

    const projJan = buildCalendarProjection(
      [account],
      personalTxs,
      janInvoiceList,
      { month: 1, year: 2027 },
      undefined,
      calendarAllTransactions,
      [],
      [card],
      FIXED_TODAY,
    )
    // 1.000 (saldo) - 1.200 (fatura Dez com rotativo) - 2.500 (fatura Jan com terceiro + rotativo) = -2.700
    expect(projJan.closing).toBe(-270000)

    // Passo 2: Usuário avança para Fevereiro/2027
    const fevPeriods = getRequiredInvoicePeriods(11, 2026, { month: 2, year: 2027 })
    expect(fevPeriods).toEqual([
      { month: 11, year: 2026 },
      { month: 12, year: 2026 },
      { month: 1, year: 2027 },
      { month: 2, year: 2027 },
    ])
    const fevTargets = fevPeriods.map((p) => ({ card, month: p.month, year: p.year }))
    const fevInvoiceList = buildProjectionInvoiceList(
      fevTargets,
      fevTargets.map((t) => apiInvoicesByKey.get(`${t.month}/${t.year}`)),
    )

    const projFev = buildCalendarProjection(
      [account],
      personalTxs,
      fevInvoiceList,
      { month: 2, year: 2027 },
      undefined,
      calendarAllTransactions,
      [],
      [card],
      FIXED_TODAY,
    )

    expect(projFev.opening).toBe(-270000)
    expect(projFev.opening).toBe(projJan.closing)
    expect(projFev.closing).toBe(-320000)

    // Passo 3: Fallback com compra de terceiro no cartão próprio quando fatura da API ainda não veio
    const zeroAccount = makeAccount({ balance: 0 })
    const ownDecPurchase = makeTx({
      id: 'tx_fb_own',
      title: 'Compra Própria Fallback',
      amount: 150000, // R$ 1.500,00
      date: '2026-12-02T12:00:00Z',
      creditCardId: card.id,
      responsibleId: 'user_1',
    })
    const thirdDecPurchase = makeTx({
      id: 'tx_fb_third',
      title: 'Compra Terceiro Fallback',
      amount: 120000, // R$ 1.200,00
      date: '2026-12-03T12:00:00Z',
      creditCardId: card.id,
      responsibleId: 'user_2',
    })
    const fbTargets = fevPeriods.map((p) => ({ card, month: p.month, year: p.year }))
    const fbInvoiceList = buildProjectionInvoiceList(
      fbTargets,
      fbTargets.map(() => undefined),
    )

    const projJanFb = buildCalendarProjection(
      [zeroAccount],
      [ownDecPurchase],
      fbInvoiceList,
      { month: 1, year: 2027 },
      undefined,
      [ownDecPurchase, thirdDecPurchase],
      [],
      [card],
      FIXED_TODAY,
    )
    const projFevFb = buildCalendarProjection(
      [zeroAccount],
      [ownDecPurchase],
      fbInvoiceList,
      { month: 2, year: 2027 },
      undefined,
      [ownDecPurchase, thirdDecPurchase],
      [],
      [card],
      FIXED_TODAY,
    )
    // Valor integral da fatura (1.500 + 1.200 = 2.700) é debitado da conta sem exibir tx de terceiro no displaySource
    const projDecFb = buildCalendarProjection(
      [zeroAccount],
      [ownDecPurchase],
      fbInvoiceList,
      { month: 12, year: 2026 },
      undefined,
      [ownDecPurchase, thirdDecPurchase],
      [],
      [card],
      FIXED_TODAY,
    )
    expect(projDecFb.days.flatMap((d) => d.txs).some((t) => t.id === 'tx_fb_own')).toBe(true)
    expect(projDecFb.days.flatMap((d) => d.txs).some((t) => t.id === 'tx_fb_third')).toBe(false)

    expect(projJanFb.closing).toBe(-270000)
    expect(projFevFb.opening).toBe(-270000)
    expect(projJanFb.days.flatMap((d) => d.txs).some((t) => t.id === 'tx_fb_third')).toBe(false)
  })

  it('13. Fallback analítico de Janeiro ignora pagamentos históricos de Outubro/Novembro (R$ 1.400) e prioriza fatura populada sobre {}', () => {
    const account = makeAccount({ balance: 0 }) // Saldo em 11/11 após pagamento de Novembro
    const card = makeCreditCard({ accountId: account.id, closingDay: 25, dueDay: 10 })

    // Pagamentos históricos de faturas anteriores (Outubro e Novembro de R$ 1.400,00 cada)
    const octPayment = makeTx({
      id: 'tx_pay_oct',
      title: 'Pagamento fatura Cartão Black (10/2026)',
      amount: 140000,
      date: '2026-10-10T12:00:00Z',
      type: 'EXPENSE',
      status: 'COMPLETED',
      creditCardInvoiceId: 'inv_oct_2026',
    })
    const novPayment = makeTx({
      id: 'tx_pay_nov',
      title: 'Pagamento fatura Cartão Black (11/2026)',
      amount: 140000,
      date: '2026-11-10T12:00:00Z',
      type: 'EXPENSE',
      status: 'COMPLETED',
      creditCardInvoiceId: 'inv_nov_2026',
    })
    // Compra no cartão dia 26/11 (após corte 25/11, dueDay 10 < 25 => fatura 01/2027)
    const janPurchase = makeTx({
      id: 'tx_jan_purchase',
      title: 'Compra Parcelada Jan',
      amount: 270000, // R$ 2.700,00
      date: '2026-11-26T12:00:00Z',
      type: 'EXPENSE',
      status: 'COMPLETED',
      creditCardId: card.id,
    })

    const allTxs = [octPayment, novPayment, janPurchase]
    const periods = getRequiredInvoicePeriods(11, 2026, { month: 2, year: 2027 })
    const targets = periods.map((p) => ({ card, month: p.month, year: p.year }))
    // Simula API sem resposta para Jan/Fev (undefined -> {})
    const invoiceList = buildProjectionInvoiceList(
      targets,
      targets.map(() => undefined),
    )

    const projJan = buildCalendarProjection(
      [account],
      allTxs,
      invoiceList,
      { month: 1, year: 2027 },
      undefined,
      allTxs,
      [],
      [card],
      FIXED_TODAY,
    )
    const projFev = buildCalendarProjection(
      [account],
      allTxs,
      invoiceList,
      { month: 2, year: 2027 },
      undefined,
      allTxs,
      [],
      [card],
      FIXED_TODAY,
    )

    // Deve fechar Jan e abrir Fev exatamente em -2.700,00 (nunca -1.300,00 por abatimento de 11/2026)
    expect(projJan.closing).toBe(-270000)
    expect(projFev.opening).toBe(-270000)
    expect(projFev.opening).toBe(projJan.closing)

    // Priorização na busca matched: item populado vence sobre {} anterior na lista
    const invoicesWithEmptyFirst = [
      { card, invoice: {} as Partial<CreditCardInvoice>, month: 1, year: 2027 },
      makeInvoice(card, 1, 2027, 295000, {
        dueDate: '2027-01-10T00:00:00Z',
        carriedOverAmount: 25000,
      }),
    ]
    const projPrioritized = buildCalendarProjection(
      [account],
      allTxs,
      invoicesWithEmptyFirst,
      { month: 1, year: 2027 },
      undefined,
      allTxs,
      [],
      [card],
      FIXED_TODAY,
    )
    expect(projPrioritized.closing).toBe(-295000)
  })

  it('14. isInvoicePaymentForCardPeriod e fallback analítico: padded/unpadded, colisão de prefixo, PENDING, pagamento parcial e estorno INCOME', () => {
    const nubank = makeCreditCard({ id: 'card_nb', name: 'Nubank', closingDay: 25, dueDay: 10 })
    const nubankBlack = makeCreditCard({ id: 'card_nbb', name: 'Nubank Black', closingDay: 25, dueDay: 10 })

    const payPadded = makeTx({
      title: 'Pagamento fatura Nubank (01/2027)',
      amount: 100000,
      status: 'COMPLETED',
    })
    const payUnpadded = makeTx({
      title: 'Pagamento fatura Nubank (1/2027)',
      amount: 100000,
      status: 'COMPLETED',
    })
    const payCaseInsensitive = makeTx({
      title: '  pagamento fatura  nubank  (01/2027) ',
      amount: 100000,
      status: 'COMPLETED',
    })
    const payBlack = makeTx({
      title: 'Pagamento fatura Nubank Black (01/2027)',
      amount: 100000,
      status: 'COMPLETED',
    })
    const payPending = makeTx({
      title: 'Pagamento fatura Nubank (01/2027)',
      amount: 100000,
      status: 'PENDING',
    })
    const payWithId = makeTx({
      title: 'Pagamento personalizado',
      amount: 100000,
      status: 'COMPLETED',
      creditCardInvoiceId: 'inv_nb_jan',
    })

    // Padded vs unpadded, case-insensitive/trim e isolamento de mês
    expect(isInvoicePaymentForCardPeriod(payPadded, nubank, 1, 2027)).toBe(true)
    expect(isInvoicePaymentForCardPeriod(payUnpadded, nubank, 1, 2027)).toBe(true)
    expect(isInvoicePaymentForCardPeriod(payCaseInsensitive, nubank, 1, 2027)).toBe(true)
    expect(isInvoicePaymentForCardPeriod(payPadded, nubank, 2, 2027)).toBe(false)

    // Colisão de prefixo (Nubank vs Nubank Black) em ambas as direções
    expect(isInvoicePaymentForCardPeriod(payBlack, nubank, 1, 2027)).toBe(false)
    expect(isInvoicePaymentForCardPeriod(payPadded, nubankBlack, 1, 2027)).toBe(false)
    expect(isInvoicePaymentForCardPeriod(payBlack, nubankBlack, 1, 2027)).toBe(true)

    // Pagamento PENDING é ignorado
    expect(isInvoicePaymentForCardPeriod(payPending, nubank, 1, 2027)).toBe(false)

    // Vinculação explícita por creditCardInvoiceId
    expect(isInvoicePaymentForCardPeriod(payWithId, nubank, 1, 2027, 'inv_nb_jan')).toBe(true)
    expect(isInvoicePaymentForCardPeriod(payWithId, nubank, 1, 2027, 'inv_nb_feb')).toBe(false)

    // Integração no fallback analítico: pagamento parcial só no mês alvo, PENDING ignorado e estorno INCOME
    const account = makeAccount({ balance: 300000 }) // R$ 3.000,00
    const janPurchase = makeTx({
      id: 'tx_nb_jan',
      amount: 270000, // R$ 2.700,00
      date: '2026-11-26T12:00:00Z', // vence em 01/2027
      creditCardId: nubank.id,
      type: 'EXPENSE',
    })
    const janRefund = makeTx({
      id: 'tx_nb_refund',
      title: 'Estorno Loja',
      amount: 40000, // -R$ 400,00 na fatura de 01/2027
      date: '2026-11-28T12:00:00Z',
      creditCardId: nubank.id,
      type: 'INCOME',
    })
    const febPurchase = makeTx({
      id: 'tx_nb_feb',
      amount: 50000, // R$ 500,00
      date: '2026-12-26T12:00:00Z', // vence em 02/2027
      creditCardId: nubank.id,
      type: 'EXPENSE',
    })
    const partialPayJan = makeTx({
      id: 'tx_nb_partial_jan',
      title: 'Pagamento fatura Nubank (01/2027)',
      amount: 100000, // R$ 1.000,00 pago em 28/12/2026 (sai do banco em Dez)
      date: '2026-12-28T12:00:00Z',
      type: 'EXPENSE',
      status: 'COMPLETED',
    })
    const pendingPayFeb = makeTx({
      id: 'tx_nb_pending_feb',
      title: 'Pagamento fatura Nubank (02/2027)',
      amount: 50000,
      date: '2027-01-20T12:00:00Z',
      type: 'EXPENSE',
      status: 'PENDING', // PENDING: não deve abater a fatura de Fev no fallback
    })
    const otherCardPay = makeTx({
      id: 'tx_nbb_pay_jan',
      title: 'Pagamento fatura Nubank Black (01/2027)',
      amount: 50000,
      date: '2026-12-29T12:00:00Z',
      type: 'EXPENSE',
      status: 'COMPLETED',
    })

    // Nota: otherCardPay sai do banco em Dez (500), partialPayJan sai do banco em Dez (1.000),
    // Jan remaining = (2.700 - 400 estorno) - 1.000 parcial = 1.300 (otherCardPay NÃO abate Nubank!).
    // Fev remaining = 500 (pendingPayFeb NÃO abate, e partialPayJan NÃO abate Fev!).
    // Mas pendingPayFeb (como transação bancária futura pendente em 20/01/2027) também sairia da conta em 20/01 se incluída;
    // para isolar apenas o abatimento da fatura de Fev, verificamos o valor apurado da fatura no dia 10/02/2027.
    const txs = [janPurchase, janRefund, febPurchase, partialPayJan, pendingPayFeb, otherCardPay]
    const emptyInvoices = [
      { card: nubank, invoice: {} as Partial<CreditCardInvoice>, month: 11, year: 2026 },
      { card: nubank, invoice: {} as Partial<CreditCardInvoice>, month: 12, year: 2026 },
      { card: nubank, invoice: {} as Partial<CreditCardInvoice>, month: 1, year: 2027 },
      { card: nubank, invoice: {} as Partial<CreditCardInvoice>, month: 2, year: 2027 },
    ]

    const projJan = buildCalendarProjection(
      [account],
      txs,
      emptyInvoices,
      { month: 1, year: 2027 },
      undefined,
      txs,
      [],
      [nubank],
      FIXED_TODAY,
    )
    const day10Jan = projJan.days.find((d) => d.day === 10)!
    expect(day10Jan.invoices).toHaveLength(1)
    expect(day10Jan.invoices[0].remainingAmount).toBe(130000)

    const projFev = buildCalendarProjection(
      [account],
      txs,
      emptyInvoices,
      { month: 2, year: 2027 },
      undefined,
      txs,
      [],
      [nubank],
      FIXED_TODAY,
    )
    const day10Fev = projFev.days.find((d) => d.day === 10)!
    expect(day10Fev.invoices).toHaveLength(1)
    expect(day10Fev.invoices[0].remainingAmount).toBe(50000)

    // Estorno maior que compras não gera fatura negativa (clamp em 0)
    const refundLargerThanPurchases = [
      makeTx({ id: 'tx_small', amount: 20000, date: '2026-11-26T12:00:00Z', creditCardId: nubank.id, type: 'EXPENSE' }),
      makeTx({ id: 'tx_big_ref', amount: 50000, date: '2026-11-27T12:00:00Z', creditCardId: nubank.id, type: 'INCOME' }),
    ]
    const projClamp = buildCalendarProjection(
      [account],
      refundLargerThanPurchases,
      emptyInvoices,
      { month: 1, year: 2027 },
      undefined,
      refundLargerThanPurchases,
      [],
      [nubank],
      FIXED_TODAY,
    )
    expect(projClamp.days.find((d) => d.day === 10)!.invoices).toHaveLength(0)
    expect(projClamp.closing).toBe(300000)
  })

  it('15. Regra unificada dueDay < closingDay (25/10), dueDay > closingDay (5/10) e dueDay === closingDay (10/10) em todos os helpers e relatórios', () => {
    // a) getInvoiceForCardPurchase
    // 25/10 (dueDay < closingDay)
    expect(getInvoiceForCardPurchase(2026, 11, 20, 25, 10)).toEqual({
      invMonth: 12,
      invYear: 2026,
      dueIso: '2026-12-10',
      dueDay: 10,
    })
    expect(getInvoiceForCardPurchase(2026, 11, 25, 25, 10)).toEqual({
      invMonth: 1,
      invYear: 2027,
      dueIso: '2027-01-10',
      dueDay: 10,
    })
    expect(getInvoiceForCardPurchase(2026, 11, 26, 25, 10)).toEqual({
      invMonth: 1,
      invYear: 2027,
      dueIso: '2027-01-10',
      dueDay: 10,
    })
    // 5/10 (dueDay > closingDay)
    expect(getInvoiceForCardPurchase(2026, 11, 4, 5, 10)).toEqual({
      invMonth: 11,
      invYear: 2026,
      dueIso: '2026-11-10',
      dueDay: 10,
    })
    expect(getInvoiceForCardPurchase(2026, 11, 5, 5, 10)).toEqual({
      invMonth: 12,
      invYear: 2026,
      dueIso: '2026-12-10',
      dueDay: 10,
    })
    // 10/10 (dueDay === closingDay)
    expect(getInvoiceForCardPurchase(2026, 11, 9, 10, 10)).toEqual({
      invMonth: 11,
      invYear: 2026,
      dueIso: '2026-11-10',
      dueDay: 10,
    })
    expect(getInvoiceForCardPurchase(2026, 11, 10, 10, 10)).toEqual({
      invMonth: 12,
      invYear: 2026,
      dueIso: '2026-12-10',
      dueDay: 10,
    })
    // Clamping de dueDay 31 em fevereiro
    expect(getInvoiceForCardPurchase(2027, 2, 1, 5, 31)).toEqual({
      invMonth: 2,
      invYear: 2027,
      dueIso: '2027-02-28',
      dueDay: 28,
    })

    // b) resolveTransactionInvoicePeriod
    const card25_10 = makeCreditCard({ id: 'c_25_10', closingDay: 25, dueDay: 10 })
    const card5_10 = makeCreditCard({ id: 'c_5_10', closingDay: 5, dueDay: 10 })
    const card10_10 = makeCreditCard({ id: 'c_10_10', closingDay: 10, dueDay: 10 })
    const cardsMap = new Map<string, CreditCard>([
      [card25_10.id, card25_10],
      [card5_10.id, card5_10],
      [card10_10.id, card10_10],
    ])

    expect(
      resolveTransactionInvoicePeriod(
        makeTx({ date: '2026-11-26T12:00:00Z', creditCardId: card25_10.id }),
        cardsMap,
      ),
    ).toEqual({ month: 1, year: 2027 })
    expect(
      resolveTransactionInvoicePeriod(
        makeTx({ date: '2026-11-26T12:00:00Z', creditCardId: card25_10.id, invoiceMonth: 3, invoiceYear: 2027 }),
        cardsMap,
      ),
    ).toEqual({ month: 3, year: 2027 })

    // c) expandSimulationsForMonth (assinatura recorrente no cartão) - simetria absoluta entre effectiveDebitDate e débito
    const sub25_10_after: SimulatedTransaction = {
      id: 'sub_25_10_after',
      title: 'Assinatura Corte 25',
      amount: 10000,
      type: 'EXPENSE',
      date: '2026-11-26T00:00:00Z',
      creditCardId: card25_10.id,
      sourceMode: 'CARD',
      isRecurring: true,
      recurrenceFrequency: 'MONTHLY',
      isInfinite: true,
    }
    const sub25_10_before: SimulatedTransaction = {
      ...sub25_10_after,
      id: 'sub_25_10_before',
      date: '2026-11-15T00:00:00Z',
    }
    const sub5_10: SimulatedTransaction = {
      ...sub25_10_after,
      id: 'sub_5_10',
      date: '2026-11-06T00:00:00Z',
      creditCardId: card5_10.id,
    }
    const sub10_10: SimulatedTransaction = {
      ...sub25_10_after,
      id: 'sub_10_10',
      date: '2026-11-08T00:00:00Z',
      creditCardId: card10_10.id,
    }

    // Compra recorrente em 26/11 (25/10) tem effectiveDebitDate = 2027-01-10 e debita exatamente em 2027-01-10
    const novExpanded = expandSimulationsForMonth([sub25_10_after], 11, 2026, cardsMap)
    expect((novExpanded.get('2026-11-26')![0] as DaySimulationItem).effectiveDebitDate).toBe('2027-01-10')
    expect(expandSimulationsForMonth([sub25_10_after], 12, 2026, cardsMap).get('2026-12-10')).toBeUndefined()
    const janDebits = expandSimulationsForMonth([sub25_10_after], 1, 2027, cardsMap).get('2027-01-10')!
    expect(janDebits.some((s) => s.isCardInvoiceDebitDay)).toBe(true)

    // Compra recorrente em 15/11 (25/10) tem effectiveDebitDate = 2026-12-10 e debita em 2026-12-10
    const novBefore = expandSimulationsForMonth([sub25_10_before], 11, 2026, cardsMap)
    expect((novBefore.get('2026-11-15')![0] as DaySimulationItem).effectiveDebitDate).toBe('2026-12-10')
    expect(
      expandSimulationsForMonth([sub25_10_before], 12, 2026, cardsMap)
        .get('2026-12-10')!
        .some((s) => s.isCardInvoiceDebitDay),
    ).toBe(true)

    // 5/10 (dia 6 >= 5 -> próximo mês dia 10) e 10/10 (dia 8 < 10 -> mesmo mês dia 10)
    expect((expandSimulationsForMonth([sub5_10], 11, 2026, cardsMap).get('2026-11-06')![0] as DaySimulationItem).effectiveDebitDate).toBe('2026-12-10')
    expect(
      expandSimulationsForMonth([sub5_10], 12, 2026, cardsMap)
        .get('2026-12-10')!
        .some((s) => s.isCardInvoiceDebitDay),
    ).toBe(true)
    expect((expandSimulationsForMonth([sub10_10], 11, 2026, cardsMap).get('2026-11-08')![0] as DaySimulationItem).effectiveDebitDate).toBe('2026-11-10')
    expect(
      expandSimulationsForMonth([sub10_10], 11, 2026, cardsMap)
        .get('2026-11-10')!
        .some((s) => s.isCardInvoiceDebitDay),
    ).toBe(true)

    // d) buildFutureCommitments
    const commitmentTxs = [
      makeTx({ id: 'fc_1', amount: 11000, date: '2026-11-26T12:00:00Z', creditCardId: card25_10.id }), // -> 01/2027
      makeTx({ id: 'fc_2', amount: 22000, date: '2026-11-06T12:00:00Z', creditCardId: card5_10.id }),  // -> 12/2026
      makeTx({ id: 'fc_3', amount: 33000, date: '2026-11-10T12:00:00Z', creditCardId: card10_10.id }), // -> 12/2026
    ]
    const commitments = buildFutureCommitments(
      commitmentTxs,
      [card25_10, card5_10, card10_10],
      { month: 11, year: 2026 },
      false,
    )
    expect(commitments[0]).toMatchObject({ month: 12, year: 2026, cardCommitted: 55000 })
    expect(commitments[1]).toMatchObject({ month: 1, year: 2027, cardCommitted: 11000 })

    // e) calculateFinancialPlanning (fixos e variáveis com 25/10, 5/10 e 10/10)
    const opAccount = makeAccount({ id: 'acc_op', balance: 100000 })
    const savAccount = makeAccount({ id: 'acc_sav', type: 'SAVINGS', balance: 500000 })
    const planningTxs = [
      // Fixo em 01/2027 via card25_10 (compra 26/11)
      makeTx({ id: 'fp_fixed_1', amount: 40000, date: '2026-11-26T12:00:00Z', creditCardId: card25_10.id, isInfinite: true }),
      // Variável em 12/2026 via card5_10 (compra 06/11) e card10_10 (compra 10/11)
      makeTx({ id: 'fp_var_1', amount: 20000, date: '2026-11-06T12:00:00Z', creditCardId: card5_10.id, isInfinite: false }),
      makeTx({ id: 'fp_var_2', amount: 30000, date: '2026-11-10T12:00:00Z', creditCardId: card10_10.id, isInfinite: false }),
    ]
    const planning = calculateFinancialPlanning(
      planningTxs,
      [card25_10, card5_10, card10_10],
      [opAccount],
      [savAccount],
      [],
      { month: 1, year: 2027 },
      6,
    )
    expect(planning.fixedMonthlyCost).toBe(40000)
    expect(planning.variableMonthlyAverage).toBe(50000)
    expect(planning.averageMonthlyCost).toBe(90000)
  })

  it('16. getRequiredInvoicePeriods: passado, corrente, virada de ano e limite defensivo MAX_CASCADE_INVOICE_MONTHS', () => {
    expect(MAX_CASCADE_INVOICE_MONTHS).toBe(60)

    // Passado
    expect(getRequiredInvoicePeriods(11, 2026, { month: 10, year: 2026 })).toEqual([
      { month: 10, year: 2026 },
    ])

    // Corrente
    expect(getRequiredInvoicePeriods(11, 2026, { month: 11, year: 2026 })).toEqual([
      { month: 11, year: 2026 },
    ])

    // Virada de ano
    expect(getRequiredInvoicePeriods(11, 2026, { month: 2, year: 2027 })).toEqual([
      { month: 11, year: 2026 },
      { month: 12, year: 2026 },
      { month: 1, year: 2027 },
      { month: 2, year: 2027 },
    ])

    // Exatamente no limite de 60 meses (11/2026 -> 11/2031): 61 períodos sem duplicata
    const exactLimit = getRequiredInvoicePeriods(11, 2026, { month: 11, year: 2031 })
    expect(exactLimit).toHaveLength(61)
    expect(exactLimit[0]).toEqual({ month: 11, year: 2026 })
    expect(exactLimit[exactLimit.length - 1]).toEqual({ month: 11, year: 2031 })

    // Acima do limite (65 meses: 11/2026 -> 04/2032): 61 meses da janela + targetPeriod ao final
    const overLimit = getRequiredInvoicePeriods(11, 2026, { month: 4, year: 2032 })
    expect(overLimit).toHaveLength(62)
    expect(overLimit[0]).toEqual({ month: 11, year: 2026 })
    expect(overLimit[60]).toEqual({ month: 11, year: 2031 })
    expect(overLimit[61]).toEqual({ month: 4, year: 2032 })
  })

  it('17. buildProjectionInvoiceList: mapeia múltiplos cartões/períodos, trata respostas undefined e prioriza mês/ano retornados pela API', () => {
    const cardA = makeCreditCard({ id: 'card_a', name: 'Card A' })
    const cardB = makeCreditCard({ id: 'card_b', name: 'Card B' })

    const invAJan = makeInvoice(cardA, 1, 2027, 125000).invoice as CreditCardInvoice
    const invPartialMonthMissing = {
      ...(makeInvoice(cardB, 2, 2027, 45000).invoice as CreditCardInvoice),
      month: undefined as unknown as number,
      year: undefined as unknown as number,
    }

    const targets = [
      { card: cardA, month: 1, year: 2027 },
      { card: cardA, month: 2, year: 2027 },
      { card: cardB, month: 1, year: 2027 },
      { card: cardB, month: 2, year: 2027 },
    ]

    const list = buildProjectionInvoiceList(targets, [
      invAJan,
      undefined,
      undefined,
      invPartialMonthMissing,
    ])

    expect(list).toHaveLength(4)
    expect(list[0]).toEqual({
      card: cardA,
      invoice: invAJan,
      month: 1,
      year: 2027,
    })
    expect(list[1]).toEqual({
      card: cardA,
      invoice: {},
      month: 2,
      year: 2027,
    })
    expect(list[2]).toEqual({
      card: cardB,
      invoice: {},
      month: 1,
      year: 2027,
    })
    expect(list[3]).toEqual({
      card: cardB,
      invoice: invPartialMonthMissing,
      month: 2,
      year: 2027,
    })
  })

  it('18. Bordas adicionais: anos distintos em isInvoicePaymentForCardPeriod, matchedInvoiceId com título customizado, overpayment no fallback, clamping dueDay 31 em Fevereiro e accountIdFilter', () => {
    // a) isInvoicePaymentForCardPeriod em anos distintos e matchedInvoiceId com título customizado
    const card = makeCreditCard({ id: 'card_edge', name: 'Nubank', closingDay: 25, dueDay: 10 })
    const payJan2026 = makeTx({
      title: 'Pagamento fatura Nubank (01/2026)',
      amount: 50000,
      status: 'COMPLETED',
      type: 'EXPENSE',
    })
    expect(isInvoicePaymentForCardPeriod(payJan2026, card, 1, 2026)).toBe(true)
    expect(isInvoicePaymentForCardPeriod(payJan2026, card, 1, 2027)).toBe(false)

    const customTitlePayment = makeTx({
      title: 'Acerto manual de fatura',
      amount: 50000,
      status: 'COMPLETED',
      type: 'EXPENSE',
      creditCardInvoiceId: 'inv_custom_jan',
    })
    expect(isInvoicePaymentForCardPeriod(customTitlePayment, card, 1, 2027, 'inv_custom_jan')).toBe(true)
    expect(isInvoicePaymentForCardPeriod(customTitlePayment, card, 1, 2027, 'inv_custom_other')).toBe(false)

    // Meses inválidos (00/2027, 13/2027) e compra no cartão com título de pagamento são rejeitados
    const invalidMonthPay = makeTx({
      title: 'Pagamento fatura Nubank (13/2027)',
      amount: 50000,
      status: 'COMPLETED',
      type: 'EXPENSE',
    })
    expect(isInvoicePaymentForCardPeriod(invalidMonthPay, card, 13, 2027)).toBe(false)
    expect(isInvoicePaymentForCardPeriod(payJan2026, card, 0, 2026)).toBe(false)

    const cardPurchaseWithPayTitle = makeTx({
      id: 'tx_card_pay_title',
      title: 'Pagamento fatura Nubank (01/2027)',
      amount: 35000,
      date: '2026-11-26T12:00:00Z',
      creditCardId: card.id,
      status: 'COMPLETED',
      type: 'EXPENSE',
    })
    expect(isInvoicePaymentForCardPeriod(cardPurchaseWithPayTitle, card, 1, 2027)).toBe(false)

    const cardTitleAccount = makeAccount({ id: 'acc_card_title', balance: 100000 })
    const projCardTitlePurchase = buildCalendarProjection(
      [cardTitleAccount],
      [cardPurchaseWithPayTitle],
      [{ card, invoice: {} as Partial<CreditCardInvoice>, month: 1, year: 2027 }],
      { month: 1, year: 2027 },
      undefined,
      [cardPurchaseWithPayTitle],
      [],
      [card],
      FIXED_TODAY,
    )
    expect(projCardTitlePurchase.days.find((d) => d.day === 10)!.invoices[0].remainingAmount).toBe(35000)
    expect(projCardTitlePurchase.closing).toBe(65000)

    // b) Overpayment no fallback (pagamento maior que compras clampado em 0, sem crédito fantasma)
    const account = makeAccount({ id: 'acc_over', balance: 150000 }) // R$ 1.500,00 em 11/11 após pagamento antecipado em 10/11
    const smallPurchase = makeTx({
      id: 'tx_small_buy',
      amount: 20000, // R$ 200,00 na fatura 01/2027
      date: '2026-11-26T12:00:00Z',
      creditCardId: card.id,
      accountId: account.id,
      type: 'EXPENSE',
    })
    const overPayment = makeTx({
      id: 'tx_over_pay',
      title: 'Pagamento fatura Nubank (01/2027)',
      amount: 50000, // R$ 500,00 já pagos em 10/11/2026
      date: '2026-11-10T12:00:00Z',
      accountId: account.id,
      type: 'EXPENSE',
      status: 'COMPLETED',
    })
    const overInvoices = [
      { card, invoice: {} as Partial<CreditCardInvoice>, month: 11, year: 2026 },
      { card, invoice: {} as Partial<CreditCardInvoice>, month: 12, year: 2026 },
      { card, invoice: {} as Partial<CreditCardInvoice>, month: 1, year: 2027 },
    ]
    const projOverJan = buildCalendarProjection(
      [account],
      [smallPurchase, overPayment],
      overInvoices,
      { month: 1, year: 2027 },
      undefined,
      [smallPurchase, overPayment],
      [],
      [card],
      FIXED_TODAY,
    )
    // Não deve gerar fatura negativa nem devolver +R$ 300,00 no dia 10/01; saldo permanece 1.500,00
    expect(projOverJan.days.find((d) => d.day === 10)!.invoices).toHaveLength(0)
    expect(projOverJan.closing).toBe(150000)

    // c) Clamping de dueDay: 31 em Fevereiro (2027 -> dia 28; 2028 bissexto -> dia 29)
    expect(getInvoiceForCardPurchase(2027, 2, 1, 5, 31)).toEqual({
      invMonth: 2,
      invYear: 2027,
      dueIso: '2027-02-28',
      dueDay: 28,
    })
    expect(getInvoiceForCardPurchase(2028, 2, 1, 5, 31)).toEqual({
      invMonth: 2,
      invYear: 2028,
      dueIso: '2028-02-29',
      dueDay: 29,
    })

    const clampAccount = makeAccount({ id: 'acc_clamp', balance: 200000 })
    const cardDue31 = makeCreditCard({ id: 'card_31', accountId: clampAccount.id, closingDay: 25, dueDay: 31 })
    const feb2027Buy = makeTx({
      id: 'tx_feb_31',
      amount: 30000,
      date: '2027-01-26T12:00:00Z', // 25/31 (dueDay > closingDay): compra após corte 25/01 => vence em 02/2027 (clamp para dia 28)
      creditCardId: cardDue31.id,
      accountId: clampAccount.id,
      type: 'EXPENSE',
    })
    const febClampInvoices = [
      { card: cardDue31, invoice: {} as Partial<CreditCardInvoice>, month: 11, year: 2026 },
      { card: cardDue31, invoice: {} as Partial<CreditCardInvoice>, month: 12, year: 2026 },
      { card: cardDue31, invoice: {} as Partial<CreditCardInvoice>, month: 1, year: 2027 },
      { card: cardDue31, invoice: {} as Partial<CreditCardInvoice>, month: 2, year: 2027 },
    ]
    const projFebClamp = buildCalendarProjection(
      [clampAccount],
      [feb2027Buy],
      febClampInvoices,
      { month: 2, year: 2027 },
      undefined,
      [feb2027Buy],
      [],
      [cardDue31],
      FIXED_TODAY,
    )
    const day28Feb = projFebClamp.days.find((d) => d.day === 28)!
    expect(day28Feb.invoices).toHaveLength(1)
    expect(day28Feb.invoices[0].remainingAmount).toBe(30000)
    expect(projFebClamp.closing).toBe(170000)

    // d) Isolamento estrito por accountIdFilter
    const acc1 = makeAccount({ id: 'acc_1', name: 'Conta 1', balance: 100000 })
    const acc2 = makeAccount({ id: 'acc_2', name: 'Conta 2', balance: 500000 })
    const card1 = makeCreditCard({ id: 'card_acc1', name: 'Card 1', accountId: acc1.id, closingDay: 25, dueDay: 10 })
    const card2 = makeCreditCard({ id: 'card_acc2', name: 'Card 2', accountId: acc2.id, closingDay: 25, dueDay: 10 })

    const txAcc1Pending = makeTx({
      id: 'tx_acc1_pend',
      amount: 20000,
      date: '2026-12-15T12:00:00Z',
      accountId: acc1.id,
      status: 'PENDING',
      type: 'EXPENSE',
    })
    const txAcc2Pending = makeTx({
      id: 'tx_acc2_pend',
      amount: 150000,
      date: '2026-12-15T12:00:00Z',
      accountId: acc2.id,
      status: 'PENDING',
      type: 'EXPENSE',
    })
    const invListMulti = [
      makeInvoice(card1, 11, 2026, 0),
      makeInvoice(card1, 12, 2026, 30000, { dueDate: '2026-12-10T00:00:00Z' }),
      makeInvoice(card2, 11, 2026, 0),
      makeInvoice(card2, 12, 2026, 90000, { dueDate: '2026-12-10T00:00:00Z' }),
    ]

    const projFilteredAcc1 = buildCalendarProjection(
      [acc1, acc2],
      [txAcc1Pending, txAcc2Pending],
      invListMulti,
      { month: 12, year: 2026 },
      'acc_1',
      [txAcc1Pending, txAcc2Pending],
      [],
      [card1, card2],
      FIXED_TODAY,
    )
    expect(projFilteredAcc1.opening).toBe(100000)
    const day10Acc1 = projFilteredAcc1.days.find((d) => d.day === 10)!
    expect(day10Acc1.invoices).toHaveLength(1)
    expect(day10Acc1.invoices[0].cardId).toBe(card1.id)
    // 1.000 (acc_1) - 300 (card_1) - 200 (tx_acc1_pend) = 500 (acc_2 e card_2 ignorados)
    expect(projFilteredAcc1.closing).toBe(50000)
  })

  it('19. getMergedRequiredInvoicePeriods e independência entre mês do relatório geral e mês do calendário', () => {
    // Relatório geral em Nov/2026 e calendário avançado para Dez/2026 -> união deduplicada [11/2026, 12/2026]
    expect(
      getMergedRequiredInvoicePeriods(11, 2026, [
        { month: 11, year: 2026 },
        { month: 12, year: 2026 },
      ]),
    ).toEqual([
      { month: 11, year: 2026 },
      { month: 12, year: 2026 },
    ])

    // Relatório geral no passado (Out/2026) e calendário em Jan/2027 -> inclui Out/2026 e toda a cascata Nov..Jan
    expect(
      getMergedRequiredInvoicePeriods(11, 2026, [
        { month: 10, year: 2026 },
        { month: 1, year: 2027 },
      ]),
    ).toEqual([
      { month: 10, year: 2026 },
      { month: 11, year: 2026 },
      { month: 12, year: 2026 },
      { month: 1, year: 2027 },
    ])

    // Meses iguais não geram duplicatas
    expect(
      getMergedRequiredInvoicePeriods(11, 2026, [
        { month: 1, year: 2027 },
        { month: 1, year: 2027 },
      ]),
    ).toEqual([
      { month: 11, year: 2026 },
      { month: 12, year: 2026 },
      { month: 1, year: 2027 },
    ])

    // Projeções independentes mantêm relatório em Nov/2026 enquanto calendário avança para Dez/2026
    const account = makeAccount({ balance: 150000 })
    const card = makeCreditCard({ accountId: account.id, closingDay: 25, dueDay: 10 })
    const apiInvoices = new Map<string, CreditCardInvoice>([
      ['11/2026', makeInvoice(card, 11, 2026, 20000, { dueDate: '2026-11-10T00:00:00Z' }).invoice as CreditCardInvoice],
      ['12/2026', makeInvoice(card, 12, 2026, 50000, { dueDate: '2026-12-10T00:00:00Z' }).invoice as CreditCardInvoice],
    ])
    const periods = getMergedRequiredInvoicePeriods(11, 2026, [
      { month: 11, year: 2026 },
      { month: 12, year: 2026 },
    ])
    const targets = periods.map((p) => ({ card, month: p.month, year: p.year }))
    const invoiceList = buildProjectionInvoiceList(
      targets,
      targets.map((t) => apiInvoices.get(`${t.month}/${t.year}`)),
    )

    const reportProjNov = buildCalendarProjection(
      [account],
      [],
      invoiceList,
      { month: 11, year: 2026 },
      undefined,
      [],
      [],
      [card],
      FIXED_TODAY,
    )
    const calendarProjDez = buildCalendarProjection(
      [account],
      [],
      invoiceList,
      { month: 12, year: 2026 },
      undefined,
      [],
      [],
      [card],
      FIXED_TODAY,
    )

    // Nov fecha descontando apenas a fatura vencida de Nov (1500 - 200 = 1300)
    expect(reportProjNov.closing).toBe(130000)
    // Dez abre com 1300 (closing de Nov) e fecha descontando a fatura de Dez (1300 - 500 = 800)
    expect(calendarProjDez.opening).toBe(130000)
    expect(calendarProjDez.closing).toBe(80000)
  })
})
