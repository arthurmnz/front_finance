import { useEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import clsx from 'clsx'

export interface InfoTooltipProps {
  content: React.ReactNode
  title?: string
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom'
  className?: string
  iconClassName?: string
}

export function InfoTooltip({
  content,
  title,
  align = 'center',
  side = 'top',
  className,
  iconClassName,
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const alignClasses =
    align === 'start'
      ? 'left-0'
      : align === 'end'
        ? 'right-0'
        : 'left-1/2 -translate-x-1/2'

  const sideClasses = side === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'

  return (
    <div
      ref={containerRef}
      className={clsx('relative inline-flex items-center text-text-dim hover:text-white', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((prev) => !prev)
        }}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          // Se o foco foi para um elemento dentro do próprio container, mantém aberto
          if (containerRef.current?.contains(e.relatedTarget as Node)) return
          setOpen(false)
        }}
        className={clsx(
          'inline-flex items-center justify-center rounded-full p-0.5 text-text-dim/80 hover:text-white hover:bg-surface-2 focus:outline-none focus:ring-1 focus:ring-violet transition cursor-pointer select-none',
          open && 'text-white bg-surface-2',
        )}
        aria-label="Mais informações"
        aria-expanded={open}
      >
        <Info className={clsx('size-3.5', iconClassName)} />
      </button>

      {open && (
        <div
          role="tooltip"
          className={clsx(
            'pointer-events-auto absolute z-50 w-60 sm:w-64 max-w-[85vw] rounded-xl border border-border/90 bg-surface-2/95 backdrop-blur-md p-2.5 text-xs text-text-muted font-normal shadow-2xl shadow-black/80',
            alignClasses,
            sideClasses,
          )}
        >
          {title && <p className="mb-1 text-xs font-semibold text-white tracking-tight">{title}</p>}
          <div className="leading-relaxed text-[11px] text-text-dim">{content}</div>
        </div>
      )}
    </div>
  )
}
