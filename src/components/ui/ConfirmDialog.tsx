import type { ReactNode } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  children?: ReactNode
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  loading,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {message && <p className="text-sm text-text-muted leading-relaxed mb-4">{message}</p>}
      {children}
      <div className="flex gap-2.5 mt-5">
        <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant="danger"
          className="flex-1 font-semibold"
          loading={loading}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
