import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import clsx from 'clsx'

type ToastKind = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let toastId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    if (timers.current[id]) {
      clearTimeout(timers.current[id])
      delete timers.current[id]
    }
  }, [])

  const toast = useCallback(
    (message: string, kind: ToastKind = 'success') => {
      const id = ++toastId
      setToasts((prev) => [...prev.slice(-3), { id, kind, message }])
      timers.current[id] = setTimeout(() => dismiss(id), 4200)
    },
    [dismiss]
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-20 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4 sm:bottom-6">
        {toasts.map((t) => {
          const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? AlertCircle : Info
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex w-full items-center gap-3 rounded-xl border border-surface-outlineVariant bg-surface-containerLowest px-4 py-3 text-sm shadow-pop"
            >
              <Icon
                className={clsx(
                  'h-4 w-4 shrink-0',
                  t.kind === 'success' && 'text-primary-container',
                  t.kind === 'error' && 'text-red-500',
                  t.kind === 'info' && 'text-onSurfaceVariant'
                )}
              />
              <p className="flex-1 text-on-surface">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="text-onSurfaceVariant/60 transition hover:text-onSurface"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
