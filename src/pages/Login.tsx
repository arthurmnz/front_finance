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
    <div className="grid min-h-dvh place-items-center p-5 bg-black text-white">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <BrandLogo className="mx-auto mb-3 size-16 drop-shadow-[0_0_24px_rgba(125,57,235,0.45)]" />
          <h1 className="text-2xl font-bold tracking-tight text-white">Bem-vindo de volta</h1>
          <p className="mt-1 text-xs text-text-muted">Entre para controlar suas finanças</p>
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
                <Link to="/esqueci-senha" className="text-xs text-text-muted hover:text-lime transition">
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

        <p className="text-center text-xs text-text-muted">
          Não tem conta?{' '}
          <Link to="/cadastro" className="text-lime font-medium hover:underline">
            Cadastre-se
          </Link>
        </p>
      </div>
    </div>
  )
}
