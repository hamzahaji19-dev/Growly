import { Link } from 'react-router-dom'
import { Flame, Trophy, Settings, Star } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../contexts/AuthContext'
import { useGlobalData } from '../hooks/useGlobalData'
import { Avatar } from '../components/Avatar'
import { Card, PageSpinner } from '../components/ui'

export function ProfilePage() {
  const { profile, user } = useAuth()
  const { totalXp, weekXp, currentStreak, longestStreak, wins, loading } = useGlobalData()

  if (loading) return <PageSpinner />

  const statCards = [
    { label: 'Total XP', value: totalXp, sub: `+${weekXp} this week`, icon: Star, iconClass: 'text-tertiary-container' },
    { label: 'Day Streak', value: currentStreak, sub: `best ${longestStreak}`, icon: Flame, iconClass: 'text-secondary', highlight: true },
    { label: 'Challenges Won', value: wins, sub: 'daily wins', icon: Trophy, iconClass: 'text-tertiary' },
  ]

  return (
    <div className="space-y-6">
      {/* Profile header */}
      <Card className="relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-40 h-96 w-96 rounded-full bg-primary-fixed opacity-30 blur-3xl" />
        <div className="relative flex flex-col items-center gap-6 md:flex-row md:items-start md:gap-8">
          <Avatar name={profile?.name ?? user?.username ?? '?'} url={profile?.avatar_url} size="xl" className="h-32 w-32 md:h-40 md:w-40" />
          <div className="flex-1 text-center md:text-left">
            <h1 className="font-display text-2xl font-bold tracking-tight text-onSurface md:text-3xl">
              {profile?.name ?? 'You'}
            </h1>
            <p className="text-sm text-onSurfaceVariant">@{user?.username}</p>
            {profile?.bio && <p className="mt-2 max-w-lg text-sm text-onSurfaceVariant">{profile.bio}</p>}
            <div className="mt-4 flex flex-wrap justify-center gap-2 md:justify-start">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-fixed px-3 py-1 text-xs font-semibold text-primary-onFixedVariant">
                <Flame className="h-3.5 w-3.5" /> {currentStreak} day streak
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-containerHighest px-3 py-1 text-xs font-semibold text-onSurface">
                <Trophy className="h-3.5 w-3.5" /> {wins} wins
              </span>
            </div>
          </div>
          <div className="md:mt-0">
            <Link to="/settings">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-surface-outlineVariant bg-surface-containerLowest px-4 py-2 text-sm font-semibold text-onSurface transition hover:bg-surface-containerLow">
                <Settings className="h-4 w-4" /> Settings
              </span>
            </Link>
          </div>
        </div>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {statCards.map((c) => (
          <Card key={c.label} className="relative overflow-hidden bg-gradient-to-b from-surface-containerLow to-surface-containerLowest p-4">
            {c.highlight && <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-secondary-container/20 blur-xl" />}
            <div className="relative flex items-center gap-1.5 text-onSurfaceVariant">
              <c.icon className={clsx('h-4 w-4', c.iconClass)} />
              <h3 className="text-xs font-semibold">{c.label}</h3>
            </div>
            <p className="relative mt-3 font-display text-3xl font-bold text-onSurface">{c.value}</p>
            <p className={clsx('relative mt-1 text-xs font-medium', c.highlight ? 'text-secondary' : 'text-onSurfaceVariant')}>{c.sub}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
