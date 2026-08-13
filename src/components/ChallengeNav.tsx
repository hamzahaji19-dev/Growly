import { NavLink } from 'react-router-dom'
import { BarChart3, ListChecks, Users, ShieldCheck, Trophy } from 'lucide-react'
import clsx from 'clsx'

const TABS = [
  { to: '', end: true, label: 'Overview', icon: BarChart3 },
  { to: 'tasks', end: false, label: 'Tasks', icon: ListChecks },
  { to: 'leaderboard', end: false, label: 'Leaderboard', icon: Trophy },
  { to: 'members', end: false, label: 'Members', icon: Users },
  { to: 'proofs', end: false, label: 'Proofs', icon: ShieldCheck },
]

export function ChallengeNav({ base }: { base: string }) {
  return (
    <div className="scrollbar-hide -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="flex w-max gap-6 border-b border-surface-outlineVariant md:w-full">
        {TABS.map((t) => (
          <NavLink
            key={t.label}
            to={t.end ? base : `${base}/${t.to}`}
            end={t.end}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-1.5 whitespace-nowrap border-b-2 pb-2.5 pt-1 text-sm font-semibold transition',
                isActive ? 'border-secondary-container text-primary' : 'border-transparent text-onSurfaceVariant hover:text-primary'
              )
            }
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}
