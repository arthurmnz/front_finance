import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import clsx from 'clsx'
import { Loader2, X } from 'lucide-react'
import { parseMoneyToCents, centsToInput } from '@/lib/format'

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'outline'; size?: 'sm' | 'md'; loading?: boolean }
export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...p }: BtnProps) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none',
        size === 'md' ? 'h-11 px-4 text-sm' : 'h-9 px-3 text-xs',
        variant === 'primary' && 'bg-primary text-white hover:bg-primary-hover',
        variant === 'ghost' && 'text-muted hover:bg-surface-2 hover:text-text',
        variant === 'outline' && 'border border-border text-text hover:bg-surface-2',
        variant === 'danger' && 'bg-expense/15 text-expense hover:bg-expense/25',
        className,
      )}
      {...p}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Field({ label, error, children, hint }: { label?: string; error?: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-xs font-medium text-muted">{label}</span>}
      {children}
      {hint && !error && <span className="block text-xs text-muted">{hint}</span>}
      {error && <span className="block text-xs text-expense">{error}</span>}
    </label>
  )
}

const inputCls = 'w-full h-11 rounded-xl bg-surface-2 border border-border px-3 text-sm text-text placeholder:text-muted/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30'
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={clsx(inputCls, className)} {...p} />
))
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => (
  <select ref={ref} className={clsx(inputCls, className)} {...p} />
))
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={clsx(inputCls, 'h-20 py-2 resize-none', className)} {...p} />
))

/** Input monetário: o usuário digita dígitos e o valor é mantido em centavos. */
export function MoneyInput({ value, onChange, ...p }: { value: number; onChange: (cents: number) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">R$</span>
      <Input {...p} inputMode="numeric" className="pl-10" value={centsToInput(value)} onChange={(e) => onChange(parseMoneyToCents(e.target.value))} />
    </div>
  )
}

export function Card({ className, children, ...p }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('rounded-2xl bg-surface border border-border', className)} {...p}>{children}</div>
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'income' | 'expense' | 'warn' | 'primary' }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
      tone === 'default' && 'bg-surface-2 text-muted', tone === 'income' && 'bg-income/15 text-income',
      tone === 'expense' && 'bg-expense/15 text-expense', tone === 'warn' && 'bg-warn/15 text-warn', tone === 'primary' && 'bg-primary/15 text-primary-hover')}>
      {children}
    </span>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-xl bg-surface-2/80', className)} />
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-3.5">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  )
}

export function CardGridSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-3.5 w-36" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="size-10" />
        </div>
      </div>
      <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
        <div className="flex justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-36" />
          </div>
          <div className="space-y-2 text-right">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-28" />
          </div>
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <ListSkeleton rows={4} />
    </div>
  )
}

export function Spinner() {
  return <ListSkeleton rows={3} />
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-muted">
      {icon && <div className="text-muted/70">{icon}</div>}
      <p className="text-sm">{title}</p>
      {children}
    </div>
  )
}

export function QueryState({
  isLoading,
  error,
  skeleton,
  children,
}: {
  isLoading: boolean
  error: unknown
  skeleton?: ReactNode
  children: ReactNode
}) {
  if (isLoading) return <>{skeleton ?? <ListSkeleton rows={4} />}</>
  if (error) return <Empty title="Não foi possível carregar os dados." />
  return <>{children}</>
}

/** Bottom sheet no mobile, modal centralizado no desktop. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-surface border border-border px-5 pt-5 modal-body">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface-2"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', loading, children }:
  { open: boolean; onClose: () => void; onConfirm: () => void; title: string; message?: string; confirmLabel?: string; loading?: boolean; children?: ReactNode }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {message && <p className="text-sm text-muted mb-4">{message}</p>}
      {children}
      <div className="flex gap-2 mt-4">
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
        <Button variant="danger" className="flex-1" loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}

export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: { key: K; label: string; badge?: number }[]; value: K; onChange: (k: K) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-surface p-1 border border-border">
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={clsx('flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition',
            value === t.key ? 'bg-primary text-white' : 'text-muted hover:text-text')}>
          {t.label}{!!t.badge && <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-[11px]">{t.badge}</span>}
        </button>
      ))}
    </div>
  )
}

export function PageHeader({ title, subtitle, action, back }: { title: string; subtitle?: string; action?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <div className="min-w-0">
        {back}
        <h1 className="truncate text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
