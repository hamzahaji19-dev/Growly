import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../contexts/AuthContext'
import { useChallengeData } from '../hooks/useChallengeData'
import { computeLeaderboard, type PeriodFilter } from '../lib/calc'
import type { LeaderboardRow } from '../lib/types'
import { ChallengeNav } from '../components/ChallengeNav'
import { Avatar } from '../components/Avatar'
import { Card, EmptyState, PageSpinner, SegmentedControl } from '../components/ui'

const PERIODS: { label: string; value: PeriodFilter }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'All', value: 'all' },
]

export function LeaderboardPage() {
  const { id } = useParams<{ id: string }>()
  const { challenge, members, tasks, completions, loading } = useChallengeData(id)
  const { user } = useAuth()
  const [period, setPeriod] = useState<PeriodFilter>('all')

  const rows = useMemo<LeaderboardRow[]>(() => {
    if (!challenge) return []
    return computeLeaderboard(members, tasks, completions, members.map((m) => m.profile), challenge, period)
  }, [challenge, members, tasks, completions, period])

  if (loading) return <PageSpinner />
  if (!challenge) return null

  const maxXp = rows.length > 0 ? rows[0].xp : 1

  return (
    <div className="space-y-5">
      <ChallengeNav base={`/challenge/${challenge.id}`} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-on-surface">Leaderboard</h1>
          <p className="text-sm text-onSurfaceVariant">Where the friendly rivalry lives.</p>
        </div>
        <SegmentedControl options={PERIODS} value={period} onChange={setPeriod} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<Trophy className="h-6 w-6" />} title="No leaderboard yet" description="Complete tasks and win days to climb the ranks." />
      ) : (
        <Card className="p-2 sm:p-3">
          <ul className="space-y-1">
            {rows.map((row) => {
              const isMe = row.user.id === user?.id
              return (
                <li
                  key={row.user.id}
                  className={clsx(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5',
                    isMe && 'bg-primary-fixed/40 ring-1 ring-primary-fixed-dim'
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                      row.rank === 1 && 'bg-secondary-fixed text-secondary-onFixed',
                      row.rank === 2 && 'bg-surface-containerHigh text-onSurfaceVariant',
                      row.rank === 3 && 'bg-tertiary-fixed/70 text-tertiary-onFixed',
                      row.rank > 3 && 'text-onSurfaceVariant'
                    )}
                  >
                    {row.rank}
                  </span>
                  <Avatar name={row.user.name} url={row.user.avatar_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-on-surface">
                      {row.user.name} {isMe && <span className="text-xs font-medium text-primary-container">(you)</span>}
                    </p>
                    <div className="mt-1.5 h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-surface-containerHigh">
                      <div
                        className={clsx('h-full rounded-full', row.rank === 1 ? 'bg-secondary-container' : 'bg-primary-container')}
                        style={{ width: `${Math.max(4, (row.xp / maxXp) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-right">
                    <div>
                      <p className="font-display text-sm font-bold text-on-surface">{row.xp}</p>
                      <p className="text-[10px] font-medium text-onSurfaceVariant">XP</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-sm font-semibold text-on-surfaceVariant">{row.completion}%</p>
                      <p className="text-[10px] font-medium text-onSurfaceVariant">Done</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-on-surfaceVariant">{row.streak}</p>
                      <p className="text-[10px] font-medium text-onSurfaceVariant">Streak</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-sm font-semibold text-on-surfaceVariant">{row.wins}</p>
                      <p className="text-[10px] font-medium text-onSurfaceVariant">Wins</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
