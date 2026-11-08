import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import TransactionFormModal from './TransactionFormModal'
import {
  LayoutDashboard,
  Wallet,
  Tags,
  Users,
  UsersRound,
  UserCircle,
  LogOut,
  Landmark,
  Plus,
  ArrowLeftRight,
  BarChart3,
  CreditCard,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '@/lib/auth'
import { fullName, initials } from '@/lib/format'
import { useGroupInvitations, usePendingReceived } from '@/lib/hooks'

export default function Layout() {
  const { user, logout } = useAuth()
  const invites = useGroupInvitations().data?.length ?? 0
  const requests = usePendingReceived().data?.length ?? 0

  const [adding, setAdding] = useState(false)

  const items = [
    { to: '/', label: 'Início', icon: LayoutDashboard, end: true },
    { to: '/transacoes', label: 'Transações', icon: ArrowLeftRight },
    { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
    { to: '/contas', label: 'Contas', icon: Wallet },
    { to: '/cartoes', label: 'Cartões', icon: CreditCard },
    { to: '/categorias', label: 'Categorias', icon: Tags },
    { to: '/amigos', label: 'Amigos', icon: Users, badge: requests },
    { to: '/grupos', label: 'Grupos', icon: UsersRound, badge: invites },
    { to: '/perfil', label: 'Perfil', icon: UserCircle },
  ]

  // No mobile: 2 itens | botão de nova transação | 2 itens
  const mobileLeft = items.filter((i) => ['/', '/relatorios'].includes(i.to))
  const mobileRight = items
    .filter((i) => ['/transacoes', '/perfil'].includes(i.to))
    .map((i) => (i.to === '/perfil' ? { ...i, badge: requests + invites } : i))

  return (
    <div className="min-h-dvh md:flex bg-black text-white">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:w-64 shrink-0 flex-col border-r border-border bg-surface p-4 sticky top-0 h-dvh">
        <div className="flex items-center gap-2.5 px-2 py-3 text-lg font-bold tracking-tight text-white">
          <div className="grid size-9 place-items-center rounded-xl bg-violet/20 text-lime">
            <Landmark className="size-5" />
          </div>
          Finance
        </div>

        <nav className="mt-5 flex-1 space-y-1">
          {items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-violet/15 text-white font-semibold'
                    : 'text-text-muted hover:bg-surface-2 hover:text-white',
                )
              }
            >
              <i.icon className="size-5 shrink-0" /> {i.label}
              {!!i.badge && (
                <span className="ml-auto rounded-full bg-violet px-2 py-0.5 text-[11px] font-bold text-white">
                  {i.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {user && (
          <div className="flex items-center gap-3 rounded-2xl bg-surface-1 border border-border p-3">
            <div className="grid size-9 place-items-center rounded-full bg-violet/20 text-xs font-bold text-violet-hover">
              {initials(user)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{fullName(user)}</p>
              <p className="truncate text-xs text-text-dim">{user.email}</p>
            </div>
            <button
              onClick={logout}
              title="Sair"
              className="rounded-lg p-2 text-text-muted hover:bg-surface-2 hover:text-white transition"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        )}
      </aside>

      <main className="min-w-0 flex-1 px-4 pt-6 pb-28 md:px-8 md:pb-10">
        <div className="mx-auto max-w-4xl">
          <Outlet />
        </div>
      </main>

      {/* Bottom nav mobile */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex items-end border-t border-border bg-black/95 backdrop-blur-md md:hidden">
        {mobileLeft.map(MobileItem)}
        <div className="flex flex-1 justify-center">
          <button
            onClick={() => setAdding(true)}
            aria-label="Nova transação"
            className="-mt-7 mb-2 grid size-14 place-items-center rounded-full bg-violet text-white shadow-xl shadow-violet/40 ring-4 ring-black transition active:scale-95 hover:bg-violet-hover"
          >
            <Plus className="size-7" strokeWidth={2.5} />
          </button>
        </div>
        {mobileRight.map(MobileItem)}
      </nav>

      <TransactionFormModal open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

function MobileItem(i: {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  end?: boolean
  badge?: number
}) {
  return (
    <NavLink
      key={i.to}
      to={i.to}
      end={i.end}
      className={({ isActive }) =>
        clsx(
          'relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition',
          isActive ? 'text-lime font-semibold' : 'text-text-muted hover:text-white',
        )
      }
    >
      <i.icon className="size-5 shrink-0" />
      {i.label}
      {!!i.badge && (
        <span className="absolute right-1/4 top-1.5 size-2 rounded-full bg-lime" />
      )}
    </NavLink>
  )
}
