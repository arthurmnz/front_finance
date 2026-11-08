import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/lib/auth'
import { DetailSkeleton } from '@/components/ui'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import Dashboard from '@/pages/Dashboard'
import Accounts from '@/pages/Accounts'
import CreditCards from '@/pages/CreditCards'
import CreditCardDetail from '@/pages/CreditCardDetail'
import AccountDetail from '@/pages/AccountDetail'
import Transactions from '@/pages/Transactions'
import Reports from '@/pages/Reports'
import Categories from '@/pages/Categories'
import CategoryDetail from '@/pages/CategoryDetail'
import Friends from '@/pages/Friends'
import Groups from '@/pages/Groups'
import GroupDetail from '@/pages/GroupDetail'
import Profile from '@/pages/Profile'
import Admin from '@/pages/Admin'
import NotFound from '@/pages/NotFound'

function Private({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="mx-auto max-w-5xl p-4 sm:p-6"><DetailSkeleton /></div>
  return user ? <>{children}</> : <Navigate to="/login" replace />
}
function Public({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="mx-auto max-w-md p-6"><DetailSkeleton /></div>
  return user ? <Navigate to="/" replace /> : <>{children}</>
}
function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="mx-auto max-w-5xl p-4 sm:p-6"><DetailSkeleton /></div>
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'ADMIN') return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Public><Login /></Public>} />
      <Route path="/cadastro" element={<Public><Register /></Public>} />
      <Route path="/esqueci-senha" element={<Public><ForgotPassword /></Public>} />
      <Route path="/redefinir-senha" element={<Public><ResetPassword /></Public>} />
      <Route element={<Private><Layout /></Private>}>
        <Route index element={<Dashboard />} />
        <Route path="transacoes" element={<Transactions />} />
        <Route path="relatorios" element={<Reports />} />
        <Route path="calendario" element={<Navigate to="/relatorios" replace />} />
        <Route path="contas" element={<Accounts />} />
        <Route path="contas/:id" element={<AccountDetail />} />
        <Route path="cartoes" element={<CreditCards />} />
        <Route path="cartoes/:id" element={<CreditCardDetail />} />
        <Route path="categorias" element={<Categories />} />
        <Route path="categorias/:id" element={<CategoryDetail />} />
        <Route path="amigos" element={<Friends />} />
        <Route path="grupos" element={<Groups />} />
        <Route path="grupos/:id" element={<GroupDetail />} />
        <Route path="grupos/:id/relatorios" element={<GroupDetail />} />
        <Route path="perfil" element={<Profile />} />
        <Route path="admin" element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
