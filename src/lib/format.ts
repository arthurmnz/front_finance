const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Valores no backend são centavos. */
export const formatMoney = (cents: number) => brl.format(cents / 100)

export const parseMoneyToCents = (v: string): number => {
  const digits = v.replace(/\D/g, '')
  return digits ? parseInt(digits, 10) : 0
}
export const centsToInput = (cents: number) => (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const formatDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
export const toISODate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const monthLabel = (month: number, year: number) =>
  new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

export const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim()
export const initials = (u: { firstName: string; lastName: string }) => `${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`.toUpperCase()

export const accountTypeLabel: Record<string, string> = { CHECKING: 'Conta corrente', WALLET: 'Carteira', SAVINGS: 'Reservas', INVESTMENTS: 'Investimentos' }
export const categoryTypeLabel: Record<string, string> = { EXPENSE: 'Despesa', INCOME: 'Receita', BOTH: 'Ambos' }
export const txTypeLabel: Record<string, string> = { EXPENSE: 'Despesa', INCOME: 'Receita', TRANSFER: 'Transferência' }
export const roleLabel: Record<string, string> = { OWNER: 'Dono', ADMIN: 'Admin', MEMBER: 'Membro' }
export const freqLabel: Record<string, string> = { DAILY: 'Diária', WEEKLY: 'Semanal', MONTHLY: 'Mensal', YEARLY: 'Anual' }

/** Valor compacto para células pequenas (ex.: -R$ 45, R$ 1,2 mil). Recebe centavos. */
export const formatCompact = (cents: number) => {
  const v = cents / 100
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (abs >= 10_000) return `${sign}${(abs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`
  if (abs >= 1000) return `${sign}${(abs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return `${sign}${abs.toLocaleString('pt-BR', { maximumFractionDigits: Number.isInteger(abs) ? 0 : 2, minimumFractionDigits: Number.isInteger(abs) ? 0 : 2 })}`
}

/**
 * Calcula a fatura padrão (mês, ano) para uma compra em [isoDate] dado o dia de fechamento e vencimento do cartão.
 */
export const defaultInvoicePeriod = (isoDate: string, closingDay: number, dueDay: number): { month: number; year: number } => {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number)
  let offset = d >= closingDay ? 1 : 0
  if (dueDay < closingDay) offset += 1
  const dt = new Date(y, m - 1 + offset, 1)
  return { month: dt.getMonth() + 1, year: dt.getFullYear() }
}
