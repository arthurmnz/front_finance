import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, KeyRound, Mail } from 'lucide-react'
import { api, errorMessage } from '@/lib/api'
import { Button, Card, Field, Input } from '@/components/ui'

const schema = z.object({
  email: z.string().min(1, 'Informe o e-mail').email('E-mail inválido'),
})
type Form = z.infer<typeof schema>

export default function ForgotPassword() {
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) })

  return (
    <div className="grid min-h-dvh place-items-center p-5 bg-black text-white">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-violet/20 border border-violet/30 text-lime shadow-[0_0_24px_rgba(125,57,235,0.35)]">
            <KeyRound className="size-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Recuperar senha</h1>
          <p className="mt-1 text-xs text-text-muted">
            Informe seu e-mail para receber as instruções de redefinição
          </p>
        </div>

        {submitted ? (
          <Card className="p-6 text-center space-y-4">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-lime-subtle text-lime">
              <CheckCircle2 className="size-7" />
            </div>
            <h2 className="text-lg font-bold text-white">Solicitação enviada!</h2>
            <p className="text-xs text-text-muted leading-relaxed">
              Se o e-mail informado estiver cadastrado, você receberá um link para redefinição de senha em instantes.
            </p>
            <p className="text-[11px] text-text-dim">
              Lembre-se de verificar sua caixa de entrada e a pasta de spam. O link expira em 30 minutos.
            </p>
            <div className="pt-2">
              <Link to="/login" className="block">
                <Button variant="outline" className="w-full">
                  Voltar para o login
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <Card className="p-5">
            <form
              noValidate
              className="space-y-4"
              onSubmit={handleSubmit(async (v) => {
                setError('')
                try {
                  await api.post('/auth/forgot-password', { email: v.email.trim().toLowerCase() })
                  setSubmitted(true)
                } catch (e) {
                  setError(errorMessage(e))
                }
              })}
            >
              <Field label="E-mail cadastrado" error={errors.email?.message}>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="exemplo@email.com"
                  {...register('email')}
                />
              </Field>

              {error && (
                <div className="flex items-center gap-1.5 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                  <span className="size-1.5 rounded-full bg-danger shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" className="w-full" loading={isSubmitting}>
                <Mail className="size-4" />
                Enviar link de recuperação
              </Button>
            </form>
          </Card>
        )}

        <p className="text-center text-xs text-text-muted">
          Lembrou a senha?{' '}
          <Link to="/login" className="text-lime font-medium hover:underline">
            Voltar para o login
          </Link>
        </p>
      </div>
    </div>
  )
}
