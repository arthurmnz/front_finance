import { useEffect, useId, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import clsx from 'clsx'

export interface InfoTooltipProps {
  content: React.ReactNode
  title?: string
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom'
  className?: string
  iconClassName?: string
  ariaLabel?: string
}

export function InfoTooltip({
  content,
  title,
  align = 'center',
  side = 'top',
  className,
  iconClassName,
  ariaLabel = 'Mais informações',
}: InfoTooltipProps) {
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const pointerDownRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipId = useId()

  const open = pinned || hovered || focused

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPinned(false)
        setHovered(false)
        setFocused(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(false)
        setHovered(false)
        setFocused(false)
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
      onPointerEnter={(e) => {
        if (e.pointerType !== 'touch') setHovered(true)
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'touch') setHovered(false)
      }}
    >
      <button
        type="button"
        onPointerDown={() => {
          pointerDownRef.current = true
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (pinned) {
            setPinned(false)
            setHovered(false)
            setFocused(false)
          } else {
            setPinned(true)
          }
        }}
        onFocus={() => {
          if (pointerDownRef.current) {
            pointerDownRef.current = false
            return
          }
          setFocused(true)
        }}
        onBlur={(e) => {
          if (containerRef.current?.contains(e.relatedTarget as Node)) return
          setFocused(false)
        }}
        className={clsx(
          'inline-flex items-center justify-center rounded-full p-1 -m-0.5 text-text-dim/90 hover:text-white hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime transition cursor-pointer select-none',
          open && 'text-white bg-surface-2',
        )}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
      >
        <Info className={clsx('size-3.5', iconClassName)} />
      </button>

      {open && (
        <div
          id={tooltipId}
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className={clsx(
            'pointer-events-auto absolute z-50 w-64 sm:w-72 max-w-[min(18rem,calc(100vw-4rem))] rounded-xl border border-border-strong bg-surface-2 p-3 text-xs text-text-muted font-normal shadow-[0_12px_32px_rgba(0,0,0,0.85)]',
            alignClasses,
            sideClasses,
          )}
        >
          {title && <p className="mb-1 text-xs font-semibold text-white tracking-tight">{title}</p>}
          <div className="leading-relaxed text-[11px] text-text-muted">{content}</div>
        </div>
      )}
    </div>
  )
}
