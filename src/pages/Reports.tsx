import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ExternalLink, User, Users } from 'lucide-react'
import clsx from 'clsx'
import { Button, Card, Field, Modal, MoneyInput, PageHeader, Select, Spinner } from '@/components/ui'
import { currentPeriod } from '@/components/MonthPicker'
import { useAuth } from '@/lib/auth'
import { useGroups } from '@/lib/hooks'
import ReportFilters from '@/components/reports/ReportFilters'
import KpiSection from '@/components/reports/KpiSection'
import FinancialPlanningSection from '@/components/reports/FinancialPlanningSection'
import CalendarFlowSection from '@/components/reports/CalendarFlowSection'
import CashFlowSection from '@/components/reports/CashFlowSection'
import CategoryEvolutionSection from '@/components/reports/CategoryEvolutionSection'
import FutureCommitmentsSection from '@/components/reports/FutureCommitmentsSection'
import SpendingHabitsSection from '@/components/reports/SpendingHabitsSection'
import GroupSharedSection from '@/components/reports/GroupSharedSection'
import GroupReportsView from '@/components/reports/GroupReportsView'
import { useIndividualReportsData, useSimulations, useWarningThreshold } from '@/components/reports/useReportsData'
import type { ReportFiltersState } from '@/components/reports/types'

