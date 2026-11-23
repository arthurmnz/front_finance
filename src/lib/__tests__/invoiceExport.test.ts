import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildInvoiceCsv,
  buildInvoiceFilename,
  buildInvoicePdfDocument,
  computeNetInvoiceAmountCents,
  exportInvoiceCsv,
  exportInvoicePdf,
  formatRecurrenceLabel,
  resolvePdfCategoryLabel,
  sanitizeCsvCell,
  signedInvoiceTransactionCents,
  slugifyCardName,
  stripEmojis,
} from '@/lib/invoiceExport'
import type { Category, CreditCard, CreditCardInvoice, Transaction, UserSummary } from '@/lib/types'

const userAna: UserSummary = {
  id: 'u_ana',
  firstName: 'Ana',
  lastName: 'Silva',
  email: 'ana.privado@example.com',
}

const userBruno: UserSummary = {
  id: 'u_bruno',
  firstName: 'Bruno',
  lastName: 'Costa',
  email: 'bruno.privado@example.com',
}

function makeCard(overrides: Partial<CreditCard> = {}): CreditCard {
  return {
    id: 'card_1',
    ownerId: userAna.id,
    owner: userAna,
    accountId: 'acc_1',
    name: 'Cartão Itaú Black 💳',
    limitAmount: 1000000,
    usedLimit: 325000,
    availableLimit: 675000,
    closingDay: 10,
    dueDay: 17,
    groupId: null,
    currentInvoiceMonth: 11,
    currentInvoiceYear: 2026,
    currentInvoiceAmount: 145000,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat_gen',
    name: 'Moradia',
    description: null,
    userId: userAna.id,
    groupId: null,
    type: 'EXPENSE',
    level: 'GENERAL',
    parentId: null,
    parent: null,
    isDefault: false,
    color: '#7D39EB',
    icon: '🏠',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx_${Math.random().toString(36).slice(2, 8)}`,
    title: 'Compra',
    amount: 10000,
    date: '2026-11-05T12:00:00Z',
    responsibleId: userAna.id,
    responsible: userAna,
    accountId: 'acc_1',
    type: 'EXPENSE',
    destinationAccountId: null,
    categoryId: null,
    status: 'COMPLETED',
    recurrenceGroupId: null,
    recurrenceFrequency: null,
    recurrenceInterval: null,
    isInfinite: false,
    creditCardId: 'card_1',
    createdAt: '2026-11-05T12:00:00Z',
    updatedAt: '2026-11-05T12:00:00Z',
    ...overrides,
  }
}

function makeInvoice(overrides: Partial<CreditCardInvoice> = {}): CreditCardInvoice {
  return {
    creditCardId: 'card_1',
    month: 11,
    year: 2026,
    closingDate: '2026-11-10',
    dueDate: '2026-11-17',
    purchasesAmount: 145000,
    carriedOverAmount: 20000,
    revolvingInterestAmount: 1500,
    totalAmount: 166500,
    paidAmount: 50000,
    remainingAmount: 116500,
    status: 'PARTIALLY_PAID',
    transactions: [],
    byResponsible: [],
    payments: [],
    ...overrides,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Exportação de Fatura CSV e PDF (src/lib/invoiceExport.ts)', () => {
  const genMoradia = makeCategory({ id: 'gen_moradia', name: '🏠 Moradia', icon: '🏠' })
  const specEnergia = makeCategory({
    id: 'spec_energia',
    name: '⚡ Energia',
    icon: '⚡',
    level: 'SPECIFIC',
    parentId: 'gen_moradia',
  })
  const genAlimentacao = makeCategory({ id: 'gen_alim', name: '🍽️ Alimentação', icon: '🍽️' })
  const categoryMap = new Map<string, Category>([
    [genMoradia.id, genMoradia],
    [specEnergia.id, specEnergia],
    [genAlimentacao.id, genAlimentacao],
  ])
  const accountNames = new Map<string, string>([
    ['acc_1', 'Nubank Conta'],
    ['acc_2', 'Conta Casa (Conjunta)'],
  ])

  it('gera CSV com BOM UTF-8, cabeçalho da fatura, ordenação cronológica, recorrências, categorias e responsável sem vazar e-mail', () => {
    const txInstallment = makeTx({
      id: 'tx_3',
      title: 'Notebook Parcelado',
      amount: 100000,
      date: '2026-11-15T12:00:00Z',
      generalCategoryId: 'gen_moradia',
      specificCategoryId: 'spec_energia',
      categoryId: 'spec_energia',
      installmentNumber: 2,
      totalInstallments: 3,
      recurrenceGroupId: 'rec_inst',
      responsible: userBruno,
      responsibleId: userBruno.id,
      status: 'PENDING',
    })
    const txSubscription = makeTx({
      id: 'tx_1',
      title: 'Streaming Mensal',
      amount: 3990,
      date: '2026-11-02T10:00:00Z',
      generalCategoryId: 'gen_alim',
      categoryId: 'gen_alim',
      isInfinite: true,
      recurrenceFrequency: 'MONTHLY',
      recurrenceGroupId: 'rec_sub',
      responsible: userAna,
    })
    const txRecurring = makeTx({
      id: 'tx_2',
      title: 'Clube Recorrente',
      amount: 5000,
      date: '2026-11-08T10:00:00Z',
      recurrenceGroupId: 'rec_other',
      isInfinite: false,
      responsible: null,
    })
    const txSingle = makeTx({
      id: 'tx_4',
      title: 'Café da Manhã',
      amount: 2510,
      date: '2026-11-20T09:00:00Z',
      categoryId: null,
      responsible: userAna,
    })

    const invoice = makeInvoice({
      transactions: [txSingle, txInstallment, txSubscription, txRecurring],
    })

    const csv = buildInvoiceCsv({
      card: makeCard(),
      invoice,
      transactions: invoice.transactions,
      totalTransactionsCount: 4,
      categoryMap,
      accountNames,
    })

    expect(csv.startsWith('\uFEFF')).toBe(true)
    const clean = csv.slice(1)
    const lines = clean.split('\r\n')

    expect(lines[0]).toBe('Campo;Valor')
    expect(lines).toContain('Cartão;Cartão Itaú Black 💳')
    expect(lines).toContain('Fechamento;Dia 10 (10/11/2026)')
    expect(lines).toContain('Vencimento;Dia 17 (17/11/2026)')
    expect(clean).toContain('Período;11/2026 - ')
    expect(lines).toContain('Status;Paga parcialmente')
    expect(lines).toContain('Compras do mês (R$);1450,00')
    expect(lines).toContain('Saldo anterior rolado (R$);200,00')
    expect(lines).toContain('Juros do rotativo (R$);15,00')
    expect(lines).toContain('Total da fatura (R$);1665,00')
    expect(lines).toContain('Já pago (R$);500,00')
    expect(lines).toContain('Restante a pagar (R$);1165,00')
    expect(clean).not.toContain('Filtro aplicado')

    // Privacidade: e-mails não devem aparecer no CSV
    expect(clean).not.toContain(userAna.email)
    expect(clean).not.toContain(userBruno.email)

    const headerIdx = lines.indexOf(
      'Data;Descrição;Categoria Geral;Categoria Específica;Tipo;Parcela / Recorrência;Responsável;Status;Valor (R$)',
    )
    expect(headerIdx).toBeGreaterThan(-1)

    // Ordenação cronológica crescente: 02/11 -> 08/11 -> 15/11 -> 20/11
    expect(lines[headerIdx + 1]).toBe(
      '02/11/2026;Streaming Mensal;🍽️ Alimentação;—;Despesa;Assinatura (Mensal);Ana Silva;Concluído;39,90',
    )
    expect(lines[headerIdx + 2]).toBe(
      '08/11/2026;Clube Recorrente;Sem categoria;—;Despesa;Recorrente;—;Concluído;50,00',
    )
    expect(lines[headerIdx + 3]).toBe(
      '15/11/2026;Notebook Parcelado;🏠 Moradia;⚡ Energia;Despesa;2/3;Bruno Costa;Pendente;1000,00',
    )
    expect(lines[headerIdx + 4]).toBe(
      '20/11/2026;Café da Manhã;Sem categoria;—;Despesa;À vista;Ana Silva;Concluído;25,10',
    )

    expect(formatRecurrenceLabel(txInstallment)).toBe('2/3')
    expect(formatRecurrenceLabel(txSubscription)).toBe('Assinatura (Mensal)')
    expect(formatRecurrenceLabel(txRecurring)).toBe('Recorrente')
    expect(formatRecurrenceLabel(txSingle)).toBe('À vista')
  })

  it('neutraliza payloads de CSV/Formula Injection (CWE-1236) sem corromper valores monetários negativos legítimos', () => {
    expect(sanitizeCsvCell('=cmd|"/C calc"!A0', { text: true })).toBe('"\'=cmd|""/C calc""!A0"')
    expect(sanitizeCsvCell('  =1+1', { text: true })).toBe("'  =1+1")
    expect(sanitizeCsvCell('+123', { text: true })).toBe("'+123")
    expect(sanitizeCsvCell('@SUM(A1:A2)', { text: true })).toBe("'@SUM(A1:A2)")
    expect(sanitizeCsvCell('-cmd', { text: true })).toBe("'-cmd")
    expect(sanitizeCsvCell('-1+1')).toBe("'-1+1")
    expect(sanitizeCsvCell('  -cmd')).toBe("'  -cmd")
    expect(sanitizeCsvCell('\t=1+1', { text: true })).toBe("'\t=1+1")
    expect(sanitizeCsvCell('\r=1+1', { text: true })).toBe('"\'\r=1+1"')
    expect(sanitizeCsvCell('Loja; "Promoção"', { text: true })).toBe('"Loja; ""Promoção"""')
    expect(sanitizeCsvCell('-123', { text: true })).toBe("'-123")

    // Valores monetários negativos legítimos não devem receber apóstrofo
    expect(sanitizeCsvCell('-45,00')).toBe('-45,00')
    expect(sanitizeCsvCell('-1.234,56')).toBe('-1.234,56')
    expect(sanitizeCsvCell('-100')).toBe('-100')

    const maliciousTx = makeTx({ title: '=HYPERLINK("http://evil.com";"Clique")' })
    const csv = buildInvoiceCsv({
      card: makeCard({ name: '+CardEvil' }),
      invoice: makeInvoice({ transactions: [maliciousTx] }),
      transactions: [maliciousTx],
      categoryMap,
    })

    expect(csv).toContain("Cartão;'+CardEvil")
    expect(csv).toContain('"\'=HYPERLINK(""http://evil.com"";""Clique"")"')
  })

  it('preserva sinal negativo para INCOME no cálculo líquido e registra filtros aplicados no CSV', () => {
    const expenseTx = makeTx({ id: 'e1', title: 'Restaurante', amount: 12000, type: 'EXPENSE', date: '2026-11-05' })
    const refundTx = makeTx({ id: 'i1', title: 'Estorno Restaurante', amount: 4500, type: 'INCOME', date: '2026-11-06' })

    expect(signedInvoiceTransactionCents(expenseTx)).toBe(12000)
    expect(signedInvoiceTransactionCents(refundTx)).toBe(-4500)
    expect(computeNetInvoiceAmountCents([expenseTx, refundTx])).toBe(7500)
    expect(computeNetInvoiceAmountCents([refundTx])).toBe(-4500)

    const csv = buildInvoiceCsv({
      card: makeCard(),
      invoice: makeInvoice({ purchasesAmount: 7500, totalAmount: 7500, remainingAmount: 7500 }),
      transactions: [refundTx],
      totalTransactionsCount: 2,
      filters: { activeCount: 1, search: 'Estorno' },
      categoryMap,
    })

    expect(csv).toContain('Filtro aplicado;"Exibindo 1 de 2 lançamento(s) (1 filtro(s) ativo(s); busca: ""Estorno"")"')
    expect(csv).toContain('Total líquido filtrado (R$);-45,00')
    expect(csv).toContain('06/11/2026;Estorno Restaurante;Sem categoria;—;Receita;À vista;Ana Silva;Concluído;-45,00')
  })

  it('inclui seções Gastos por responsável e Pagamentos efetuados quando presentes e omite quando vazias', () => {
    const payment = makeTx({
      id: 'pay_1',
      title: 'Pagamento fatura Cartão Itaú (11/2026)',
      amount: 50000,
      date: '2026-11-12',
      accountId: 'acc_2',
      type: 'EXPENSE',
      creditCardId: null,
      creditCardInvoiceId: 'inv_1',
      responsible: userBruno,
    })

    const csvWithSections = buildInvoiceCsv({
      card: makeCard(),
      invoice: makeInvoice({
        byResponsible: [
          { user: userAna, amount: 95000 },
          { user: userBruno, amount: 50000 },
        ],
        payments: [payment],
      }),
      transactions: [],
      categoryMap,
      accountNames,
    })

    expect(csvWithSections).toContain('Gastos por responsável\r\nResponsável;Valor (R$)\r\nAna Silva;950,00\r\nBruno Costa;500,00')
    expect(csvWithSections).toContain(
      'Pagamentos efetuados\r\nData;Descrição;Conta;Responsável;Valor (R$)\r\n12/11/2026;Pagamento fatura Cartão Itaú (11/2026);Conta Casa (Conjunta);Bruno Costa;500,00',
    )
    expect(csvWithSections).not.toContain(userAna.email)
    expect(csvWithSections).not.toContain(userBruno.email)

    const csvWithoutSections = buildInvoiceCsv({
      card: makeCard(),
      invoice: makeInvoice({ byResponsible: [], payments: [] }),
      transactions: [],
      categoryMap,
      accountNames,
    })

    expect(csvWithoutSections).not.toContain('Gastos por responsável')
    expect(csvWithoutSections).not.toContain('Pagamentos efetuados')
  })

  it('sanitiza nome de arquivo e executa exportInvoiceCsv com cleanup de ObjectURL', () => {
    expect(slugifyCardName('Cartão Itaú Black 💳 /../../etc/passwd')).toBe('cartao-itau-black-etc-passwd')
    expect(slugifyCardName('💳✨')).toBe('cartao')
    expect(buildInvoiceFilename('Nubank UltraVioleta', 2026, 3, 'csv')).toBe('fatura-nubank-ultravioleta-2026-03.csv')
    expect(buildInvoiceFilename('Cartão Crédito', 2026, 12, 'pdf')).toBe('fatura-cartao-credito-2026-12.pdf')

    const createObjectURL = vi.fn(() => 'blob:mock-invoice-url')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

    const fakeLink = {
      href: '',
      download: '',
      style: { display: '' },
      click: vi.fn(),
      parentNode: { removeChild: vi.fn() },
    }
    const appendChild = vi.fn()
    vi.stubGlobal('document', {
      createElement: vi.fn(() => fakeLink),
      body: { appendChild },
    })

    const filename = exportInvoiceCsv({
      card: makeCard(),
      invoice: makeInvoice(),
      transactions: [],
      categoryMap,
    })

    expect(filename).toBe('fatura-cartao-itau-black-2026-11.csv')
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(fakeLink.download).toBe('fatura-cartao-itau-black-2026-11.csv')
    expect(appendChild).toHaveBeenCalledWith(fakeLink)
    expect(fakeLink.click).toHaveBeenCalledTimes(1)
    expect(fakeLink.parentNode.removeChild).toHaveBeenCalledWith(fakeLink)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-invoice-url')
  })

  it('remove emojis de categorias e gera PDF A4 válido com resumo, filtros, tabelas secundárias e paginação', () => {
    expect(stripEmojis('🏠 Moradia › ⚡ Energia 100%')).toBe('Moradia › Energia 100%')
    expect(stripEmojis('💳✨')).toBe('')

    const txWithEmojis = makeTx({
      title: 'Supermercado 🛒',
      generalCategoryId: 'gen_moradia',
      specificCategoryId: 'spec_energia',
      categoryId: 'spec_energia',
      amount: 15000,
    })
    expect(resolvePdfCategoryLabel(txWithEmojis, categoryMap)).toBe('Moradia › Energia')

    const manyTxs = Array.from({ length: 45 }, (_, idx) =>
      makeTx({
        id: `tx_pdf_${idx}`,
        title: `Compra ${idx + 1} 🛍️`,
        amount: 2500 + idx * 100,
        date: `2026-11-${String((idx % 28) + 1).padStart(2, '0')}`,
        generalCategoryId: 'gen_moradia',
        specificCategoryId: 'spec_energia',
        categoryId: 'spec_energia',
        responsible: idx % 2 === 0 ? userAna : userBruno,
      }),
    )

    const refundTx = makeTx({
      id: 'tx_pdf_refund',
      title: 'Estorno Parcial',
      type: 'INCOME',
      amount: 5000,
      date: '2026-11-28',
    })

    const paymentTx = makeTx({
      id: 'pay_pdf_1',
      title: 'Pagamento parcial fatura',
      amount: 50000,
      date: '2026-11-18',
      accountId: 'acc_1',
      creditCardId: null,
      creditCardInvoiceId: 'inv_1',
      responsible: userAna,
    })

    const doc = buildInvoicePdfDocument(
      {
        card: makeCard(),
        invoice: makeInvoice({
          transactions: [...manyTxs, refundTx],
          byResponsible: [
            { user: userAna, amount: 120000 },
            { user: userBruno, amount: 90000 },
          ],
          payments: [paymentTx],
        }),
        transactions: [...manyTxs, refundTx],
        totalTransactionsCount: 50,
        filters: { activeCount: 1, search: 'Compra' },
        categoryMap,
        accountNames,
      },
      new Date(2026, 10, 22, 14, 30),
    )

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
    const pdfBytes = new TextDecoder('latin1').decode(doc.output('arraybuffer'))
    expect(pdfBytes.startsWith('%PDF-')).toBe(true)
    expect(pdfBytes).toContain('Fatura do Cart')
    expect(pdfBytes).toContain('Moradia')
    expect(pdfBytes).toContain('Energia')
    expect(pdfBytes).not.toContain('🏠')
    expect(pdfBytes).not.toContain('⚡')
    expect(pdfBytes).not.toContain('🛍️')
    expect(pdfBytes).not.toContain(userAna.email)
    expect(pdfBytes).not.toContain(userBruno.email)

    const saveSpy = vi.fn()
    const exportedName = exportInvoicePdf(
      {
        card: makeCard({ name: 'Cartão XPTO 🚀' }),
        invoice: makeInvoice({ status: 'OPEN' }),
        transactions: [txWithEmojis],
        categoryMap,
      },
      { save: saveSpy },
    )

    expect(exportedName).toBe('fatura-cartao-xpto-2026-11.pdf')
    expect(saveSpy).toHaveBeenCalledTimes(1)
    expect(saveSpy.mock.calls[0]?.[1]).toBe('fatura-cartao-xpto-2026-11.pdf')

    const emptyDoc = buildInvoicePdfDocument({
      card: makeCard(),
      invoice: makeInvoice({ status: 'PAID', remainingAmount: 0 }),
      transactions: [],
      categoryMap,
    })
    const emptyBytes = new TextDecoder('latin1').decode(emptyDoc.output('arraybuffer'))
    expect(emptyDoc.getNumberOfPages()).toBe(1)
    expect(emptyBytes).toContain('Nenhum lan')
    expect(emptyBytes).not.toContain('Gastos por respons')
    expect(emptyBytes).not.toContain('Pagamentos efetuados')
  })
})
