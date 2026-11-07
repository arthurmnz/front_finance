/**
 * Paleta de cores exclusiva do sistema:
 * #000000 Black
 * #7D39EB Violet
 * #C6FF33 Lime
 * #FFFFFF White
 */

export const THEME_COLORS = {
  black: '#000000',
  surface: '#070709',
  surface1: '#0e0e13',
  surface2: '#16161f',
  surface3: '#1e1e2b',
  border: '#20202d',
  borderStrong: '#323247',
  text: '#ffffff',
  textMuted: 'rgba(255, 255, 255, 0.72)',
  textDim: 'rgba(255, 255, 255, 0.64)',
  textFaint: 'rgba(255, 255, 255, 0.25)',
  violet: '#7D39EB',
  violetHover: '#9253f5',
  violetActive: '#6626d0',
  violetSubtle: 'rgba(125, 57, 235, 0.15)',
  lime: '#C6FF33',
  limeHover: '#d5ff5c',
  limeActive: '#b1eb21',
  limeSubtle: 'rgba(198, 255, 51, 0.12)',
} as const

/**
 * 8 tons derivados da paleta exclusiva para gráficos (Dashboard, GroupDetail) e categorias:
 * 1. Lime (#C6FF33)
 * 2. Lime pastel (#E4FF8F)
 * 3. Violet (#7D39EB)
 * 4. Lavanda (#B285FF)
 * 5. Violet escuro (#4A159D)
 * 6. Branco gelo (#F4F4F6)
 * 7. Cinza titânio (#8E8EA0)
 * 8. Grafite (#38384A)
 */
export const PALETTE = [
  '#C6FF33', // Lime
  '#E4FF8F', // Lime pastel
  '#7D39EB', // Violet
  '#B285FF', // Lavanda
  '#4A159D', // Violet escuro
  '#F4F4F6', // Branco gelo
  '#8E8EA0', // Cinza titânio
  '#38384A', // Grafite
] as const

const LEGACY_COLOR_MAP: Record<string, string> = {
  '#6366f1': '#7D39EB', // indigo -> violet
  '#7c7ff5': '#B285FF', // indigo hover -> lavanda
  '#4f46e5': '#4A159D', // indigo dark -> violet escuro
  '#f87171': '#F4F4F6', // red -> branco gelo
  '#ef4444': '#F4F4F6',
  '#dc2626': '#8E8EA0',
  '#34d399': '#C6FF33', // emerald -> lime
  '#10b981': '#C6FF33',
  '#059669': '#E4FF8F',
  '#a3e635': '#C6FF33', // lime antigo -> lime
  '#84cc16': '#C6FF33',
  '#fbbf24': '#E4FF8F', // amber -> lime pastel
  '#f59e0b': '#B285FF',
  '#38bdf8': '#8E8EA0', // sky -> cinza titanio
  '#0284c7': '#7D39EB',
  '#e879f9': '#B285FF', // fuchsia -> lavanda
  '#c084fc': '#B285FF',
  '#fb923c': '#F4F4F6', // orange -> branco gelo
  '#ea580c': '#8E8EA0',
  '#0b0f17': '#000000',
  '#121826': '#0e0e13',
  '#1a2233': '#16161f',
  '#263047': '#20202d',
  '#8b95a9': '#8E8EA0',
  '#e6eaf2': '#F4F4F6',
}

/**
 * Normaliza cores legadas salvas no banco de dados para os 8 tons oficiais da paleta.
 */
export function normalizeCategoryColor(color?: string | null, fallbackIndex = 0): string {
  if (!color) return PALETTE[fallbackIndex % PALETTE.length]
  const lower = color.trim().toLowerCase()
  if (LEGACY_COLOR_MAP[lower]) {
    return LEGACY_COLOR_MAP[lower]
  }
  const isApproved = PALETTE.some((p) => p.toLowerCase() === lower)
  if (isApproved) return color
  return PALETTE[fallbackIndex % PALETTE.length]
}
