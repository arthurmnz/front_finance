import type { ReactNode } from 'react'
import { Empty } from './Empty'
import { ListSkeleton } from './Skeleton'

export interface QueryStateProps {
  isLoading: boolean
  error: unknown
  skeleton?: ReactNode
  children: ReactNode
}

export function QueryState({ isLoading, error, skeleton, children }: QueryStateProps) {
  if (isLoading) return <>{skeleton ?? <ListSkeleton rows={4} />}</>
  if (error) return <Empty title="Não foi possível carregar os dados." />
  return <>{children}</>
}
