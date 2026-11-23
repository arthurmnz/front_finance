import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { AuthResponse, Transaction, UpdateInstallmentGroupAmountsInput } from './types'

const defaultApiUrl = import.meta.env.PROD ? 'https://api-finance.devmnz.com.br' : ''
const baseURL = `${(import.meta.env.VITE_API_URL ?? defaultApiUrl).replace(/\/$/, '')}/api/v1`

export const api = axios.create({ baseURL, withCredentials: true })

let accessToken: string | null = null
let onSessionExpired: (() => void) | null = null
export const setAccessToken = (t: string | null) => { accessToken = t }
export const setSessionExpiredHandler = (fn: () => void) => { onSessionExpired = fn }

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

let refreshing: Promise<AuthResponse> | null = null
export const refreshSession = (): Promise<AuthResponse> => {
  if (!refreshing) {
    refreshing = axios
      .post<AuthResponse>(`${baseURL}/auth/refresh`, null, { withCredentials: true })
      .then((r) => { accessToken = r.data.accessToken; return r.data })
      .finally(() => { refreshing = null })
  }
  return refreshing
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
    const isAuthCall = original?.url?.startsWith('/auth/')
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true
      try {
        await refreshSession()
        return api(original)
      } catch {
        accessToken = null
        onSessionExpired?.()
      }
    }
    return Promise.reject(error)
  },
)

export const errorMessage = (e: unknown): string => {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { message?: string } | undefined
    if (data?.message) return data.message
    if (!e.response) return 'Não foi possível conectar ao servidor.'
    return `Erro ${e.response.status}`
  }
  return e instanceof Error ? e.message : 'Erro inesperado.'
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function assertValidUuid(value: string, fieldName = 'Identificador'): string {
  if (typeof value !== 'string' || /[\r\n]/.test(value) || !UUID_RE.test(value)) {
    throw new Error(`${fieldName} inválido.`)
  }
  return encodeURIComponent(value)
}

export const getTransactionsByGroup = async (recurrenceGroupId: string): Promise<Transaction[]> => {
  const safeGroupId = assertValidUuid(recurrenceGroupId, 'Identificador do grupo de recorrência')
  return api.get<Transaction[]>(`/transactions/group/${safeGroupId}`).then((r) => r.data)
}

export const updateGroupInstallments = async (
  recurrenceGroupId: string,
  body: UpdateInstallmentGroupAmountsInput,
): Promise<Transaction[]> => {
  const safeGroupId = assertValidUuid(recurrenceGroupId, 'Identificador do grupo de recorrência')
  body.items.forEach((item) => {
    assertValidUuid(item.transactionId, 'Identificador da parcela')
  })
  return api.put<Transaction[]>(`/transactions/group/${safeGroupId}/installments`, body).then((r) => r.data)
}
