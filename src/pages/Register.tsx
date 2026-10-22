import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Landmark } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { Button, Field, Input } from '@/components/ui'

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
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) })

  return (
    <div className="grid min-h-dvh place-items-center p-5">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Landmark className="mx-auto size-10 text-primary" />
          <h1 className="mt-3 text-2xl font-bold">Criar conta</h1>
        </div>
        <form className="space-y-4 rounded-2xl border border-border bg-surface p-5"
          onSubmit={handleSubmit(async (v) => {
            setError('')
            try {
              await api.post('/auth/register', v)
              toast.success('Conta criada!')
              await login(v.email, v.password)
              nav('/')
            } catch (e) { setError(errorMessage(e)) }
          })}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome" error={errors.firstName?.message}><Input {...register('firstName')} /></Field>
            <Field label="Sobrenome" error={errors.lastName?.message}><Input {...register('lastName')} /></Field>
          </div>
          <Field label="E-mail" error={errors.email?.message}><Input type="email" autoComplete="email" {...register('email')} /></Field>
          <Field label="Senha" error={errors.password?.message}><Input type="password" autoComplete="new-password" {...register('password')} /></Field>
          {error && <p className="rounded-lg bg-expense/10 p-2 text-sm text-expense">{error}</p>}
          <Button type="submit" className="w-full" loading={isSubmitting}>Cadastrar</Button>
        </form>
        <p className="text-center text-sm text-muted">Já tem conta? <Link to="/login" className="text-primary-hover hover:underline">Entrar</Link></p>
      </div>
    </div>
  )
}
