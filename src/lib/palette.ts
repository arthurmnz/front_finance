/**
 * Paleta de cores oficial do sistema Finance:
 * --color-canvas: #09090b
 * --color-surface: #111114
 * --color-surface-elevated: #18181b
 * --color-border-subtle: rgba(255, 255, 255, 0.1)
 * --color-border-strong: rgba(255, 255, 255, 0.22)
 * --color-ink-primary: #f4f4f5
 * --color-ink-secondary: #a1a1aa
 * --color-accent: #fbbf24
 * --color-accent-soft: #fcd34d
 */

export const THEME_COLORS = {
  canvas: '#09090b',
  surface: '#111114',
  surfaceElevated: '#18181b',
  borderSubtle: 'rgba(255, 255, 255, 0.1)',
  borderStrong: 'rgba(255, 255, 255, 0.22)',
  inkPrimary: '#f4f4f5',
  inkSecondary: '#a1a1aa',
  accent: '#fbbf24',
  accentSoft: '#fcd34d',
  // Aliases legados
  black: '#09090b',
  surface1: '#111114',
  surface2: '#18181b',
  surface3: '#18181b',
  border: 'rgba(255, 255, 255, 0.1)',
  text: '#f4f4f5',
  textMuted: '#a1a1aa',
  textDim: '#a1a1aa',
  textFaint: 'rgba(161, 161, 170, 0.45)',
  violet: '#fbbf24',
  violetHover: '#fcd34d',
  violetActive: '#f59e0b',
  violetSubtle: 'rgba(251, 191, 36, 0.15)',
  lime: '#fbbf24',
  limeHover: '#fcd34d',
  limeActive: '#f59e0b',
  limeSubtle: 'rgba(251, 191, 36, 0.12)',
} as const

/**
 * Sugestões rápidas de cores para categorias e gráficos:
 */
export const PALETTE = [
  '#fbbf24', // Amber (Accent)
  '#fcd34d', // Amber Soft
  '#f59e0b', // Amber Deep
  '#34d399', // Emerald
  '#38bdf8', // Sky
  '#f4f4f5', // Ink Primary
  '#a1a1aa', // Ink Secondary
  '#f43f5e', // Rose
  '#a855f7', // Purple
  '#fb923c', // Orange
] as const

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/**
 * Expansão de #RGB para #RRGGBB ou validação de código hexadecimal.
 */
export function isValidHexColor(value?: string | null): boolean {
  if (!value) return false
  return HEX_COLOR_RE.test(value.trim())
}

/**
 * Normaliza qualquer cor hexadecimal escolhida pelo usuário (ou usa um fallback da paleta quando vazia).
 * Preserva cores livres customizadas selecionadas pelo seletor de cores.
 */
export function normalizeCategoryColor(color?: string | null, fallbackIndex = 0): string {
  if (!color) return PALETTE[fallbackIndex % PALETTE.length]
  const trimmed = color.trim()
  if (HEX_COLOR_RE.test(trimmed)) {
    if (trimmed.length === 4) {
      const r = trimmed[1]
      const g = trimmed[2]
      const b = trimmed[3]
      return `#${r}${r}${g}${g}${b}${b}`
    }
    return trimmed
  }
  return PALETTE[fallbackIndex % PALETTE.length]
}
