import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import TransactionFormModal from './TransactionFormModal'
import { LayoutDashboard, Wallet, Tags, Users, UsersRound, UserCircle, LogOut, Landmark, Plus, ArrowLeftRight, CalendarDays, CreditCard } from 'lucide-react'
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
    { to: '/calendario', label: 'Calendário', icon: CalendarDays, CreditCard },
    { to: '/contas', label: 'Contas', icon: Wallet },
    { to: '/cartoes', label: 'Cartões', icon: CreditCard },
    { to: '/categorias', label: 'Categorias', icon: Tags },
    { to: '/amigos', label: 'Amigos', icon: Users, badge: requests },
    { to: '/grupos', label: 'Grupos', icon: UsersRound, badge: invites },
    { to: '/perfil', label: 'Perfil', icon: UserCircle },
  ]
  // No mobile: 2 itens | botão de nova transação | 2 itens (Categorias, Amigos e Grupos ficam em Perfil)
  const mobileLeft = items.filter((i) => ['/', '/calendario'].includes(i.to))
  const mobileRight = items.filter((i) => ['/transacoes', '/perfil'].includes(i.to)).map((i) => (i.to === '/perfil' ? { ...i, badge: requests + invites } : i))

  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:w-64 shrink-0 flex-col border-r border-border bg-surface p-4 sticky top-0 h-dvh">
        <div className="flex items-center gap-2 px-2 py-3 text-lg font-bold"><Landmark className="size-6 text-primary" /> Finance</div>
        <nav className="mt-4 flex-1 space-y-1">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end}
              className={({ isActive }) => clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-primary/15 text-primary-hover' : 'text-muted hover:bg-surface-2 hover:text-text')}>
              <i.icon className="size-5" /> {i.label}
              {!!i.badge && <span className="ml-auto rounded-full bg-primary px-2 text-[11px] text-white">{i.badge}</span>}
            </NavLink>
          ))}
        </nav>
        {user && (
          <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
            <div className="grid size-9 place-items-center rounded-full bg-primary/20 text-xs font-bold text-primary-hover">{initials(user)}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{fullName(user)}</p><p className="truncate text-xs text-muted">{user.email}</p></div>
            <button onClick={logout} title="Sair" className="rounded-lg p-2 text-muted hover:text-expense"><LogOut className="size-4" /></button>
          </div>
        )}
      </aside>

      <main className="min-w-0 flex-1 px-4 pt-5 pb-28 md:px-8 md:pb-10">
        <div className="mx-auto max-w-4xl"><Outlet /></div>
      </main>

      {/* Bottom nav mobile */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex items-end border-t border-border bg-surface/95 backdrop-blur md:hidden">
        {mobileLeft.map(MobileItem)}
        <div className="flex flex-1 justify-center">
          <button onClick={() => setAdding(true)} aria-label="Nova transação"
            className="-mt-7 mb-2 grid size-16 place-items-center rounded-full bg-primary text-white shadow-lg shadow-primary/40 ring-4 ring-bg transition active:scale-95">
            <Plus className="size-8" strokeWidth={2.5} />
          </button>
        </div>
        {mobileRight.map(MobileItem)}
      </nav>
      <TransactionFormModal open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

function MobileItem(i: { to: string; label: string; icon: React.ComponentType<{ className?: string }>; end?: boolean; badge?: number }) {
  return (
    <NavLink key={i.to} to={i.to} end={i.end}
      className={({ isActive }) => clsx('relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium', isActive ? 'text-primary-hover' : 'text-muted')}>
      <i.icon className="size-5" />{i.label}
      {!!i.badge && <span className="absolute right-1/4 top-1.5 size-2 rounded-full bg-primary" />}
    </NavLink>
  )
}
