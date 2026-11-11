import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return

    // Salva o elemento com foco atual para restaurar ao fechar
    previousActiveElementRef.current = document.activeElement as HTMLElement | null

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Foco inicial: no primeiro elemento focável ou no próprio dialog apenas se o foco ainda não estiver dentro do dialog
    const timer = setTimeout(() => {
      if (dialogRef.current && !dialogRef.current.contains(document.activeElement)) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        if (focusable.length > 0) {
          // Se o primeiro elemento for o botão de fechar (X) e houver outros (ex.: campos do form),
          // prefere o primeiro campo de formulário se existir
          const formField = Array.from(focusable).find(
            (el) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.getAttribute('role') === 'listbox',
          )
          if (formField) {
            formField.focus()
          } else {
            focusable[0].focus()
          }
        } else {
          dialogRef.current.focus()
        }
      }
    }, 50)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter((el) => el.offsetParent !== null) // apenas elementos visíveis

        if (focusables.length === 0) {
          e.preventDefault()
          return
        }

        const first = focusables[0]
        const last = focusables[focusables.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow

      // Restaura o foco para o elemento disparador
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus()
      }
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity animate-in fade-in-0 duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog container */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={clsx(
          'relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl outline-none',
          'bg-surface-1 border border-border px-5 pt-3.5 sm:pt-5 modal-body card-highlight',
          'shadow-2xl shadow-black/95 z-10 animate-in slide-in-from-bottom-4 duration-200',
          className,
        )}
      >
        {/* Mobile drag handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3 sm:hidden" aria-hidden="true" />

        <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/50 pb-3">
          <h2 id="modal-title" className="text-lg font-bold tracking-tight text-white truncate">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-8 place-items-center rounded-xl text-text-muted hover:bg-surface-2 hover:text-white transition active:scale-95"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
