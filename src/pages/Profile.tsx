import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, CreditCard, Download, LogOut, Smartphone, Tags, Trash2, Users, UsersRound, Wallet } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useAction } from '@/lib/hooks'
import type { User } from '@/lib/types'
import { fullName, initials } from '@/lib/format'
import { Button, Card, ConfirmDialog, Field, Input, Modal, PageHeader } from '@/components/ui'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function Profile() {
  const { user, setUser, logout } = useAuth()
  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName] = useState(user?.lastName ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [deleting, setDeleting] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallHelp, setShowInstallHelp] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const save = useAction((b: object) => api.put<User>(`/users/${user!.id}`, b).then((r) => r.data), {
    success: 'Perfil atualizado',
    onSuccess: setUser,
  })
  const del = useAction(() => api.delete(`/users/${user!.id}`), {
    success: 'Conta excluída',
    onSuccess: () => logout(),
  })
  if (!user) return null

  const handleInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt()
      await installPrompt.userChoice
      setInstallPrompt(null)
    } else {
      setShowInstallHelp(true)
    }
  }

  return (
    <>
      <PageHeader title="Perfil" />
      <Card className="mb-4 flex items-center gap-4 p-4">
        <div className="grid size-14 place-items-center rounded-full bg-primary/20 text-lg font-bold text-primary-hover">
          {initials(user)}
        </div>
        <div className="min-w-0 flex-1">
          <p className=" truncate font-semibold">{fullName(user)}</p>
          <p className="truncate text-sm text-muted">{user.email}</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleInstall}>
          <Download className="size-4" /> Instalar App
        </Button>
      </Card>

      <Card className="mb-4 divide-y divide-border md:hidden">
        <Link to="/contas" className="flex items-center gap-3 p-4">
          <Wallet className="size-5 text-primary-hover" />
          <span className="flex-1 text-sm font-medium">Contas</span>
          <ChevronRight className="size-4 text-muted" />
        </Link>
        <Link to="/cartoes" className="flex items-center gap-3 p-4">
          <CreditCard className="size-5 text-primary-hover" />
          <span className="flex-1 text-sm font-medium">Cartões de Crédito</span>
          <ChevronRight className="size-4 text-muted" />
        </Link>
        <Link to="/categorias" className="flex items-center gap-3 p-4">
          <Tags className="size-5 text-primary-hover" />
          <span className="flex-1 text-sm font-medium">Categorias</span>
          <ChevronRight className="size-4 text-muted" />
        </Link>
        <Link to="/amigos" className="flex items-center gap-3 p-4">
          <Users className="size-5 text-primary-hover" />
          <span className="flex-1 text-sm font-medium">Amigos</span>
          <ChevronRight className="size-4 text-muted" />
        </Link>
        <Link to="/grupos" className="flex items-center gap-3 p-4">
          <UsersRound className="size-5 text-primary-hover" />
          <span className="flex-1 text-sm font-medium">Grupos</span>
          <ChevronRight className="size-4 text-muted" />
        </Link>
      </Card>

      <Card className="p-4">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate({ firstName, lastName, email })
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome">
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </Field>
            <Field label="Sobrenome">
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </Field>
          </div>
          <Field label="E-mail">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Button type="submit" className="w-full" loading={save.isPending}>
            Salvar alterações
          </Button>
        </form>
      </Card>

      <div className="mt-4 space-y-2">
        <Button variant="outline" className="w-full" onClick={logout}>
          <LogOut className="size-4" /> Sair
        </Button>
        <Button variant="danger" className="w-full" onClick={() => setDeleting(true)}>
          <Trash2 className="size-4" /> Excluir minha conta
        </Button>
      </div>

      <Modal open={showInstallHelp} onClose={() => setShowInstallHelp(false)} title="Como instalar no celular">
        <div className="space-y-4 text-sm text-muted">
          <div className="flex items-start gap-3 rounded-xl bg-surface-2 p-3">
            <Smartphone className="mt-0.5 size-5 shrink-0 text-primary-hover" />
            <div>
              <p className="font-semibold text-text">No Android (Chrome)</p>
              <p>Toque nos três pontinhos (⋮) no canto superior direito do navegador e selecione <b>"Instalar aplicativo"</b> ou <b>"Adicionar à tela inicial"</b>.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-surface-2 p-3">
            <Smartphone className="mt-0.5 size-5 shrink-0 text-primary-hover" />
            <div>
              <p className="font-semibold text-text">No iPhone / iOS (Safari)</p>
              <p>Toque no ícone de <b>Compartilhar</b> (quadrado com seta para cima na barra inferior) e escolha <b>"Adicionar à Tela de Início"</b>.</p>
            </div>
          </div>
          <Button className="w-full" onClick={() => setShowInstallHelp(false)}>
            Entendi
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Excluir conta"
        message="Todos os seus dados serão removidos. Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        loading={del.isPending}
        onConfirm={() => del.mutate()}
      />
    </>
  )
}
