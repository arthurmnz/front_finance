import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/lib/auth'
import App from './App'
import './index.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 15_000 } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster
            theme="dark"
            position="top-center"
            toastOptions={{
              unstyled: true,
              classNames: {
                toast:
                  'flex items-center gap-3 w-full max-w-md rounded-2xl bg-surface border border-border-subtle p-4 text-sm text-ink-primary shadow-2xl shadow-canvas/90',
                title: 'text-sm font-medium text-ink-primary',
                description: 'text-xs text-ink-secondary',
                actionButton:
                  'bg-accent text-canvas hover:bg-accent-soft rounded-xl px-3 py-1.5 text-xs font-semibold',
                cancelButton:
                  'bg-white/10 text-ink-primary hover:bg-white/15 rounded-xl px-3 py-1.5 text-xs',
                error: 'border-white/20 text-ink-primary',
                success: 'border-accent/40 text-ink-primary',
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
