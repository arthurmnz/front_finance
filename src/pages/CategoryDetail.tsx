import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAllCategories, useCategoryTransactions } from '@/lib/hooks'
import { formatMoney } from '@/lib/format'
import { Card, PageHeader, QueryState } from '@/components/ui'
import { MonthPicker, currentPeriod } from '@/components/MonthPicker'
import TransactionList from '@/components/TransactionList'

export default function CategoryDetail() {
  const { id } = useParams()
  const [period, setPeriod] = useState(currentPeriod())
  const cats = useAllCategories().data
  const tx = useCategoryTransactions(id, period.month, period.year)
  const cat = cats.find((c) => c.id === id)
  const total = (tx.data ?? []).reduce((s, t) => s + t.amount, 0)

  return (
    <>
      <PageHeader back={<Link to="/categorias" className="mb-1 inline-flex items-center gap-1 text-xs text-muted hover:text-text"><ArrowLeft className="size-3" /> Categorias</Link>}
        title={cat ? `${cat.icon ?? ''} ${cat.name}` : 'Categoria'} subtitle={cat?.description ?? undefined} />
      <Card className="mb-4 p-4"><p className="text-xs text-muted">Total no período</p><p className="text-2xl font-bold">{formatMoney(total)}</p></Card>
      <div className="mb-3"><MonthPicker value={period} onChange={setPeriod} /></div>
      <QueryState isLoading={tx.isLoading} error={tx.error}><TransactionList items={tx.data ?? []} categories={cats} /></QueryState>
    </>
  )
}
