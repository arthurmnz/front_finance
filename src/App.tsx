import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/lib/auth'
import { Spinner } from '@/components/ui'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Dashboard from '@/pages/Dashboard'
import Accounts from '@/pages/Accounts'
import CreditCards from '@/pages/CreditCards'
import CreditCardDetail from '@/pages/CreditCardDetail'
import AccountDetail from '@/pages/AccountDetail'
import Transactions from '@/pages/Transactions'
import Calendar from '@/pages/Calendar'
import Categories from '@/pages/Categories'
import CategoryDetail from '@/pages/CategoryDetail'
import Friends from '@/pages/Friends'
import Groups from '@/pages/Groups'
import GroupDetail from '@/pages/GroupDetail'
import Profile from '@/pages/Profile'

function Private({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="grid min-h-dvh place-items-center"><Spinner /></div>
  return user ? <>{children}</> : <Navigate to="/login" replace />
}
function Public({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="grid min-h-dvh place-items-center"><Spinner /></div>
  return user ? <Navigate to="/" replace /> : <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Public><Login /></Public>} />
      <Route path="/cadastro" element={<Public><Register /></Public>} />
      <Route element={<Private><Layout /></Private>}>
        <Route index element={<Dashboard />} />
        <Route path="transacoes" element={<Transactions />} />
        <Route path="calendario" element={<Calendar />} />
        <Route path="contas" element={<Accounts />} />
        <Route path="contas/:id" element={<AccountDetail />} />
        <Route path="cartoes" element={<CreditCards />} />
        <Route path="cartoes/:id" element={<CreditCardDetail />} />
        <Route path="categorias" element={<Categories />} />
        <Route path="categorias/:id" element={<CategoryDetail />} />
        <Route path="amigos" element={<Friends />} />
        <Route path="grupos" element={<Groups />} />
        <Route path="grupos/:id" element={<GroupDetail />} />
        <Route path="perfil" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
