import { useState } from 'react'
import { Button, Field, Modal, MoneyInput, PageHeader, Spinner } from '@/components/ui'
import { currentPeriod } from '@/components/MonthPicker'
import { useAuth } from '@/lib/auth'
import ReportFilters from '@/components/reports/ReportFilters'
import KpiSection from '@/components/reports/KpiSection'
import CalendarFlowSection from '@/components/reports/CalendarFlowSection'
import CashFlowSection from '@/components/reports/CashFlowSection'
import CategoryEvolutionSection from '@/components/reports/CategoryEvolutionSection'
import FutureCommitmentsSection from '@/components/reports/FutureCommitmentsSection'
import SpendingHabitsSection from '@/components/reports/SpendingHabitsSection'
import GroupSharedSection from '@/components/reports/GroupSharedSection'
import { useReportsData, useWarningThreshold } from '@/components/reports/useReportsData'
import type { ReportFiltersState } from '@/components/reports/types'

export default function Reports() {
  const { user } = useAuth()
  const [threshold, setThreshold] = useWarningThreshold(user?.id)
  const [configuringThreshold, setConfiguringThreshold] = useState(false)
  const [draftThreshold, setDraftThreshold] = useState(threshold)
  const [showFilters, setShowFilters] = useState(false)

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
    creditCards,
    categories,
    projection,
    kpis,
    cashFlowHistory,
    categoryEvolution,
    futureCommitments,
    spendingHabits,
    sharedGroupBalance,
  } = useReportsData(filters, threshold)

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
          {/* Bloco 1: KPIs & Visão Executiva */}
          <KpiSection kpis={kpis} />

          {/* Previsibilidade: Calendário Financeiro Interativo */}
          <CalendarFlowSection
            period={filters.period}
            projection={projection}
            threshold={threshold}
            accounts={accounts}
            categories={categories}
            accountIdFilter={filters.accountId}
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

      {/* Modal de Configuração do Alerta de Saldo Mínimo */}
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
  )
}
