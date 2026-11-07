import type { ReactNode } from 'react'

export interface FieldProps {
  label?: string
  error?: string
  children: ReactNode
  hint?: string
  className?: string
}

export function Field({ label, error, children, hint, className }: FieldProps) {
  return (
    <label className={`block space-y-1.5 ${className ?? ''}`}>
      {label && <span className="block text-xs font-medium text-text-muted">{label}</span>}
      {children}
      {hint && !error && <span className="block text-xs text-text-dim leading-relaxed">{hint}</span>}
      {error && (
        <span className="flex items-center gap-1 text-xs text-lime font-medium">
          <span className="size-1 rounded-full bg-lime shrink-0" />
          {error}
        </span>
      )}
    </label>
  )
}
