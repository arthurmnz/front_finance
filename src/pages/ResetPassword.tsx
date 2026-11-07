import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle, KeyRound, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '@/lib/api'
import { Button, Card, Field, PasswordInput } from '@/components/ui'

const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'A senha deve ter no mínimo 8 caracteres.')
      .max(128, 'A senha deve ter no máximo 128 caracteres.')
      .regex(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiúscula.')
      .regex(/[a-z]/, 'A senha deve conter pelo menos uma letra minúscula.')
      .regex(/[0-9]/, 'A senha deve conter pelo menos um número.')
      .regex(/[^a-zA-Z0-9]/, 'A senha deve conter pelo menos um caractere especial.'),
    confirmPassword: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  })

type Form = z.infer<typeof schema>

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  // Guarda o token no estado local em memória
  const [token] = useState(() => searchParams.get('token')?.trim() || '')
  const navigate = useNavigate()
  const [error, setError] = useState('')

  // Limpa a query string da URL imediatamente para não expor o token no histórico
  useEffect(() => {
    if (token && window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [token])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) })

  if (!token) {
    return (
      <div className="grid min-h-dvh place-items-center p-5 bg-black text-white">
        <div className="w-full max-w-sm space-y-6">
          <Card className="p-6 text-center space-y-4">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-surface-2 text-text-muted">
              <ShieldAlert className="size-6" />
            </div>
            <h1 className="text-xl font-bold text-white">Link inválido ou ausente</h1>
            <p className="text-xs text-text-muted leading-relaxed">
              O link de redefinição de senha está incompleto ou expirou. Por favor, solicite um novo link de recuperação.
            </p>
            <div className="pt-2">
              <Link to="/esqueci-senha" className="block">
                <Button className="w-full">Solicitar novo link</Button>
              </Link>
            </div>
            <div>
              <Link to="/login" className="text-xs text-text-dim hover:text-white transition">
                Voltar para o login
              </Link>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-h-dvh place-items-center p-5 bg-black text-white">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-violet/20 text-lime">
            <KeyRound className="size-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Criar nova senha</h1>
          <p className="mt-1 text-xs text-text-muted">
            Defina uma nova senha segura para a sua conta
          </p>
        </div>

        <Card className="p-5">
          <form
            noValidate
            className="space-y-4"
            onSubmit={handleSubmit(async (v) => {
              setError('')
              try {
                const res = await api.post<{ message: string }>('/auth/reset-password', {
                  token,
                  newPassword: v.newPassword,
                })
                toast.success(res.data?.message || 'Senha redefinida com sucesso! Faça login.')
                navigate('/login', { replace: true })
              } catch (e) {
                setError(errorMessage(e))
              }
            })}
          >
            <Field
              label="Nova senha"
              error={errors.newPassword?.message}
              hint="Mín. 8 caracteres, maiúscula, minúscula, número e símbolo"
            >
              <PasswordInput
                autoComplete="new-password"
                placeholder="••••••••"
                {...register('newPassword')}
              />
            </Field>

            <Field label="Confirmar nova senha" error={errors.confirmPassword?.message}>
              <PasswordInput
                autoComplete="new-password"
                placeholder="••••••••"
                {...register('confirmPassword')}
              />
            </Field>

            {error && (
              <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-surface-2 px-3 py-2 text-xs text-lime">
                <span className="size-1 rounded-full bg-lime shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" loading={isSubmitting}>
              <CheckCircle className="size-4" />
              Salvar nova senha
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-text-muted">
          Lembrou sua senha antiga?{' '}
          <Link to="/login" className="text-lime font-medium hover:underline">
            Voltar para o login
          </Link>
        </p>
      </div>
    </div>
  )
}
