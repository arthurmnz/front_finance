import { useMemo } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, errorMessage } from './api'
import type * as T from './types'

const get = <R,>(url: string, params?: object) => api.get<R>(url, { params }).then((r) => r.data)

// ---------- Queries ----------
export const useAccounts = () => useQuery({ queryKey: ['accounts'], queryFn: () => get<T.Account[]>('/accounts') })
export const useCreditCards = () => useQuery({ queryKey: ['credit-cards'], queryFn: () => get<T.CreditCard[]>('/credit-cards') })
export const useCreditCardInvoice = (cardId: string | undefined, month: number, year: number) =>
  useQuery({
    queryKey: ['credit-cards', cardId, 'invoice', month, year],
    enabled: !!cardId,
    queryFn: () => get<T.CreditCardInvoice>(`/credit-cards/${cardId}/invoice`, { month, year }),
  })

export const useTotalBalance = (month: number, year: number, ignoreIds: string[]) =>
  useQuery({
    queryKey: ['total-balance', month, year, ignoreIds],
    queryFn: () =>
      api
        .get<T.TotalBalance>('/accounts/total-balance', {
          params: { month, year, ignoreIds: ignoreIds.length ? ignoreIds.join(',') : undefined },
        })
        .then((r) => r.data),
  })

export const useAccountTransactions = (accountId: string | undefined, month: number, year: number) =>
  useQuery({
    queryKey: ['transactions', 'account', accountId, month, year],
    enabled: !!accountId,
    queryFn: () => get<T.Transaction[]>(`/transactions/account/${accountId}`, { month, year }),
  })

export const useCategoryTransactions = (categoryId: string | undefined, month: number, year: number) =>
  useQuery({
    queryKey: ['transactions', 'category', categoryId, month, year],
    enabled: !!categoryId,
    queryFn: () => get<T.Transaction[]>(`/transactions/category/${categoryId}`, { month, year }),
  })

export const useMyCategories = () => useQuery({ queryKey: ['categories', 'me'], queryFn: () => get<T.Category[]>('/categories/me') })
export const useGroupCategories = (groupId: string | undefined) =>
  useQuery({ queryKey: ['categories', 'group', groupId], enabled: !!groupId, queryFn: () => get<T.Category[]>(`/categories/group/${groupId}`) })

/** Retorna todas as categorias acessíveis pelo usuário (pessoais + de todos os grupos dos quais participa). */
export function useAllCategories() {
  const mine = useMyCategories()
  const groups = useGroups()
  const groupQueries = useQueries({
    queries: (groups.data ?? []).map((g) => ({
      queryKey: ['categories', 'group', g.id],
      queryFn: () => get<T.Category[]>(`/categories/group/${g.id}`),
    })),
  })
  const groupStamp = groupQueries.map((q) => q.dataUpdatedAt).join(',')
  const data = useMemo(() => {
    const map = new Map<string, T.Category>()
    ;(mine.data ?? []).forEach((c) => map.set(c.id, c))
    groupQueries.forEach((q) => (q.data ?? []).forEach((c) => map.set(c.id, c)))
    return [...map.values()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine.data, groupStamp])
  return {
    data,
    myCategories: mine.data ?? [],
    isLoading: mine.isLoading || groups.isLoading || groupQueries.some((q) => q.isLoading),
  }
}

/** Retorna as contas próprias do usuário + contas vinculadas aos grupos dos quais participa. */
export function useAccessibleAccounts() {
  const own = useAccounts()
  const groups = useGroups()
  const groupAccQueries = useQueries({
    queries: (groups.data ?? []).map((g) => ({
      queryKey: ['groups', g.id, 'accounts'],
      queryFn: () => get<T.GroupAccount[]>(`/groups/${g.id}/accounts`),
    })),
  })
  const groupAccStamp = groupAccQueries.map((q) => q.dataUpdatedAt).join(',')
  const data = useMemo(() => {
    const map = new Map<string, T.Account>()
    ;(own.data ?? []).forEach((a) => map.set(a.id, a))
    groupAccQueries.forEach((q) =>
      (q.data ?? []).forEach((ga) => {
        map.set(ga.id, { ...ga, ownerId: ga.owner.id, owner: ga.owner })
      }),
    )
    return [...map.values()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [own.data, groupAccStamp])
  return {
    ...own,
    data,
    isLoading: own.isLoading || groups.isLoading || groupAccQueries.some((q) => q.isLoading),
  }
}

export const useFriendships = (status?: T.FriendshipStatus) =>
  useQuery({ queryKey: ['friendships', status ?? 'all'], queryFn: () => get<T.Friendship[]>('/friendships', { status }) })
export const usePendingReceived = () => useQuery({ queryKey: ['friendships', 'received'], queryFn: () => get<T.Friendship[]>('/friendships/pending/received') })
export const usePendingSent = () => useQuery({ queryKey: ['friendships', 'sent'], queryFn: () => get<T.Friendship[]>('/friendships/pending/sent') })

export const useGroups = () => useQuery({ queryKey: ['groups'], queryFn: () => get<T.GroupSummary[]>('/groups') })
export const useGroup = (id: string | undefined) => useQuery({ queryKey: ['groups', id], enabled: !!id, queryFn: () => get<T.Group>(`/groups/${id}`) })
export const useGroupInvitations = () => useQuery({ queryKey: ['group-invitations'], queryFn: () => get<T.GroupInvitation[]>('/groups/invitations/pending') })
export const useGroupAccounts = (id: string | undefined) => useQuery({ queryKey: ['groups', id, 'accounts'], enabled: !!id, queryFn: () => get<T.GroupAccount[]>(`/groups/${id}/accounts`) })
export const useGroupAccountRequests = (id: string | undefined, enabled = true) =>
  useQuery({ queryKey: ['groups', id, 'account-requests'], enabled: !!id && enabled, queryFn: () => get<T.AccountGroupRequest[]>(`/groups/${id}/account-requests`) })
export const useGroupCreditCards = (id: string | undefined) => useQuery({ queryKey: ['groups', id, 'credit-cards'], enabled: !!id, queryFn: () => get<T.CreditCard[]>(`/groups/${id}/credit-cards`) })
export const useGroupCreditCardRequests = (id: string | undefined, enabled = true) =>
  useQuery({ queryKey: ['groups', id, 'credit-card-requests'], enabled: !!id && enabled, queryFn: () => get<T.CreditCardGroupRequest[]>(`/groups/${id}/credit-card-requests`) })

// ---------- Mutations ----------
export function useAction<V, R = unknown>(
  fn: (v: V) => Promise<R>,
  opts: { invalidate?: unknown[][]; success?: string; onSuccess?: (r: R, v: V) => void } = {},
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, v) => {
      opts.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }))
      if (opts.success) toast.success(opts.success)
      opts.onSuccess?.(r, v)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
}

export const ALL_MONEY = [['accounts'], ['total-balance'], ['transactions'], ['credit-cards']]
