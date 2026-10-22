import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Landmark } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { errorMessage } from '@/lib/api'
import { Button, Field, Input } from '@/components/ui'

const schema = z.object({ email: z.string().email('E-mail inválido'), password: z.string().min(1, 'Informe a senha') })
type Form = z.infer<typeof schema>

export default function Login() {
  const { login } = useAuth()
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) })

  return (
    <div className="grid min-h-dvh place-items-center p-5">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Landmark className="mx-auto size-10 text-primary" />
          <h1 className="mt-3 text-2xl font-bold">Bem-vindo de volta</h1>
          <p className="text-sm text-muted">Entre para controlar suas finanças</p>
        </div>
        <form className="space-y-4 rounded-2xl border border-border bg-surface p-5"
          onSubmit={handleSubmit(async (v) => { setError(''); try { await login(v.email, v.password) } catch (e) { setError(errorMessage(e)) } })}>
          <Field label="E-mail" error={errors.email?.message}><Input type="email" autoComplete="email" {...register('email')} /></Field>
          <Field label="Senha" error={errors.password?.message}><Input type="password" autoComplete="current-password" {...register('password')} /></Field>
          {error && <p className="rounded-lg bg-expense/10 p-2 text-sm text-expense">{error}</p>}
          <Button type="submit" className="w-full" loading={isSubmitting}>Entrar</Button>
        </form>
        <p className="text-center text-sm text-muted">Não tem conta? <Link to="/cadastro" className="text-primary-hover hover:underline">Cadastre-se</Link></p>
      </div>
    </div>
  )
}
