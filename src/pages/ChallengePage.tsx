import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Calendar,
  Copy,
  ChevronRight,
  Flame,
  Flag,
  Trash2,
  Trophy,
  TrendingUp,
  ShieldCheck,
  Users,
  Zap,
  CheckCircle2,
} from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useChallengeData } from '../hooks/useChallengeData'
import { computeChallengeStats, formatShortDate, timeAgo, todayKey, eachDayKeys } from '../lib/calc'
import { db } from '../lib'
import { Avatar, AvatarStack } from '../components/Avatar'
import { ChallengeNav } from '../components/ChallengeNav'
import { Badge, Button, Card, EmptyState, Modal, PageSpinner, SectionTitle } from '../components/ui'
import { ProgressRing } from '../components/ProgressRing'
import clsx from 'clsx'

export function ChallengePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { challenge, members, tasks, completions, activity, loading, error } = useChallengeData(id)
  const { user } = useAuth()
  const { toast } = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const stats = useMemo(() => {
    if (!challenge) return null
    return computeChallengeStats(
      challenge,
      members,
      tasks,
      completions,
      members.map((m) => m.profile),
      user?.id ?? ''
    )
  }, [challenge, members, tasks, completions, user])

  const isOwner = challenge?.owner_id === user?.id
  const me = members.find((m) => m.user_id === user?.id)

  const chartData = useMemo(() => {
    if (!challenge || !stats) return []
    const today = todayKey()
    const start = challenge.start_date > today ? today : challenge.start_date
    const all = eachDayKeys(start, today)
    const recent = all.length > 30 ? all.slice(all.length - 30) : all
    return recent.map((d) => ({
      day: formatShortDate(d),
      pct: stats.daily[d]?.pct ?? 0,
    }))
  }, [challenge, stats])

  if (loading) return <PageSpinner />
  if (!challenge || !stats) {
    return (
      <EmptyState
        icon={<Flag className="h-6 w-6" />}
        title={error ?? 'Challenge not found'}
        description="It may have been deleted, or the link is invalid."
      />
    )
  }

  const copyCode = () => {
    navigator.clipboard?.writeText(challenge.invite_code).catch(() => {})
    toast('Invite code copied!')
  }

  const removeMe = async () => {
    if (!user) return
    try {
      await db.removeMember(challenge.id, user.id)
      toast('You left the challenge.')
      navigate('/challenges')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not leave.', 'error')
    }
  }

  const doDelete = async () => {
    setDeleting(true)
    try {
      await db.deleteChallenge(challenge.id)
      toast('Challenge deleted.')
      navigate('/challenges')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const s = stats.summary
  const statCards = [
    { label: 'Total XP', value: s.totalXp, icon: Zap, tone: 'bg-primary-fixed/70 text-primary-onFixedVariant' },
    { label: 'Streak', value: s.currentStreak, icon: Flame, tone: 'bg-secondary-fixed text-secondary-onFixed' },
    { label: 'Wins', value: s.wins, icon: Trophy, tone: 'bg-secondary-fixed text-secondary-onFixed' },
    { label: 'Avg completion', value: `${s.avgCompletion}%`, icon: CheckCircle2, tone: 'bg-tertiary-fixed/70 text-tertiary-onFixed' },
  ]

  const top3 = stats.leaderboard.slice(0, 3)
  const profileById = new Map(members.map((m) => [m.user_id, m.profile]))

  return (
    <div className="space-y-5">
      <ChallengeNav base={`/challenge/${challenge.id}`} />

      <Card className="overflow-hidden p-0">
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-xl font-bold tracking-tight text-on-surface sm:text-2xl">{challenge.name}</h1>
                {challenge.competitive_mode && (
                  <Badge tone="amber">
                    <Flame className="h-3 w-3" /> competitive
                  </Badge>
                )}
                {challenge.proof_required && (
                  <Badge tone="blue">
                    <ShieldCheck className="h-3 w-3" /> proof
                  </Badge>
                )}
              </div>
              {challenge.description && <p className="mt-1 text-sm text-onSurfaceVariant">{challenge.description}</p>}
            </div>
            {isOwner && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded-full p-2 text-onSurfaceVariant/50 transition hover:bg-red-50 hover:text-red-500"
                aria-label="Delete challenge"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-onSurfaceVariant">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {formatShortDate(challenge.start_date)} → {formatShortDate(challenge.end_date)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" /> {members.length} members
            </span>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ProgressRing value={s.avgCompletion} size={64} stroke={7}>
                <span className="font-display text-sm font-bold text-on-surface">{s.avgCompletion}%</span>
              </ProgressRing>
              <div>
                <p className="font-display text-sm font-semibold text-on-surface">Your overall completion</p>
                <p className="text-xs text-onSurfaceVariant">Daily target is {challenge.daily_target}%</p>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={copyCode}
          className="flex w-full items-center justify-between border-t border-surface-outlineVariant bg-surface-containerLow px-5 py-3 text-left transition hover:bg-surface-container"
        >
          <span className="flex items-center gap-2 font-mono text-sm font-bold tracking-widest text-primary-container">{challenge.invite_code}</span>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-secondary">
            <Copy className="h-3.5 w-3.5" /> Copy invite code
          </span>
        </button>
      </Card>

      {me && !isOwner && (
        <button onClick={removeMe} className="mx-auto block text-xs font-medium text-onSurfaceVariant underline-offset-2 hover:text-red-500 hover:underline">
          Leave challenge
        </button>
      )}

      <div className="grid grid-cols-2 gap-3">
        {statCards.map((c) => (
          <Card key={c.label} className="flex items-center gap-3 p-4">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${c.tone}`}>
              <c.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-lg font-bold leading-tight text-on-surface">{c.value}</p>
              <p className="truncate text-xs font-medium text-onSurfaceVariant">{c.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <SectionTitle
          title="Progress"
          action={
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-container">
              <TrendingUp className="h-3.5 w-3.5" /> completion %
            </span>
          }
        />
        {chartData.length === 0 ? (
          <p className="py-6 text-center text-sm text-onSurfaceVariant">No data yet — the challenge hasn't started.</p>
        ) : (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -28 }}>
                <defs>
                  <linearGradient id="pct" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3e6752" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3e6752" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#8b918d' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={30} />
                <YAxis tick={{ fontSize: 10, fill: '#8b918d' }} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ borderRadius: 14, border: '1px solid #ebefed', fontSize: 12, boxShadow: '0 8px 28px rgba(26,67,49,.14)' }}
                />
                <Area type="monotone" dataKey="pct" stroke="#3e6752" strokeWidth={2} fill="url(#pct)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle
          title="Leaderboard"
          action={
            <Link to={`/challenge/${challenge.id}/leaderboard`} className="flex items-center text-xs font-semibold text-primary-container hover:text-primary">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        {top3.length === 0 ? (
          <p className="py-4 text-center text-sm text-onSurfaceVariant">No data yet.</p>
        ) : (
          <ul className="space-y-2">
            {top3.map((row, i) => {
              const isMe = row.user.id === user?.id
              return (
                <li
                  key={row.user.id}
                  className={clsx('flex items-center gap-3 rounded-xl p-2', isMe && 'bg-primary-fixed/40')}
                >
                  <span
                    className={clsx(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                      i === 0 && 'bg-secondary-fixed text-secondary-onFixed',
                      i === 1 && 'bg-surface-containerHigh text-onSurfaceVariant',
                      i === 2 && 'bg-tertiary-fixed/70 text-tertiary-onFixed'
                    )}
                  >
                    {i + 1}
                  </span>
                  <Avatar name={row.user.name} url={row.user.avatar_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-on-surface">
                      {row.user.name} {isMe && <span className="text-xs font-medium text-primary-container">(you)</span>}
                    </p>
                    <p className="text-xs text-onSurfaceVariant">{row.xp} XP · {row.streak} streak</p>
                  </div>
                  <span className="font-display text-sm font-bold text-on-surface">{row.xp}</span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle title="Activity" />
        {activity.length === 0 ? (
          <p className="py-4 text-center text-sm text-onSurfaceVariant">No activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {activity.slice(0, 12).map((a) => {
              const profile = profileById.get(a.user_id)
              return (
                <li key={a.id} className="flex items-start gap-3">
                  <Avatar name={profile?.name ?? 'Someone'} url={profile?.avatar_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-on-surface">
                      <span className="font-semibold text-on-surface">{profile?.name ?? 'Someone'}</span> {a.text}
                    </p>
                    <p className="text-xs text-onSurfaceVariant">{timeAgo(a.created_at)}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <div className="flex items-center justify-center">
        <AvatarStack profiles={members.map((m) => m.profile)} max={6} />
      </div>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete challenge?">
        <div className="space-y-4">
          <p className="text-sm text-onSurfaceVariant">
            This permanently deletes <span className="font-semibold">{challenge.name}</span> and all of its tasks, completions, and activity for every member. This can't be undone.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(false)} className="flex-1">
              Cancel
            </Button>
            <Button variant="danger" onClick={doDelete} loading={deleting} className="flex-1">
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
