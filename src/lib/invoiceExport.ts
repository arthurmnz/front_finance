import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { resolveTransactionCategory } from './categories'
import { formatDate, formatMoney, freqLabel, fullName, monthLabel, txTypeLabel } from './format'
import type { Category, CreditCard, CreditCardInvoice, Transaction } from './types'

export interface InvoiceExportFilters {
  activeCount?: number
  search?: string
}

export interface InvoiceExportPayload {
  card: CreditCard
  invoice: CreditCardInvoice
  transactions: Transaction[]
  totalTransactionsCount?: number
  filters?: InvoiceExportFilters
  categoryMap: Map<string, Category>
  accountNames?: Map<string, string>
}

export interface CsvCellOptions {
  /** Quando true, sempre neutraliza prefixos `-` em campos textuais. */
  text?: boolean
}

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: { finalY?: number }
}

const INVOICE_STATUS_LABELS: Record<CreditCardInvoice['status'], string> = {
  OPEN: 'Aberta',
  CLOSED: 'Fechada',
  PARTIALLY_PAID: 'Paga parcialmente',
  PAID: 'Paga',
}

const TX_STATUS_LABELS: Record<Transaction['status'], string> = {
  COMPLETED: 'Concluído',
  PENDING: 'Pendente',
}

const LEADING_CONTROL_FORMULA_RE = /^[\t\r\n]/
const LEADING_FORMULA_SYMBOL_RE = /^\s*[=+@]/
const LEADING_MINUS_RE = /^\s*-/
const SAFE_NEGATIVE_NUMERIC_RE = /^-(?:\d+(?:[.,]\d+)?|\d{1,3}(?:\.\d{3})*(?:,\d+)?)$/
const EMOJI_RE = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u2600-\u27BF\uFE0F\u200D\u20E3]/gu

/**
 * Gera um slug ASCII seguro a partir do nome do cartão para uso em nomes de arquivo.
 */
