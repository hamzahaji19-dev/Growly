import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, Flame, Globe, KeyRound, Lock, Plus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { db } from '../lib'
import { daySummaryForUser, daysBetween, todayKey } from '../lib/calc'
import type { ChallengeWithMeta, MemberWithProfile } from '../lib/types'
import { Button, EmptyState, Input, PageSpinner, ProgressBar } from '../components/ui'
import { AvatarStack } from '../components/Avatar'
import clsx from 'clsx'

interface Row {
  challenge: ChallengeWithMeta
  pct: number
  met: boolean
  dayNumber: number
  totalDays: number
  members: MemberWithProfile[]
}

type Tab = 'active' | 'join' | 'completed'

function useRows(): { joined: Row[]; completed: Row[]; loading: boolean; reload: () => void } {
  const { user } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true)
    ;(async () => {
      try {
        const [mineCh, pubCh] = await Promise.all([db.listChallengesForUser(user.id), db.listPublicChallenges(user.id)])
        const today = todayKey()
        const toRows = async (list: ChallengeWithMeta[]): Promise<Row[]> =>
          Promise.all(
            list.map(async (ch) => {
              const [tasks, completions, members] = await Promise.all([db.listTasks(ch.id), db.listCompletions(ch.id), db.listMembers(ch.id)])
              const summary = daySummaryForUser(tasks, completions, user.id, today, ch.daily_target)
              const totalDays = Math.max(daysBetween(ch.start_date, ch.end_date), 1)
              const dayNumber = Math.min(Math.max(daysBetween(ch.start_date, today), 0), totalDays)
              return { challenge: ch, pct: summary.pct, met: summary.met, dayNumber, totalDays, members }
            })
          )
        const [mineRows, pubRows] = await Promise.all([toRows(mineCh), toRows(pubCh)])
        if (active) {
          setRows([...mineRows, ...pubRows])
        }
      } catch {
        if (active) setRows([])
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [user, tick])

  useEffect(() => {
    if (!user) return
    return db.subscribeToUser(user.id, reload)
  }, [user, reload])

  const today = todayKey()
  const joined = rows.filter((r) => r.challenge.end_date >= today)
  const completed = rows.filter((r) => r.challenge.end_date < today)
  return { joined, completed, loading, reload }
}

function BadgeChip({ icon, label, tone }: { icon: React.ReactNode; label: string; tone: 'orange' | 'gray' | 'green' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider',
        tone === 'orange' && 'bg-secondary-fixed text-secondary-onFixed',
        tone === 'gray' && 'bg-surface-containerHighest text-onSurfaceVariant',
        tone === 'green' && 'bg-primary-fixed/70 text-primary-onFixedVariant'
      )}
    >
      {icon}
      {label}
    </span>
  )
}

function ChallengeCard({ row, onJoin, joining }: { row: Row; onJoin?: () => void; joining?: boolean }) {
  const { challenge, pct, dayNumber, totalDays, members } = row
  const badges = (
    <div className="flex gap-1.5">
      {challenge.competitive_mode && <BadgeChip icon={<Flame className="h-3 w-3" />} label="Competitive" tone="orange" />}
      {challenge.visibility === 'public' ? (
        <BadgeChip icon={<Globe className="h-3 w-3" />} label="Public" tone="green" />
      ) : (
        <BadgeChip icon={<Lock className="h-3 w-3" />} label="Private" tone="gray" />
      )}
    </div>
  )

  return (
    <article className="flex h-full min-h-[260px] flex-col rounded-[20px] bg-surface-containerLowest p-4 shadow-card transition hover:shadow-pop">
      <Link to={`/challenge/${challenge.id}`} className="flex flex-1 flex-col gap-3">
        {badges}
        <div>
          <h3 className="font-display text-xl font-bold leading-tight text-onSurface">{challenge.name}</h3>
          {challenge.description && <p className="mt-1 line-clamp-2 text-sm text-onSurfaceVariant">{challenge.description}</p>}
        </div>
        <div className="mt-auto flex items-center justify-between pt-3">
          <AvatarStack profiles={members.map((m) => m.profile)} max={3} />
          <span className="flex items-center gap-1 text-xs font-medium text-onSurfaceVariant">
            <CalendarDays className="h-4 w-4" /> Day {dayNumber}/{totalDays}
          </span>
        </div>
      </Link>
      {onJoin ? (
        <div className="mt-3 border-t border-surface-outlineVariant/50 pt-3">
          <Button size="sm" className="w-full" loading={joining} onClick={onJoin}>
            Join Challenge
          </Button>
        </div>
      ) : (
        <div className="mt-3 border-t border-surface-outlineVariant/50 pt-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-semibold text-onSurface">Your Progress</span>
            <span className="font-semibold text-secondary">{pct}%</span>
          </div>
          <ProgressBar value={pct} className="h-2" barClassName="bg-secondary-container" />
        </div>
      )}
    </article>
  )
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'active', label: 'Active Challenges' },
  { key: 'join', label: 'Available to Join' },
  { key: 'completed', label: 'Completed' },
]