export default function Reports() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const groupsQuery = useGroups()
  const groups = groupsQuery.data ?? []

  const scope = (searchParams.get('scope') as 'individual' | 'group') || 'individual'
  const queryGroupId = searchParams.get('groupId') || ''
  const selectedGroupId = queryGroupId || groups[0]?.id || ''

  // Estado dos filtros individuais
  const [threshold, setThreshold] = useWarningThreshold(user?.id)
  const { simulations, addSimulation, removeSimulation, clearSimulations } = useSimulations(user?.id)
  const [configuringThreshold, setConfiguringThreshold] = useState(false)
  const [draftThreshold, setDraftThreshold] = useState(threshold)
  const [showFilters, setShowFilters] = useState(false)
  const [windowMonths, setWindowMonths] = useState<6 | 12>(6)

  const [filters, setFilters] = useState<ReportFiltersState>({
    period: currentPeriod(),
    accountId: '',
    creditCardId: '',
    hideCreditCards: false,
    categoryId: '',
    status: '',
  })

  const {
    loading,
    accounts,
    allAccounts,
    creditCards,
    categories,
    projection,
    kpis,
    financialPlanning,
    cashFlowHistory,
    categoryEvolution,
    futureCommitments,
    spendingHabits,
    sharedGroupBalance,
  } = useIndividualReportsData(filters, threshold, windowMonths, simulations)

  const handleScopeChange = (newScope: 'individual' | 'group') => {
    const params = new URLSearchParams(searchParams)
    params.set('scope', newScope)
    if (newScope === 'group' && !params.get('groupId') && groups[0]?.id) {
      params.set('groupId', groups[0].id)
    }
    setSearchParams(params)
  }

  const handleGroupSelect = (newGroupId: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('scope', 'group')
    params.set('groupId', newGroupId)
    setSearchParams(params)
  }

  const handleOpenThresholdModal = () => {
    setDraftThreshold(threshold)
    setConfiguringThreshold(true)
  }

  const handleSaveThreshold = () => {
    setThreshold(draftThreshold)
    setConfiguringThreshold(false)
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Relatórios & Previsibilidade"
        subtitle="Visão analítica integrada, fluxo de caixa, evolução de despesas e projeção diária de saldo"
      />

      {/* Seletor de Escopo: Meu Relatório Individual | Relatório por Grupo */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="inline-flex rounded-xl bg-surface-1 border border-border p-1">
          <button
            type="button"
            onClick={() => handleScopeChange('individual')}
            className={clsx(
              'flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition',
              scope === 'individual'
                ? 'bg-violet text-white shadow-md shadow-violet/30'
                : 'text-text-muted hover:text-white',
            )}
          >
            <User className="size-4" />
            Meu Relatório Individual
          </button>

          <button
            type="button"
            onClick={() => handleScopeChange('group')}
            className={clsx(
              'flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition',
              scope === 'group'
                ? 'bg-violet text-white shadow-md shadow-violet/30'
                : 'text-text-muted hover:text-white',
            )}
          >
            <Users className="size-4" />
            Relatório por Grupo
            {groups.length > 0 && (
              <span className="rounded-full bg-surface-3 px-1.5 py-0.2 text-[10px] text-text-muted">
                {groups.length}
              </span>
            )}
          </button>
        </div>

        {scope === 'group' && groups.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-dim">Grupo:</span>
            <Select
              value={selectedGroupId}
              onChange={(e) => handleGroupSelect(e.target.value)}
              className="h-9 text-xs min-w-44"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>

            {selectedGroupId && (
              <Link
                to={`/grupos/${selectedGroupId}?tab=reports`}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-lime bg-lime/10 hover:bg-lime/20 rounded-lg transition-colors shrink-0"
                title="Abrir página deste grupo"
              >
                <ExternalLink className="size-3.5" />
                Ver no Grupo
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Renderização Condicional por Escopo */}
      {scope === 'group' ? (
        groups.length === 0 ? (
          <Card className="p-8 text-center bg-surface-1 border-border">
            <div className="mx-auto w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center text-text-muted mb-3">
              <Users className="size-6 text-violet" />
            </div>
            <h3 className="text-base font-semibold text-white">Nenhum grupo encontrado</h3>
            <p className="text-xs text-text-dim mt-1 max-w-sm mx-auto">
              Você ainda não participa de nenhum grupo. Crie um grupo ou aceite um convite para visualizar os relatórios consolidados.
            </p>
            <Link
              to="/grupos"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-violet hover:bg-violet-hover rounded-xl transition"
            >
              Ir para Grupos
            </Link>
          </Card>
        ) : selectedGroupId ? (
          <GroupReportsView key={selectedGroupId} groupId={selectedGroupId} />
        ) : (
          <div className="flex h-48 items-center justify-center">
            <Spinner />
          </div>
        )
      ) : (
        /* MODO INDIVIDUAL */
        <div className="space-y-6">
          <ReportFilters
            filters={filters}
            onChange={setFilters}
            accounts={accounts}
            creditCards={creditCards}
            categories={categories}
            threshold={threshold}
            onConfigureThreshold={handleOpenThresholdModal}
            showFilters={showFilters}
            onToggleShowFilters={() => setShowFilters((prev) => !prev)}
          />

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Bloco 1: KPIs & Visão Executiva Individual */}
              <KpiSection kpis={kpis} />

              {/* Patrimônio Guardado & Custo de Vida Médio */}
              <FinancialPlanningSection
                data={financialPlanning}
                windowMonths={windowMonths}
                onWindowChange={setWindowMonths}
              />

              {/* Previsibilidade: Calendário Financeiro Interativo Individual */}
              <CalendarFlowSection
                period={filters.period}
                projection={projection}
                threshold={threshold}
                accounts={allAccounts}
                categories={categories}
                accountIdFilter={filters.accountId}
                simulations={simulations}
                onAddSimulation={addSimulation}
                onRemoveSimulation={removeSimulation}
                onClearSimulations={clearSimulations}
              />

              {/* Bloco 2: Fluxo de Caixa Histórico (6 Meses) */}
              <CashFlowSection data={cashFlowHistory} />

              {/* Bloco 3: Evolução e Detalhamento de Categorias */}
              <CategoryEvolutionSection categories={categoryEvolution} />

              {/* Bloco 4: Compromissos Futuros (Próximos 6 Meses) */}
              <FutureCommitmentsSection commitments={futureCommitments} />

              {/* Bloco 5: Hábitos e Padrões de Consumo */}
              <SpendingHabitsSection
                cumulativePoints={spendingHabits.cumulativePoints}
                byDayOfWeek={spendingHabits.byDayOfWeek}
              />

              {/* Bloco 6: Balanço Compartilhado & Acertos de Grupos */}
              <GroupSharedSection data={sharedGroupBalance} />
            </div>
          )}

          {/* Modal de Configuração do Alerta de Saldo Mínimo Individual */}
          <Modal
            open={configuringThreshold}
            onClose={() => setConfiguringThreshold(false)}
            title="Valor de Atenção do Saldo"
          >
            <p className="text-xs text-text-dim">
              Dias em que o saldo projetado for menor que este valor serão destacados em amarelo. Saldo negativo sempre
              aparece em vermelho.
            </p>
            <div className="mt-4">
              <Field label="Saldo mínimo desejado">
                <MoneyInput value={draftThreshold} onChange={setDraftThreshold} />
              </Field>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfiguringThreshold(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveThreshold}>
                Salvar
              </Button>
            </div>
          </Modal>
        </div>
      )}
    </div>
  )
}