export function slugifyCardName(name: string): string {
  const slug = (name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
  return slug || 'cartao'
}

/**
 * Monta o nome de arquivo sanitizado da fatura no padrão `fatura-<slug>-<YYYY>-<MM>.<ext>`.
 */
export function buildInvoiceFilename(
  cardName: string,
  year: number,
  month: number,
  ext: 'csv' | 'pdf',
): string {
  const slug = slugifyCardName(cardName)
  const yyyy = String(year).padStart(4, '0')
  const mm = String(month).padStart(2, '0')
  return `fatura-${slug}-${yyyy}-${mm}.${ext}`
}

/**
 * Remove emojis e símbolos pictográficos incompatíveis com a fonte WinAnsi padrão do jsPDF.
 */
export function stripEmojis(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim()
}

/**
 * Neutraliza payloads de CSV/Formula Injection (CWE-1236) antes de aplicar escaping RFC 4180 (`;`).
 * Preserva valores monetários negativos legítimos quando `options.text` não está ativo.
 */
export function sanitizeCsvCell(value: string | number | null | undefined, options?: CsvCellOptions): string {
  if (value === null || value === undefined) return ''
  const raw = String(value)
  if (!raw) return ''

  const hasFormulaPrefix =
    LEADING_CONTROL_FORMULA_RE.test(raw) ||
    LEADING_FORMULA_SYMBOL_RE.test(raw) ||
    (LEADING_MINUS_RE.test(raw) && (Boolean(options?.text) || !SAFE_NEGATIVE_NUMERIC_RE.test(raw.trim())))

  const safe = hasFormulaPrefix ? `'${raw}` : raw

  if (/[";\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

/**
 * Preserva a regra contábil de CreditCardService.kt: INCOME reduz a fatura (valor negativo).
 */
export function signedInvoiceTransactionCents(tx: Pick<Transaction, 'type' | 'amount'>): number {
  return tx.type === 'INCOME' ? -tx.amount : tx.amount
}

/**
 * Calcula o total líquido em centavos considerando créditos/estornos (`INCOME`) como negativos.
 */
export function computeNetInvoiceAmountCents(transactions: Pick<Transaction, 'type' | 'amount'>[]): number {
  return transactions.reduce((sum, tx) => sum + signedInvoiceTransactionCents(tx), 0)
}

/**
 * Formata centavos no padrão numérico pt-BR (`0,00` / `-45,00`) para colunas de planilha CSV.
 */
export function formatCsvCents(cents: number | null | undefined): string {
  const value = ((cents ?? 0) || 0) / 100
  return value.toFixed(2).replace('.', ',')
}

function formatPdfMoney(cents: number | null | undefined): string {
  const normalized = (cents ?? 0) || 0
  if (normalized < 0) {
    return `-${formatMoney(Math.abs(normalized)).replace(/\u00a0/g, ' ')}`
  }
  return formatMoney(normalized).replace(/\u00a0/g, ' ')
}

/**
 * Formata o indicador de parcelamento ou recorrência da transação.
 */
export function formatRecurrenceLabel(
  tx: Pick<Transaction, 'installmentNumber' | 'totalInstallments' | 'isInfinite' | 'recurrenceFrequency' | 'recurrenceGroupId'>,
): string {
  if (tx.installmentNumber && tx.totalInstallments) {
    return `${tx.installmentNumber}/${tx.totalInstallments}`
  }
  if (tx.isInfinite) {
    const freq = tx.recurrenceFrequency ? freqLabel[tx.recurrenceFrequency] : undefined
    return freq ? `Assinatura (${freq})` : 'Assinatura'
  }
  if (tx.recurrenceGroupId) {
    return 'Recorrente'
  }
  return 'À vista'
}

function formatPdfRecurrenceAndType(
  tx: Pick<Transaction, 'type' | 'installmentNumber' | 'totalInstallments' | 'isInfinite' | 'recurrenceFrequency' | 'recurrenceGroupId'>,
): string {
  const rec = formatRecurrenceLabel(tx)
  if (tx.type === 'EXPENSE') return rec
  const typeStr = txTypeLabel[tx.type] ?? tx.type
  return `${typeStr} (${rec})`
}

function resolveCsvCategories(
  tx: Transaction,
  categoryMap: Map<string, Category>,
): { general: string; specific: string } {
  const resolved = resolveTransactionCategory(tx, categoryMap)
  if (!resolved.general && !resolved.specific) {
    return { general: 'Sem categoria', specific: '—' }
  }
  return {
    general: resolved.general?.name ?? '—',
    specific: resolved.specific?.name ?? '—',
  }
}

/**
 * Resolve o rótulo hierárquico da categoria para PDF sem ícones ou emojis.
 */
export function resolvePdfCategoryLabel(tx: Transaction, categoryMap: Map<string, Category>): string {
  const resolved = resolveTransactionCategory(tx, categoryMap)
  if (!resolved.general && !resolved.specific) {
    return 'Sem categoria'
  }
  const generalName = stripEmojis(resolved.general?.name)
  const specificName = stripEmojis(resolved.specific?.name)
  if (generalName && specificName) return `${generalName} › ${specificName}`
  return generalName || specificName || 'Sem categoria'
}

/**
 * Ordena lançamentos em ordem cronológica crescente determinística.
 */
export function sortTransactionsChronologically(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => {
    const dayCmp = a.date.slice(0, 10).localeCompare(b.date.slice(0, 10))
    if (dayCmp !== 0) return dayCmp
    const fullCmp = a.date.localeCompare(b.date)
    if (fullCmp !== 0) return fullCmp
    const createdCmp = (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
    if (createdCmp !== 0) return createdCmp
    return a.title.localeCompare(b.title, 'pt-BR')
  })
}

function resolveResponsibleName(responsible?: Transaction['responsible']): string {
  if (!responsible) return '—'
  return fullName(responsible) || '—'
}

function buildFilterSummary(payload: InvoiceExportPayload) {
  const totalCount = payload.totalTransactionsCount ?? payload.transactions.length
  const displayedCount = payload.transactions.length
  const activeCount = payload.filters?.activeCount ?? 0
  const search = payload.filters?.search?.trim() ?? ''
  const isFiltered = activeCount > 0 || search.length > 0 || totalCount !== displayedCount
  const filteredNetCents = computeNetInvoiceAmountCents(payload.transactions)

  const parts: string[] = []
  if (activeCount > 0) parts.push(`${activeCount} filtro(s) ativo(s)`)
  if (search) parts.push(`busca: "${search}"`)
  const filterDetails = parts.length > 0 ? ` (${parts.join('; ')})` : ''
  const description = `Exibindo ${displayedCount} de ${totalCount} lançamento(s)${filterDetails}`

  return { isFiltered, displayedCount, totalCount, filteredNetCents, description }
}

function csvRow(cells: string[]): string {
  return cells.join(';')
}

/**
 * Gera o conteúdo CSV UTF-8 (com BOM) da fatura do cartão compatível com Excel pt-BR.
 */
export function buildInvoiceCsv(payload: InvoiceExportPayload): string {
  const { card, invoice, transactions, categoryMap, accountNames } = payload
  const filterInfo = buildFilterSummary(payload)
  const mm = String(invoice.month).padStart(2, '0')
  const periodStr = `${mm}/${invoice.year} - ${monthLabel(invoice.month, invoice.year)}`
  const statusStr = INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status

  const lines: string[] = [
    csvRow(['Campo', 'Valor']),
    csvRow([sanitizeCsvCell('Cartão', { text: true }), sanitizeCsvCell(card.name, { text: true })]),
    csvRow([
      sanitizeCsvCell('Fechamento', { text: true }),
      sanitizeCsvCell(`Dia ${card.closingDay} (${formatDate(invoice.closingDate)})`, { text: true }),
    ]),
    csvRow([
      sanitizeCsvCell('Vencimento', { text: true }),
      sanitizeCsvCell(`Dia ${card.dueDay} (${formatDate(invoice.dueDate)})`, { text: true }),
    ]),
    csvRow([sanitizeCsvCell('Período', { text: true }), sanitizeCsvCell(periodStr, { text: true })]),
    csvRow([sanitizeCsvCell('Status', { text: true }), sanitizeCsvCell(statusStr, { text: true })]),
    csvRow([
      sanitizeCsvCell('Compras do mês (R$)', { text: true }),
      sanitizeCsvCell(formatCsvCents(invoice.purchasesAmount)),
    ]),
    csvRow([
      sanitizeCsvCell('Saldo anterior rolado (R$)', { text: true }),
      sanitizeCsvCell(formatCsvCents(invoice.carriedOverAmount)),
    ]),
    csvRow([
      sanitizeCsvCell('Juros do rotativo (R$)', { text: true }),
      sanitizeCsvCell(formatCsvCents(invoice.revolvingInterestAmount)),
    ]),
    csvRow([
      sanitizeCsvCell('Total da fatura (R$)', { text: true }),
      sanitizeCsvCell(formatCsvCents(invoice.totalAmount)),
    ]),
    csvRow([sanitizeCsvCell('Já pago (R$)', { text: true }), sanitizeCsvCell(formatCsvCents(invoice.paidAmount))]),
    csvRow([
      sanitizeCsvCell('Restante a pagar (R$)', { text: true }),
      sanitizeCsvCell(formatCsvCents(invoice.remainingAmount)),
    ]),
  ]

  if (filterInfo.isFiltered) {
    lines.push(
      csvRow([
        sanitizeCsvCell('Filtro aplicado', { text: true }),
        sanitizeCsvCell(filterInfo.description, { text: true }),
      ]),
      csvRow([
        sanitizeCsvCell('Total líquido filtrado (R$)', { text: true }),
        sanitizeCsvCell(formatCsvCents(filterInfo.filteredNetCents)),
      ]),
    )
  }

  lines.push('')
  lines.push(sanitizeCsvCell('Lançamentos', { text: true }))
  lines.push(
    csvRow([
      'Data',
      'Descrição',
      'Categoria Geral',
      'Categoria Específica',
      'Tipo',
      'Parcela / Recorrência',
      'Responsável',
      'Status',
      'Valor (R$)',
    ]),
  )

  const sortedTxs = sortTransactionsChronologically(transactions)
  for (const tx of sortedTxs) {
    const cats = resolveCsvCategories(tx, categoryMap)
    lines.push(
      csvRow([
        sanitizeCsvCell(formatDate(tx.date), { text: true }),
        sanitizeCsvCell(tx.title, { text: true }),
        sanitizeCsvCell(cats.general, { text: true }),
        sanitizeCsvCell(cats.specific, { text: true }),
        sanitizeCsvCell(txTypeLabel[tx.type] ?? tx.type, { text: true }),
        sanitizeCsvCell(formatRecurrenceLabel(tx), { text: true }),
        sanitizeCsvCell(resolveResponsibleName(tx.responsible), { text: true }),
        sanitizeCsvCell(TX_STATUS_LABELS[tx.status] ?? tx.status, { text: true }),
        sanitizeCsvCell(formatCsvCents(signedInvoiceTransactionCents(tx))),
      ]),
    )
  }

  const byResponsible = invoice.byResponsible ?? []
  if (byResponsible.length > 0) {
    lines.push('')
    lines.push(sanitizeCsvCell('Gastos por responsável', { text: true }))
    lines.push(csvRow(['Responsável', 'Valor (R$)']))
    for (const item of byResponsible) {
      lines.push(
        csvRow([
          sanitizeCsvCell(fullName(item.user) || '—', { text: true }),
          sanitizeCsvCell(formatCsvCents(item.amount)),
        ]),
      )
    }
  }

  const payments = invoice.payments ?? []
  if (payments.length > 0) {
    lines.push('')
    lines.push(sanitizeCsvCell('Pagamentos efetuados', { text: true }))
    lines.push(csvRow(['Data', 'Descrição', 'Conta', 'Responsável', 'Valor (R$)']))
    const sortedPayments = sortTransactionsChronologically(payments)
    for (const p of sortedPayments) {
      lines.push(
        csvRow([
          sanitizeCsvCell(formatDate(p.date), { text: true }),
          sanitizeCsvCell(p.title, { text: true }),
          sanitizeCsvCell(accountNames?.get(p.accountId) ?? '—', { text: true }),
          sanitizeCsvCell(resolveResponsibleName(p.responsible), { text: true }),
          sanitizeCsvCell(formatCsvCents(p.amount)),
        ]),
      )
    }
  }

  return `\uFEFF${lines.join('\r\n')}`
}

/**
 * Gera e dispara o download do arquivo CSV da fatura, realizando cleanup do ObjectURL.
 */
export function exportInvoiceCsv(payload: InvoiceExportPayload): string {
  const csv = buildInvoiceCsv(payload)
  const filename = buildInvoiceFilename(payload.card.name, payload.invoice.year, payload.invoice.month, 'csv')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'

  try {
    document.body.appendChild(link)
    link.click()
  } finally {
    if (link.parentNode) {
      link.parentNode.removeChild(link)
    }
    URL.revokeObjectURL(url)
  }

  return filename
}

function getStatusPdfColor(status: CreditCardInvoice['status']): [number, number, number] {
  switch (status) {
    case 'PAID':
      return [21, 128, 61]
    case 'OPEN':
      return [180, 118, 9]
    case 'PARTIALLY_PAID':
      return [180, 83, 9]
    case 'CLOSED':
    default:
      return [55, 65, 81]
  }
}

function formatGenerationTimestamp(now = new Date()): string {
  const datePart = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timePart = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${datePart} às ${timePart}`
}

/**
 * Constrói o documento PDF A4 retrato em fundo branco com resumo financeiro, lançamentos e rodapé paginado.
 */
export function buildInvoicePdfDocument(payload: InvoiceExportPayload, generatedAt = new Date()): jsPDF {
  const { card, invoice, transactions, categoryMap, accountNames } = payload
  const filterInfo = buildFilterSummary(payload)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPdfWithAutoTable
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentWidth = pageWidth - margin * 2

  const safeCardName = stripEmojis(card.name) || 'Cartão'
  const mm = String(invoice.month).padStart(2, '0')
  const periodStr = `${mm}/${invoice.year} - ${monthLabel(invoice.month, invoice.year)}`
  const statusStr = INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status

  // Barra superior de identidade
  doc.setFillColor(251, 191, 36)
  doc.rect(margin, 10, contentWidth, 1.2, 'F')

  // Cabeçalho
  let y = 18
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(17, 24, 39)
  doc.text('Fatura do Cartão', margin, y)

  doc.setFontSize(10)
  doc.setTextColor(...getStatusPdfColor(invoice.status))
  doc.text(`Status: ${statusStr}`, pageWidth - margin, y, { align: 'right' })

  y += 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(55, 65, 81)
  const cardPeriodLines = doc.splitTextToSize(`${safeCardName}  |  ${periodStr}`, 118)
  doc.text(cardPeriodLines, margin, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(107, 114, 128)
  doc.text(`Emitido em ${formatGenerationTimestamp(generatedAt)}`, pageWidth - margin, y, { align: 'right' })

  y += Math.max(5.5, cardPeriodLines.length * 4.8)
  doc.setFontSize(8.8)
  doc.text(
    `Fechamento: dia ${card.closingDay} (${formatDate(invoice.closingDate)})  ·  Vencimento: dia ${card.dueDay} (${formatDate(invoice.dueDate)})`,
    margin,
    y,
  )

  // Card de resumo financeiro (fundo claro de alto contraste)
  y += 5
  const summaryBoxH = 38
  doc.setFillColor(248, 249, 251)
  doc.setDrawColor(229, 231, 235)
  doc.setLineWidth(0.3)
  doc.roundedRect(margin, y, contentWidth, summaryBoxH, 2, 2, 'FD')

  const colW = contentWidth / 3
  const summaryRows: Array<Array<{ label: string; value: string; color?: [number, number, number]; bold?: boolean }>> = [
    [
      { label: 'Total da fatura', value: formatPdfMoney(invoice.totalAmount), color: [17, 24, 39], bold: true },
      { label: 'Já pago', value: formatPdfMoney(invoice.paidAmount), color: [21, 128, 61], bold: true },
      {
        label: 'Restante a pagar',
        value: formatPdfMoney(invoice.remainingAmount),
        color: invoice.remainingAmount > 0 ? [185, 28, 28] : [21, 128, 61],
        bold: true,
      },
    ],
    [
      { label: 'Compras do mês', value: formatPdfMoney(invoice.purchasesAmount) },
      { label: 'Saldo anterior', value: formatPdfMoney(invoice.carriedOverAmount) },
      { label: 'Juros do rotativo', value: formatPdfMoney(invoice.revolvingInterestAmount) },
    ],
    [
      { label: 'Limite total', value: formatPdfMoney(card.limitAmount) },
      { label: 'Limite utilizado', value: formatPdfMoney(card.usedLimit) },
      { label: 'Limite disponível', value: formatPdfMoney(card.availableLimit), color: [21, 128, 61] },
    ],
  ]

  summaryRows.forEach((row, rowIdx) => {
    const rowTop = y + rowIdx * 12.2
    if (rowIdx > 0) {
      doc.setDrawColor(229, 231, 235)
      doc.setLineWidth(0.2)
      doc.line(margin + 3, rowTop + 1, pageWidth - margin - 3, rowTop + 1)
    }

    row.forEach((cell, colIdx) => {
      const cellX = margin + 4 + colIdx * colW
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(107, 114, 128)
      doc.text(cell.label, cellX, rowTop + 5.5)

      doc.setFont('helvetica', cell.bold ? 'bold' : 'normal')
      doc.setFontSize(rowIdx === 0 ? 10 : 9)
      doc.setTextColor(...(cell.color ?? [31, 41, 55]))
      doc.text(cell.value, cellX, rowTop + 10.2)
    })
  })

  y += summaryBoxH + 5

  // Aviso discreto de filtros aplicados
  if (filterInfo.isFiltered) {
    const noticeText = stripEmojis(
      `Filtro aplicado: ${filterInfo.description} · Total líquido filtrado: ${formatPdfMoney(filterInfo.filteredNetCents)}`,
    )
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.2)
    const wrapped = doc.splitTextToSize(noticeText, contentWidth - 8)
    const bannerH = Math.max(8, wrapped.length * 4 + 3.5)

    doc.setFillColor(245, 243, 255)
    doc.setDrawColor(221, 214, 254)
    doc.setLineWidth(0.25)
    doc.roundedRect(margin, y, contentWidth, bannerH, 1.5, 1.5, 'FD')

    doc.setTextColor(91, 33, 182)
    doc.text(wrapped, margin + 4, y + 5)
    y += bannerH + 5
  }

  // Tabela principal de lançamentos
  const sortedTxs = sortTransactionsChronologically(transactions)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(17, 24, 39)
  doc.text(`Lançamentos (${sortedTxs.length})`, margin, y)
  y += 3

  if (sortedTxs.length === 0) {
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(107, 114, 128)
    doc.text('Nenhum lançamento encontrado para os critérios selecionados.', margin, y)
    y += 8
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, bottom: 18 },
      theme: 'striped',
      head: [['Data', 'Descrição', 'Categoria', 'Parcela / Tipo', 'Responsável', 'Valor']],
      body: sortedTxs.map((tx) => [
        formatDate(tx.date),
        stripEmojis(tx.title) || '—',
        resolvePdfCategoryLabel(tx, categoryMap),
        formatPdfRecurrenceAndType(tx),
        stripEmojis(resolveResponsibleName(tx.responsible)) || '—',
        formatPdfMoney(signedInvoiceTransactionCents(tx)),
      ]),
      styles: {
        font: 'helvetica',
        fontSize: 8.2,
        textColor: [31, 41, 55],
        cellPadding: { top: 2.2, right: 2.4, bottom: 2.2, left: 2.4 },
        lineColor: [229, 231, 235],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [30, 30, 43],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.2,
      },
      alternateRowStyles: {
        fillColor: [248, 249, 251],
      },
      columnStyles: {
        0: { cellWidth: 20, halign: 'left' },
        1: { cellWidth: 'auto', halign: 'left' },
        2: { cellWidth: 34, halign: 'left' },
        3: { cellWidth: 24, halign: 'left' },
        4: { cellWidth: 25, halign: 'left' },
        5: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'head' && data.column.index === 5) {
          data.cell.styles.halign = 'right'
        }
        if (data.section === 'body' && data.column.index === 5) {
          const tx = sortedTxs[data.row.index]
          if (tx && tx.type === 'INCOME') {
            data.cell.styles.textColor = [21, 128, 61]
          }
        }
      },
    })
    y = (doc.lastAutoTable?.finalY ?? y) + 8
  }

  // Tabela secundária: Gastos por responsável
  const byResponsible = invoice.byResponsible ?? []
  if (byResponsible.length > 0) {
    if (y > pageHeight - 40) {
      doc.addPage()
      y = 16
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(17, 24, 39)
    doc.text('Gastos por responsável', margin, y)

    autoTable(doc, {
      startY: y + 3,
      margin: { left: margin, right: margin, bottom: 18 },
      theme: 'striped',
      head: [['Responsável', 'Valor']],
      body: byResponsible.map((item) => [
        stripEmojis(fullName(item.user)) || '—',
        formatPdfMoney(item.amount),
      ]),
      styles: {
        font: 'helvetica',
        fontSize: 8.5,
        textColor: [31, 41, 55],
        cellPadding: { top: 2.2, right: 2.5, bottom: 2.2, left: 2.5 },
        lineColor: [229, 231, 235],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [30, 30, 43],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      alternateRowStyles: {
        fillColor: [248, 249, 251],
      },
      columnStyles: {
        0: { cellWidth: 'auto', halign: 'left' },
        1: { cellWidth: 45, halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'head' && data.column.index === 1) {
          data.cell.styles.halign = 'right'
        }
      },
    })
    y = (doc.lastAutoTable?.finalY ?? y) + 8
  }

  // Tabela secundária: Pagamentos efetuados
  const payments = invoice.payments ?? []
  if (payments.length > 0) {
    if (y > pageHeight - 40) {
      doc.addPage()
      y = 16
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(17, 24, 39)
    doc.text('Pagamentos efetuados', margin, y)

    const sortedPayments = sortTransactionsChronologically(payments)
    autoTable(doc, {
      startY: y + 3,
      margin: { left: margin, right: margin, bottom: 18 },
      theme: 'striped',
      head: [['Data', 'Descrição', 'Conta', 'Responsável', 'Valor']],
      body: sortedPayments.map((p) => [
        formatDate(p.date),
        stripEmojis(p.title) || '—',
        stripEmojis(accountNames?.get(p.accountId) ?? '—') || '—',
        stripEmojis(resolveResponsibleName(p.responsible)) || '—',
        formatPdfMoney(p.amount),
      ]),
      styles: {
        font: 'helvetica',
        fontSize: 8.2,
        textColor: [31, 41, 55],
        cellPadding: { top: 2.2, right: 2.4, bottom: 2.2, left: 2.4 },
        lineColor: [229, 231, 235],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [30, 30, 43],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.2,
      },
      alternateRowStyles: {
        fillColor: [248, 249, 251],
      },
      columnStyles: {
        0: { cellWidth: 22, halign: 'left' },
        1: { cellWidth: 'auto', halign: 'left' },
        2: { cellWidth: 36, halign: 'left' },
        3: { cellWidth: 34, halign: 'left' },
        4: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: [21, 128, 61] },
      },
      didParseCell: (data) => {
        if (data.section === 'head' && data.column.index === 4) {
          data.cell.styles.halign = 'right'
        }
      },
    })
  }

  // Rodapé com numeração "Página X de Y"
  const totalPages = doc.getNumberOfPages()
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(229, 231, 235)
    doc.setLineWidth(0.2)
    doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(107, 114, 128)
    doc.text(`Finance · ${safeCardName} · ${mm}/${invoice.year}`, margin, pageHeight - 8)
    doc.text(`Página ${page} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
  }

  return doc
}

export interface PdfExportOptions {
  save?: (doc: jsPDF, filename: string) => void
}

/**
 * Gera e dispara o download do arquivo PDF da fatura.
 */
export function exportInvoicePdf(payload: InvoiceExportPayload, options?: PdfExportOptions): string {
  const filename = buildInvoiceFilename(payload.card.name, payload.invoice.year, payload.invoice.month, 'pdf')
  const doc = buildInvoicePdfDocument(payload)
  if (options?.save) {
    options.save(doc, filename)
  } else {
    doc.save(filename)
  }
  return filename
}
