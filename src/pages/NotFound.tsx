import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Compass, Home } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Button, Card } from '@/components/ui'

interface Props {
  title?: string
  description?: string
  backTo?: string
  backLabel?: string
}

export default function NotFound({
  title = 'Página não encontrada',
  description = 'O endereço que você tentou acessar não existe, foi movido ou não está mais disponível.',
  backTo,
  backLabel = 'Voltar',
}: Props) {
  const nav = useNavigate()
  const { user } = useAuth()
  const homePath = user ? '/dashboard' : '/'

  return (
    <div className="flex min-h-[70dvh] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md p-6 text-center sm:p-8">
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-accent/15 text-accent">
          <Compass className="size-8" />
        </div>
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-accent">Erro 404</p>
        <h1 className="mt-1 text-xl font-bold text-ink-primary sm:text-2xl">{title}</h1>
        <p className="mt-2 text-xs text-ink-secondary leading-relaxed">{description}</p>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          {backTo ? (
            <Link to={backTo} className="flex-1">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="size-4" /> {backLabel}
              </Button>
            </Link>
          ) : (
            <Button variant="outline" className="flex-1" onClick={() => nav(-1)}>
              <ArrowLeft className="size-4" /> Voltar
            </Button>
          )}
          <Link to={homePath} className="flex-1">
            <Button className="w-full">
              <Home className="size-4" /> Ir para o início
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