export function ChallengesPage() {
  const { user } = useAuth()
  const { joined, completed, loading, reload } = useRows()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('active')
  const [code, setCode] = useState('')
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [codeLoading, setCodeLoading] = useState(false)

  const mine = joined.filter((r) => r.challenge.owner_id === user?.id || r.members.some((m) => m.user_id === user?.id))
  const joinable = joined.filter((r) => !r.members.some((m) => m.user_id === user?.id))

  const joinByCode = async () => {
    if (!user || !code.trim()) return
    setCodeLoading(true)
    try {
      const { challenge } = await db.joinByCode(code.trim(), user.id)
      toast(`Joined ${challenge.name}!`)
      navigate(`/challenge/${challenge.id}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Invalid invite code.', 'error')
    } finally {
      setCodeLoading(false)
    }
  }

  const join = async (id: string) => {
    if (!user) return
    setJoiningId(id)
    try {
      await db.addMember(id, user.id)
      toast('Joined the challenge!')
      reload()
      navigate(`/challenge/${id}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not join.', 'error')
    } finally {
      setJoiningId(null)
    }
  }

  if (loading) return <PageSpinner />

  const list = tab === 'active' ? mine : tab === 'join' ? joinable : completed

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-onSurface md:text-3xl">Challenges</h1>
          <p className="mt-1 text-sm text-onSurfaceVariant">Push your limits, together.</p>
        </div>
        <div className="flex w-full items-center gap-2 md:w-auto">
          <div className="relative flex-1 md:w-64">
            <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-onSurfaceVariant" />
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && joinByCode()}
              placeholder="Enter challenge code"
              className="rounded-full py-2.5 pl-9"
              disabled={codeLoading}
            />
          </div>
          <Link to="/create">
            <Button size="lg" className="whitespace-nowrap px-5">
              <Plus className="h-5 w-5" /> New Challenge
            </Button>
          </Link>
        </div>
      </header>

      <div className="scrollbar-hide -mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-6 border-b border-surface-outlineVariant">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                'whitespace-nowrap border-b-2 pb-2.5 text-sm font-semibold transition',
                tab === t.key ? 'border-secondary-container text-primary' : 'border-transparent text-onSurfaceVariant hover:text-primary'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<KeyRound className="h-6 w-6" />}
          title={
            tab === 'active'
              ? 'No active challenges'
              : tab === 'join'
                ? 'Nothing to join right now'
                : 'No completed challenges yet'
          }
          description={
            tab === 'active'
              ? 'Create your own challenge and invite friends, or join one with an invite code.'
              : tab === 'join'
                ? 'Check back later, or share your invite code with friends to get started.'
                : 'Your finished challenges will show up here.'
          }
          action={
            tab === 'active' ? (
              <Link to="/create">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-gradient px-4 py-2 text-sm font-semibold text-white shadow-card hover:brightness-105">
                  <Plus className="h-4 w-4" /> Create a challenge
                </span>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((row) => (
            <ChallengeCard
              key={row.challenge.id}
              row={row}
              onJoin={tab === 'join' ? () => join(row.challenge.id) : undefined}
              joining={joiningId === row.challenge.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
