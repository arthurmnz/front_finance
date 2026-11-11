import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Landmark } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { Button, Card, Field, Input, PasswordInput } from '@/components/ui'

const schema = z.object({
  firstName: z.string().min(1, 'Informe o nome'),
  lastName: z.string().min(1, 'Informe o sobrenome'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo de 6 caracteres'),
})
type Form = z.infer<typeof schema>

export default function Register() {
  const nav = useNavigate()
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
          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-violet/20 border border-violet/30 text-lime shadow-[0_0_24px_rgba(125,57,235,0.35)]">
            <Landmark className="size-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Criar conta</h1>
          <p className="mt-1 text-xs text-text-muted">Comece a controlar suas finanças hoje</p>
        </div>

        <Card className="p-5">
          <form
            noValidate
            className="space-y-4"
            onSubmit={handleSubmit(async (v) => {
              setError('')
              try {
                await api.post('/auth/register', v)
                toast.success('Conta criada!')
                await login(v.email, v.password)
                nav('/')
              } catch (e) {
                setError(errorMessage(e))
              }
            })}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome" error={errors.firstName?.message}>
                <Input placeholder="Nome" {...register('firstName')} />
              </Field>
              <Field label="Sobrenome" error={errors.lastName?.message}>
                <Input placeholder="Sobrenome" {...register('lastName')} />
              </Field>
            </div>

            <Field label="E-mail" error={errors.email?.message}>
              <Input type="email" autoComplete="email" placeholder="seu@email.com" {...register('email')} />
            </Field>

            <Field label="Senha" error={errors.password?.message}>
              <PasswordInput
                autoComplete="new-password"
                placeholder="••••••••"
                {...register('password')}
              />
            </Field>

            {error && (
              <div className="flex items-center gap-1.5 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                <span className="size-1.5 rounded-full bg-danger shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" loading={isSubmitting}>
              Cadastrar
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-text-muted">
          Já tem conta?{' '}
          <Link to="/login" className="text-lime font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
