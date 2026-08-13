import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import clsx from 'clsx'
import { X, Loader2 } from 'lucide-react'

// ---- Button ----------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent-gradient text-white shadow-card hover:brightness-105',
  secondary: 'bg-surface-containerLowest text-on-surface border border-surface-outlineVariant hover:bg-surface-containerLow shadow-card',
  ghost: 'text-on-surfaceVariant hover:bg-surface-container hover:text-on-surface',
  danger: 'bg-red-500 text-white hover:bg-red-600 shadow-card',
  subtle: 'bg-primary-fixed/60 text-primary-onFixedVariant hover:bg-primary-fixed',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition select-none disabled:cursor-not-allowed disabled:opacity-50 active:shadow-pressed',
        size === 'sm' && 'px-4 py-2 text-sm',
        size === 'md' && 'px-5 py-2.5 text-sm',
        size === 'lg' && 'min-h-[56px] px-6 py-3.5 text-base',
        buttonVariants[variant],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
)
Button.displayName = 'Button'

// ---- Form controls ----------------------------------------------------------

const fieldStyles =
  'w-full rounded-xl border border-surface-outlineVariant bg-surface-containerLowest px-3.5 py-2.5 text-sm text-on-surface placeholder:text-onSurfaceVariant/50 outline-none transition focus:border-surface-tint focus:ring-2 focus:ring-primary-fixed disabled:opacity-60'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={clsx(fieldStyles, className)} {...props} />
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={clsx(fieldStyles, 'min-h-[90px] resize-y', className)} {...props} />
)
Textarea.displayName = 'Textarea'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={clsx(fieldStyles, 'cursor-pointer appearance-none pr-8', className)} {...props}>
      {children}
    </select>
  )
)
Select.displayName = 'Select'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-onSurfaceVariant">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-onSurfaceVariant/80">{hint}</span>}
    </label>
  )
}

// ---- Toggle ------------------------------------------------------------------

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-secondary-container' : 'bg-surface-outlineVariant'
      )}
    >
      <span
        className={clsx(
          'inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-[3px]'
        )}
        style={{ height: 18, width: 18 }}
      />
    </button>
  )
}

// ---- Card ---------------------------------------------------------------------

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={clsx('rounded-[20px] bg-surface-containerLowest p-4 shadow-card sm:p-5', className)}>
      {children}
    </div>
  )
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-display text-base font-bold text-on-surface">{title}</h2>
      {action}
    </div>
  )
}

// ---- Badge ---------------------------------------------------------------------

type BadgeTone = 'green' | 'gray' | 'blue' | 'amber' | 'red'

const badgeTones: Record<BadgeTone, string> = {
  green: 'bg-primary-fixed/70 text-primary-onFixedVariant',
  gray: 'bg-surface-containerHigh text-onSurfaceVariant',
  blue: 'bg-tertiary-fixed/70 text-tertiary-onFixed',
  amber: 'bg-secondary-fixed text-secondary-onFixed',
  red: 'bg-red-50 text-red-600',
}

export function Badge({ tone = 'gray', className, children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', badgeTones[tone], className)}>
      {children}
    </span>
  )
}

// ---- Modal ---------------------------------------------------------------------

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-md" onClick={onClose} />
      <div className="relative z-10 max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface-containerLowest p-5 shadow-pop sm:m-4 sm:rounded-[24px]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-on-surface">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-onSurfaceVariant/60 transition hover:bg-surface-container hover:text-onSurface" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ---- Spinner / Empty ------------------------------------------------------------

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('h-5 w-5 animate-spin text-primary-container', className)} />
}

export function PageSpinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-onSurfaceVariant/60">
      <Spinner className="h-6 w-6" />
      <p className="text-sm">Loading…</p>
    </div>
  )
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed border-surface-outlineVariant bg-surface-containerLowest px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-fixed/70 text-primary-container">{icon}</div>
      <p className="mt-1 font-semibold text-on-surface">{title}</p>
      {description && <p className="max-w-xs text-sm text-onSurfaceVariant">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

// ---- Segmented control ----------------------------------------------------------

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { label: string; value: T }[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={clsx('inline-flex rounded-full bg-surface-container p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'rounded-full px-3.5 py-1.5 text-sm font-semibold transition',
            value === o.value ? 'bg-surface-containerLowest text-on-surface shadow-card' : 'text-onSurfaceVariant hover:text-onSurface'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ---- Progress bar ---------------------------------------------------------------

export function ProgressBar({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  return (
    <div className={clsx('h-2 w-full overflow-hidden rounded-full bg-surface-containerHigh', className)}>
      <div
        className={clsx('h-full rounded-full bg-accent-gradient transition-all duration-500', barClassName)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}
