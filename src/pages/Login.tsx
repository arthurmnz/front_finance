import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { BrandLogo } from '@/components/BrandLogo'
import { useAuth } from '@/lib/auth'
import { errorMessage } from '@/lib/api'
import { Button, Card, Field, Input, PasswordInput } from '@/components/ui'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
})
type Form = z.infer<typeof schema>

export default function Login() {
  const { login } = useAuth()
  const [error, setError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) })

  return (
    <div className="grid min-h-dvh place-items-center p-5 bg-canvas text-ink-primary">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-flex flex-col items-center gap-2 transition hover:opacity-90">
            <BrandLogo className="mx-auto size-16 drop-shadow-[0_0_24px_rgba(251,191,36,0.35)]" />
            <span className="font-display text-sm tracking-wider text-ink-primary">Finance</span>
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink-primary">Bem-vindo de volta</h1>
          <p className="mt-1 text-xs text-ink-secondary">Entre para controlar suas finanças</p>
        </div>

        <Card className="p-5">
          <form
            noValidate
            className="space-y-4"
            onSubmit={handleSubmit(async (v) => {
              setError('')
              try {
                await login(v.email, v.password)
              } catch (e) {
                setError(errorMessage(e))
              }
            })}
          >
            <Field label="E-mail" error={errors.email?.message}>
              <Input type="email" autoComplete="email" placeholder="seu@email.com" {...register('email')} />
            </Field>

            <div>
              <Field label="Senha" error={errors.password?.message}>
                <PasswordInput
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register('password')}
                />
              </Field>
              <div className="mt-1.5 flex justify-end">
                <Link to="/esqueci-senha" className="text-xs text-ink-secondary hover:text-accent transition">
                  Esqueceu a senha?
                </Link>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-1.5 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                <span className="size-1.5 rounded-full bg-danger shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" loading={isSubmitting}>
              Entrar
            </Button>
          </form>
        </Card>

        <div className="space-y-2 text-center text-xs text-ink-secondary">
          <p>
            Não tem conta?{' '}
            <Link to="/cadastro" className="text-accent font-medium hover:underline">
              Cadastre-se
            </Link>
          </p>
          <p>
            <Link to="/" className="text-ink-secondary hover:text-ink-primary transition">
              ← Voltar para a página inicial
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
