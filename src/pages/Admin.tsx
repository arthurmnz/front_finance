import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShieldCheck,
  Users,
  Wallet,
  CreditCard as CardIcon,
  ArrowLeftRight,
  UserX,
  UserCheck,
  Trash2,
  RefreshCw,
  Search,
  AlertTriangle,
  TrendingUp,
  Activity,
  Layers,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'
import clsx from 'clsx'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { AdminMetrics, AdminUserSummary } from '@/lib/types'
import { formatDate } from '@/lib/format'
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Spinner } from '@/components/ui'

export default function Admin() {
  const { user: currentUser } = useAuth()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'BLOCKED' | 'ADMIN'>('ALL')
  const [deletingUser, setDeletingUser] = useState<AdminUserSummary | null>(null)
  const [togglingUser, setTogglingUser] = useState<AdminUserSummary | null>(null)

  // 1. Queries de Métricas e Usuários
  const metricsQuery = useQuery({
    queryKey: ['admin', 'metrics'],
    queryFn: () => api.get<AdminMetrics>('/admin/metrics').then((r) => r.data),
  })

  const usersQuery = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get<AdminUserSummary[]>('/admin/users').then((r) => r.data),
  })

  // 2. Mutations
  const toggleStatusMutation = useMutation({
    mutationFn: (userId: string) => api.patch(`/admin/users/${userId}/toggle-status`),
    onSuccess: () => {
      toast.success('Status do usuário atualizado com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      setTogglingUser(null)
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Erro ao alterar status do usuário.'
      toast.error(msg)
      setTogglingUser(null)
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/admin/users/${userId}`),
    onSuccess: () => {
      toast.success('Usuário e todos os seus dados foram permanentemente excluídos!')
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      setDeletingUser(null)
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Erro ao excluir usuário.'
      toast.error(msg)
      setDeletingUser(null)
    },
  })

  const handleRefresh = () => {
    metricsQuery.refetch()
    usersQuery.refetch()
    toast.info('Dados administrativos atualizados.')
  }

  // 3. Filtragem de Usuários
  const users = usersQuery.data ?? []
  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase()
    return users.filter((u) => {
      const matchesSearch =
        !term ||
        u.firstName.toLowerCase().includes(term) ||
        u.lastName.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term)

      if (!matchesSearch) return false

      if (statusFilter === 'ACTIVE') return u.isActive
      if (statusFilter === 'BLOCKED') return !u.isActive
      if (statusFilter === 'ADMIN') return u.role === 'ADMIN'

      return true
    })
  }, [users, search, statusFilter])

  const metrics = metricsQuery.data

  return (
    <div className="space-y-8 pb-12">
      {/* Header com Ação de Atualizar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Painel de Administração"
          subtitle="Controle de usuários, segurança do sistema, métricas operacionais e integridade"
        />
        <div className="flex items-center gap-2">
          <Badge tone="primary" className="flex items-center gap-1.5 px-3 py-1 font-semibold">
            <ShieldCheck className="size-3.5 text-lime" />
            Modo Administrador
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={metricsQuery.isFetching || usersQuery.isFetching}
            className="flex items-center gap-1.5"
          >
            <RefreshCw
              className={clsx('size-3.5', (metricsQuery.isFetching || usersQuery.isFetching) && 'animate-spin')}
            />
            Atualizar
          </Button>
        </div>
      </div>

      {metricsQuery.isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner />
        </div>
      ) : metrics ? (
        <>
          {/* Grid de KPIs do Sistema */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* KPI 1: Usuários */}
            <Card className="p-4 bg-surface-1 border-border flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-text-dim mb-1">
                  <span className="font-medium">Total de Usuários</span>
                  <div className="p-1.5 rounded-lg bg-violet/15 text-violet">
                    <Users className="size-4" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-white tabular-nums tracking-tight">
                  {metrics.totalUsers}
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-lime font-medium">
                    {metrics.activeUsers} ativos
                  </span>
                  <span className="text-text-dim">·</span>
                  <span className={clsx(metrics.blockedUsers > 0 ? 'text-expense font-semibold' : 'text-text-dim')}>
                    {metrics.blockedUsers} bloqueados
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-2.5 border-t border-border/60 text-[11px] text-text-dim flex justify-between">
                <span>+ {metrics.newUsersLast7Days} nos últimos 7d</span>
                <span>+ {metrics.newUsersLast30Days} nos 30d</span>
              </div>
            </Card>

            {/* KPI 2: Volume de Transações */}
            <Card className="p-4 bg-surface-1 border-border flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-text-dim mb-1">
                  <span className="font-medium">Volume Operacional</span>
                  <div className="p-1.5 rounded-lg bg-lime/10 text-lime">
                    <ArrowLeftRight className="size-4" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-white tabular-nums tracking-tight">
                  {metrics.totalTransactions}
                </p>
                <p className="mt-2 text-xs text-text-dim">
                  Transações registradas em todas as contas e cartões
                </p>
              </div>
              <div className="mt-4 pt-2.5 border-t border-border/60 text-[11px] text-text-dim flex items-center gap-1.5">
                <Activity className="size-3 text-lime" />
                <span>Fluxo de movimentações contínuo</span>
              </div>
            </Card>

            {/* KPI 3: Estrutura Financeira */}
            <Card className="p-4 bg-surface-1 border-border flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-text-dim mb-1">
                  <span className="font-medium">Estrutura Financeira</span>
                  <div className="p-1.5 rounded-lg bg-surface-2 text-text-muted">
                    <Layers className="size-4" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-white tabular-nums tracking-tight">
                  {metrics.totalAccounts + metrics.totalCreditCards}
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs text-text-dim">
                  <span className="flex items-center gap-1">
                    <Wallet className="size-3 text-lime" />
                    {metrics.totalAccounts} contas
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <CardIcon className="size-3 text-violet" />
                    {metrics.totalCreditCards} cartões
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-2.5 border-t border-border/60 text-[11px] text-text-dim">
                <span>Contas bancárias e cartões ativos</span>
              </div>
            </Card>

            {/* KPI 4: Grupos */}
            <Card className="p-4 bg-surface-1 border-border flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-text-dim mb-1">
                  <span className="font-medium">Colaboração & Grupos</span>
                  <div className="p-1.5 rounded-lg bg-violet/15 text-violet">
                    <TrendingUp className="size-4" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-white tabular-nums tracking-tight">
                  {metrics.totalGroups}
                </p>
                <p className="mt-2 text-xs text-text-dim">
                  Grupos de rateio e finanças compartilhadas
                </p>
              </div>
              <div className="mt-4 pt-2.5 border-t border-border/60 text-[11px] text-text-dim flex justify-between">
                <span>{metrics.adminUsers} administrador(es)</span>
                <span className="text-lime">Sistema estável</span>
              </div>
            </Card>
          </div>

          {/* Gráfico de Crescimento Mensal */}
          {metrics.monthlyGrowth.length > 0 && (
            <Card className="p-5 bg-surface-1 border-border">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <TrendingUp className="size-4 text-violet" />
                    Crescimento do Sistema (Últimos 6 Meses)
                  </h3>
                  <p className="text-xs text-text-dim">
                    Novos usuários e transações processadas mês a mês
                  </p>
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.monthlyGrowth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="#8E8EA0"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#8E8EA0"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#171717',
                        borderColor: '#262626',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                      }}
                      labelStyle={{ color: '#FFFFFF', fontWeight: 600 }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar
                      dataKey="usersCount"
                      name="Novos Usuários"
                      fill="#8B5CF6"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="transactionsCount"
                      name="Transações"
                      fill="#84CC16"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </>
      ) : null}

      {/* Seção de Gerenciamento de Usuários */}
      <Card className="p-5 bg-surface-1 border-border space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Users className="size-4 text-lime" />
              Controle de Usuários ({filteredUsers.length})
            </h3>
            <p className="text-xs text-text-dim">
              Pesquise, visualize dados cadastrais, alterne bloqueios e gerencie acessos
            </p>
          </div>

          {/* Filtros e Busca */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-dim" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou email..."
                className="pl-8 text-xs h-9"
              />
            </div>

            <div className="inline-flex rounded-lg bg-surface-2 p-0.5 border border-border">
              {(
                [
                  { key: 'ALL', label: 'Todos' },
                  { key: 'ACTIVE', label: 'Ativos' },
                  { key: 'BLOCKED', label: 'Bloqueados' },
                  { key: 'ADMIN', label: 'Admins' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={clsx(
                    'px-2.5 py-1 text-xs font-semibold rounded-md transition select-none',
                    statusFilter === tab.key
                      ? 'bg-violet text-white shadow-sm'
                      : 'text-text-dim hover:text-white',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabela de Usuários */}
        {usersQuery.isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner />
          </div>
        ) : filteredUsers.length === 0 ? (
          <Empty title="Nenhum usuário encontrado com os filtros aplicados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-text-dim">
                <tr>
                  <th className="pb-3 font-medium">Usuário</th>
                  <th className="pb-3 font-medium">Papel</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Cadastro</th>
                  <th className="pb-3 font-medium">Uso no Sistema</th>
                  <th className="pb-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredUsers.map((u) => {
                  const isSelf = currentUser?.id === u.id
                  const initialLetters = `${u.firstName[0] || ''}${u.lastName[0] || ''}`.toUpperCase()

                  return (
                    <tr key={u.id} className="hover:bg-surface-2/40 transition">
                      {/* Usuário */}
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2.5">
                          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-violet/20 font-bold text-violet text-xs">
                            {initialLetters}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate flex items-center gap-1.5">
                              {u.firstName} {u.lastName}
                              {isSelf && (
                                <span className="rounded bg-surface-3 px-1 py-0.2 text-[9px] font-bold text-lime">
                                  Você
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-text-dim truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Papel */}
                      <td className="py-3 pr-3">
                        <Badge tone={u.role === 'ADMIN' ? 'primary' : 'neutral'}>
                          {u.role === 'ADMIN' ? 'Administrador' : 'Usuário'}
                        </Badge>
                      </td>

                      {/* Status */}
                      <td className="py-3 pr-3">
                        <span
                          className={clsx(
                            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold',
                            u.isActive
                              ? 'bg-lime/10 text-lime border border-lime/20'
                              : 'bg-expense/10 text-expense border border-expense/20',
                          )}
                        >
                          <span
                            className={clsx('size-1.5 rounded-full', u.isActive ? 'bg-lime' : 'bg-expense')}
                          />
                          {u.isActive ? 'Ativo' : 'Bloqueado'}
                        </span>
                      </td>

                      {/* Data de Cadastro */}
                      <td className="py-3 pr-3 text-text-dim tabular-nums">
                        {formatDate(u.createdAt)}
                      </td>

                      {/* Contagens de Uso */}
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2 text-text-dim text-[11px] tabular-nums">
                          <span title={`${u.accountsCount} contas bancárias`} className="flex items-center gap-1">
                            <Wallet className="size-3 text-text-muted" /> {u.accountsCount}
                          </span>
                          <span>·</span>
                          <span title={`${u.creditCardsCount} cartões de crédito`} className="flex items-center gap-1">
                            <CardIcon className="size-3 text-text-muted" /> {u.creditCardsCount}
                          </span>
                          <span>·</span>
                          <span title={`${u.groupsCount} grupos`} className="flex items-center gap-1">
                            <Users className="size-3 text-text-muted" /> {u.groupsCount}
                          </span>
                          <span>·</span>
                          <span title={`${u.transactionsCount} transações`} className="flex items-center gap-1">
                            <ArrowLeftRight className="size-3 text-text-muted" /> {u.transactionsCount}
                          </span>
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botão Bloquear / Desbloquear */}
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isSelf || toggleStatusMutation.isPending}
                            onClick={() => setTogglingUser(u)}
                            className={clsx(
                              'h-8 px-2 text-xs',
                              u.isActive
                                ? 'text-text-muted hover:text-expense hover:bg-expense/10'
                                : 'text-lime hover:bg-lime/10',
                            )}
                            title={
                              isSelf
                                ? 'Você não pode bloquear a si mesmo'
                                : u.isActive
                                  ? 'Bloquear acesso do usuário'
                                  : 'Reativar acesso do usuário'
                            }
                          >
                            {u.isActive ? (
                              <UserX className="size-3.5 mr-1 text-expense" />
                            ) : (
                              <UserCheck className="size-3.5 mr-1 text-lime" />
                            )}
                            {u.isActive ? 'Bloquear' : 'Reativar'}
                          </Button>

                          {/* Botão Excluir */}
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isSelf || deleteUserMutation.isPending}
                            onClick={() => setDeletingUser(u)}
                            className="h-8 px-2 text-xs text-text-muted hover:text-expense hover:bg-expense/10"
                            title={isSelf ? 'Você não pode excluir a si mesmo' : 'Excluir usuário permanentemente'}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal de Confirmação de Bloqueio/Desbloqueio */}
      <Modal
        open={Boolean(togglingUser)}
        onClose={() => setTogglingUser(null)}
        title={togglingUser?.isActive ? 'Bloquear Usuário' : 'Reativar Usuário'}
      >
        {togglingUser && (
          <div className="space-y-4">
            <p className="text-xs text-text-dim">
              {togglingUser.isActive ? (
                <>
                  Tem certeza que deseja bloquear o acesso de{' '}
                  <strong className="text-white">{togglingUser.firstName} {togglingUser.lastName}</strong> (
                  {togglingUser.email})? O usuário perderá o acesso imediato ao aplicativo e qualquer sessão ativa será
                  encerrada.
                </>
              ) : (
                <>
                  Deseja restabelecer o acesso de{' '}
                  <strong className="text-white">{togglingUser.firstName} {togglingUser.lastName}</strong> (
                  {togglingUser.email})? O usuário poderá efetuar login normalmente.
                </>
              )}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setTogglingUser(null)}>
                Cancelar
              </Button>
              <Button
                variant={togglingUser.isActive ? 'danger' : 'primary'}
                disabled={toggleStatusMutation.isPending}
                onClick={() => toggleStatusMutation.mutate(togglingUser.id)}
              >
                {togglingUser.isActive ? 'Confirmar Bloqueio' : 'Confirmar Reativação'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Confirmação de Exclusão Permanente */}
      <Modal
        open={Boolean(deletingUser)}
        onClose={() => setDeletingUser(null)}
        title="Excluir Usuário Permanentemente"
      >
        {deletingUser && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-expense/10 border border-expense/20 text-expense">
              <AlertTriangle className="size-5 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold text-white">Esta ação é irreversível!</p>
                <p className="text-text-muted">
                  Ao excluir o usuário <strong className="text-white">{deletingUser.firstName} {deletingUser.lastName}</strong>,
                  todas as suas contas, cartões, categorias, grupos de que é proprietário e todo o histórico de transações
                  vinculadas serão permanentemente apagados do banco de dados.
                </p>
              </div>
            </div>

            <p className="text-xs text-text-dim">
              Confirma a exclusão de <strong className="text-white">{deletingUser.email}</strong>?
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setDeletingUser(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                disabled={deleteUserMutation.isPending}
                onClick={() => deleteUserMutation.mutate(deletingUser.id)}
              >
                {deleteUserMutation.isPending ? 'Excluindo...' : 'Sim, Excluir Definitivamente'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
