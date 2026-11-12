import { useState } from 'react'
import { Button, Field, Modal, MoneyInput, Spinner } from '@/components/ui'
import { currentPeriod } from '@/components/MonthPicker'
import ReportFilters from './ReportFilters'
import KpiSection from './KpiSection'
import FinancialPlanningSection from './FinancialPlanningSection'
import CalendarFlowSection from './CalendarFlowSection'
import CashFlowSection from './CashFlowSection'
import CategoryEvolutionSection from './CategoryEvolutionSection'
import FutureCommitmentsSection from './FutureCommitmentsSection'
import SpendingHabitsSection from './SpendingHabitsSection'
import GroupMemberExpensesSection from './GroupMemberExpensesSection'
import GroupDebtsReportSection from './GroupDebtsReportSection'
import { useGroupReportsData, useSimulations, useWarningThreshold } from './useReportsData'
import type { ReportFiltersState } from './types'

interface GroupReportsViewProps {
  groupId: string
}

export default function GroupReportsView({ groupId }: GroupReportsViewProps) {
  const [threshold, setThreshold] = useWarningThreshold(`group-${groupId}`)
  const { simulations, addSimulation, removeSimulation, clearSimulations } = useSimulations(`group-${groupId}`)
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
    responsibleId: '',
    status: '',
  })

  const {
    loading,
    members,
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
    memberExpenses,
    groupDebts,
  } = useGroupReportsData(groupId, filters, threshold, windowMonths, simulations)

  const handleOpenThresholdModal = () => {
    setDraftThreshold(threshold)
    setConfiguringThreshold(true)
  }

  const handleSaveThreshold = () => {
    setThreshold(draftThreshold)
    setConfiguringThreshold(false)
  }

  return (
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
        members={members}
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Bloco 1: KPIs Consolidados do Grupo */}
          <KpiSection kpis={kpis} />

          {/* Patrimônio Guardado & Custo de Vida Médio */}
          <FinancialPlanningSection
            data={financialPlanning}
            windowMonths={windowMonths}
            onWindowChange={setWindowMonths}
          />

          {/* Previsibilidade: Calendário Financeiro do Grupo */}
          <CalendarFlowSection
            period={filters.period}
            projection={projection}
            threshold={threshold}
            accounts={allAccounts}
            categories={categories}
            creditCards={creditCards}
            accountIdFilter={filters.accountId}
            simulations={simulations}
            onAddSimulation={addSimulation}
            onRemoveSimulation={removeSimulation}
            onClearSimulations={clearSimulations}
          />

          {/* Bloco Específico de Grupo: Despesas por Membro Responsável */}
          <GroupMemberExpensesSection memberExpenses={memberExpenses} />

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

          {/* Bloco Específico de Grupo: Balanço de Acertos entre Membros */}
          <GroupDebtsReportSection
            groupId={groupId}
            debts={groupDebts}
            period={filters.period}
          />
        </div>
      )}

      {/* Modal de Configuração do Alerta de Saldo Mínimo */}
      <Modal
        open={configuringThreshold}
        onClose={() => setConfiguringThreshold(false)}
        title="Valor de Atenção do Saldo do Grupo"
      >
        <p className="text-xs text-text-dim">
          Dias em que o saldo projetado das contas do grupo for menor que este valor serão destacados em amarelo. Saldo negativo sempre aparece em vermelho.
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
  )
}
