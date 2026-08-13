import clsx from 'clsx'
import { hashCode, initials } from '../lib/calc'

const AVATAR_COLORS = [
  'bg-primary-container',
  'bg-emerald-700',
  'bg-teal-700',
  'bg-cyan-700',
  'bg-sky-700',
  'bg-indigo-700',
  'bg-violet-700',
  'bg-fuchsia-700',
  'bg-rose-600',
  'bg-amber-600',
]

export function Avatar({ name, url, size = 'md', className }: { name: string; url?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-lg',
    xl: 'h-20 w-20 text-2xl',
  }
  const color = AVATAR_COLORS[hashCode(name || '?') % AVATAR_COLORS.length]
  if (url) {
    return <img src={url} alt={name} className={clsx('shrink-0 rounded-full object-cover', sizes[size], className)} />
  }
  return (
    <div
      className={clsx(
        'flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white',
        sizes[size],
        color,
        className
      )}
    >
      {initials(name || '?')}
    </div>
  )
}

export function AvatarStack({ profiles, max = 4 }: { profiles: { name: string; avatar_url?: string | null }[]; max?: number }) {
  const shown = profiles.slice(0, max)
  const extra = profiles.length - shown.length
  return (
    <div className="flex -space-x-2">
      {shown.map((p, i) => (
        <Avatar key={i} name={p.name} url={p.avatar_url} size="sm" className="ring-2 ring-surface-containerLowest" />
      ))}
      {extra > 0 && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-containerHighest text-xs font-bold text-onSurfaceVariant ring-2 ring-surface-containerLowest">
          +{extra}
        </div>
      )}
    </div>
  )
}
