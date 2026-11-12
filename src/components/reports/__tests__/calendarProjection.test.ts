import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  buildCalendarProjection,
  simulateMonthDays,
} from '../useReportsData'
import type {
  Account,
  CreditCard,
  CreditCardInvoice,
  Transaction,
} from '@/lib/types'
import type { ReportPeriod, SimulatedTransaction } from '../types'

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

  it('8. Simulação de Cartão Parcela Única: Impacta no dia do vencimento da fatura correspondente', () => {
    const account = makeAccount({ balance: 500000 }) // R$ 5.000,00
    // Cartão fecha dia 25 e vence dia 10
    const card = makeCreditCard({ accountId: account.id, closingDay: 25, dueDay: 10 })

    // Compra no dia 20/11/2026 (antes do fechamento 25): entra na fatura de Nov/2026 com vencimento 10/11 ou 10/12?
    // Se a compra é 20/11, ela entra na fatura de 11/2026 que vence dia 10/11 (já passou) ou 12/2026?
    // Pela regra de fechamento:
    // compra dia 20 com closing 25 => fatura do mês 11 (ano 2026), com vencimento dia 10/11.
    // Compra dia 26/11 com closing 25 => fatura do mês 12 (ano 2026), com vencimento 10/12.
    const cardSim: SimulatedTransaction = {
      id: 'sim_card_single',
      title: 'Restaurante Fim de Semana',
      amount: 25000, // R$ 250,00
      type: 'EXPENSE',
      date: '2026-11-26T12:00:00Z',
      creditCardId: card.id,
      sourceMode: 'CARD',
      cardName: card.name,
      accountId: account.id,
    }

    const invoiceList = [
      makeInvoice(card, 11, 2026, 0),
      makeInvoice(card, 12, 2026, 0),
    ]

    // Novembro: a compra foi dia 26. No dia 26 aparece como compra de cartão,
    // mas o débito bancário NÃO acontece no dia 26 (fechamento é 25, vai para fatura 12 com vencimento 10/12).
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

    const day26Nov = projNov.days.find((d) => d.day === 26)!
    expect(day26Nov.simulations).toBeDefined()
    expect(day26Nov.simulations!.length).toBe(1)
    // O saldo de encerramento de Novembro NÃO sofreu o débito bancário de R$ 250
    expect(projNov.closing).toBe(500000)

    // Dezembro: vence no dia 10/12. O débito bancário ocorre no dia 10/12!
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

    expect(projDez.opening).toBe(500000)
    const day10Dez = projDez.days.find((d) => d.day === 10)!
    expect(day10Dez.simulations).toBeDefined()
    expect(day10Dez.simulations!.length).toBe(1)
    // Fechamento de Dezembro debita os 250
    expect(projDez.closing).toBe(500000 - 25000)
  })

  it('9. Simulação de Cartão Parcelado: Distribui N parcelas nas faturas seguintes com rigor contábil', () => {
    const account = makeAccount({ balance: 300000 }) // R$ 3.000,00
    const card = makeCreditCard({ accountId: account.id, closingDay: 25, dueDay: 10 })

    // Compra de Smartphone em 3x de R$ 100,00 no dia 15/11/2026 (antes do fechamento 25)
    // 1ª parcela: fatura de Nov (se 15 < 25 => fatura 11/2026) -> ou fatura 12?
    // Vamos testar: compra dia 26/11 => 1ª parcela fatura 12 (10/12), 2ª fatura 01 (10/01), 3ª fatura 02 (10/02)
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
    ]

    // Dezembro 2026: parcela 1/3 debita no dia 10
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
    expect(projDez.closing).toBe(290000)

    // Janeiro 2027: parcela 2/3 debita no dia 10
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
    expect(projJan.opening).toBe(290000)
    expect(projJan.closing).toBe(280000)

    // Fevereiro 2027: parcela 3/3 debita no dia 10
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
    expect(projFev.opening).toBe(280000)
    expect(projFev.closing).toBe(270000)
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
})
