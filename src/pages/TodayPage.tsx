import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Award, ChevronRight, Flag, Flame, Leaf, Plus, Sprout } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useGlobalData } from '../hooks/useGlobalData'
import { useTodayData } from '../hooks/useTodayData'
import { addDays, greeting, isDueOn, parseDateKey, todayKey, toDateKey } from '../lib/calc'
import { db } from '../lib'
import { Card, EmptyState, PageSpinner, ProgressBar } from '../components/ui'
import { ProgressRing } from '../components/ProgressRing'
import { TaskItem, CATEGORY_LABELS } from '../components/TaskItem'
import { NotificationsBell } from '../components/NotificationsBell'
import { ProofModal } from '../components/ProofModal'
import type { ChallengeWithMeta, Task, TaskCompletion } from '../lib/types'

interface PendingProof {
  task: Task
  completionId: string
}

interface TargetRow {
  challenge: ChallengeWithMeta
  task: Task
  doneToday: boolean
  streak: number
}

function taskStreak(completions: TaskCompletion[], taskId: string, userId: string, today: string): number {
  const done = new Set(completions.filter((c) => c.task_id === taskId && c.user_id === userId).map((c) => c.date))
  let streak = 0
  let d = today
  while (done.has(d)) {
    streak++
    d = toDateKey(addDays(parseDateKey(d), -1))
  }
  return streak
}

export function TodayPage() {
  const { user } = useAuth()
  const { items, loading, error, reload } = useTodayData()
  const { currentStreak, tasksCompleted, unlockedKeys, todayDone, todayTotal, activeChallenges } = useGlobalData()
  const { toast } = useToast()
  const [toggling, setToggling] = useState<string | null>(null)
  const [proofTarget, setProofTarget] = useState<PendingProof | null>(null)

  const today = todayKey()
  const handle = user?.username ?? 'friend'

  const toggle = async (task: Task, completed: boolean) => {
    if (!user || toggling) return
    setToggling(task.id)
    try {
      if (completed) {
        await db.uncompleteTask(task.id, user.id, today)
      } else {
        await db.completeTask(task.id, user.id, today)
        if (task.proof_required) {
          const comps: TaskCompletion[] = await db.listCompletions(task.challenge_id)
          const comp = comps.find((c) => c.task_id === task.id && c.user_id === user.id && c.date === today)
          if (comp) setProofTarget({ task, completionId: comp.id })
        }
      }
      reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update task.', 'error')
    } finally {
      setToggling(null)
    }
  }

  const targets: TargetRow[] = items.flatMap(({ challenge, tasks, completions }) =>
    tasks
      .filter((t) => isDueOn(t.repeat, today))
      .map((task) => ({
        challenge,
        task,
        doneToday: completions.some((c) => c.task_id === task.id && c.user_id === user?.id && c.date === today),
        streak: taskStreak(completions, task.id, user?.id ?? '', today),
      }))
  )

  const todayPct = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0
  const categories = Array.from(new Set(targets.map((t) => t.task.category)))

  const heroTitle =
    todayTotal === 0
      ? 'A rest day — recharge and grow.'
      : todayDone >= todayTotal
        ? 'Full bloom — every target met!'
        : todayDone > 0
          ? "You're on a streak!"
          : "Let's get growing today!"
  const heroCopy =
    todayTotal === 0
      ? 'No daily targets are due today. Enjoy the rest day, and come back stronger tomorrow.'
      : `You've completed ${todayDone} of ${todayTotal} daily targets. ${todayDone >= todayTotal ? 'Beautiful work.' : 'Just a little more effort to reach full bloom.'}`

  if (loading) return <PageSpinner />
  if (error) {
    return (
      <EmptyState
        icon={<Flag className="h-6 w-6" />}
        title="Couldn't load your day"
        description={error}
        action={
          <button onClick={reload} className="text-sm font-semibold text-primary-container hover:underline">
            Try again
          </button>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-primary md:text-3xl">
            {greeting()}, @{handle}!
          </h1>
          <p className="mt-1 text-sm text-onSurfaceVariant">Let's continue your growth journey today.</p>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <NotificationsBell />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Main column */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          {/* Hero progress ring */}
          <section className="relative overflow-hidden rounded-[20px] bg-surface-containerLowest p-6 shadow-card sm:p-8">
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary-fixed-dim/20 blur-3xl" />
            <div className="relative z-10 flex flex-col items-center gap-8 md:flex-row md:gap-10">
              <ProgressRing value={todayPct} size={176} stroke={9}>
                <div className="flex flex-col items-center">
                  <span className="font-display text-4xl font-bold text-primary">{todayPct}%</span>
                  <span className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-onSurfaceVariant">Daily Goal</span>
                </div>
              </ProgressRing>
              <div className="flex-1 text-center md:text-left">
                <h3 className="font-display text-xl font-bold text-primary md:text-2xl">{heroTitle}</h3>
                <p className="mt-2 text-sm text-onSurfaceVariant">{heroCopy}</p>
                {categories.length > 0 && (
                  <div className="mt-5 flex flex-wrap justify-center gap-2 md:justify-start">
                    {categories.map((c) => (
                      <span key={c} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {CATEGORY_LABELS[c]}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Today's Targets */}
            <section className="flex flex-col gap-4">
              <h3 className="font-display text-lg font-bold text-primary">Today's Targets</h3>
              {items.length === 0 ? (
                <Card className="flex flex-col items-center gap-3 border border-dashed border-surface-outlineVariant text-center shadow-none">
                  <p className="text-sm text-onSurfaceVariant">No challenges yet. Start your first habit today.</p>
                  <Link to="/create" className="inline-flex items-center gap-1.5 rounded-full bg-accent-gradient px-4 py-2 text-sm font-semibold text-white shadow-card hover:brightness-105">
                    <Plus className="h-4 w-4" /> Create a challenge
                  </Link>
                </Card>
              ) : targets.length === 0 ? (
                <Card className="text-center text-sm text-onSurfaceVariant shadow-none">Nothing due today. Enjoy the rest day!</Card>
              ) : (
                targets.map(({ task, doneToday, streak }) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    completed={doneToday}
                    streak={streak}
                    disabled={toggling === task.id}
                    onToggle={() => toggle(task, doneToday)}
                  />
                ))
              )}
            </section>

            {/* Active Challenges */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-primary">Active Challenges</h3>
                {activeChallenges.length > 0 && (
                  <Link to="/challenges" className="text-sm font-semibold text-secondary hover:underline">
                    View All
                  </Link>
                )}
              </div>
              {activeChallenges.length === 0 ? (
                <Card className="flex flex-col items-center gap-3 border border-dashed border-surface-outlineVariant text-center shadow-none">
                  <p className="text-sm text-onSurfaceVariant">No active challenges right now.</p>
                  <Link to="/create" className="text-sm font-semibold text-primary-container hover:underline">
                    Start one
                  </Link>
                </Card>
              ) : (
                activeChallenges.map(({ challenge, dayNumber, totalDays, pct }, i) => (
                  <Link
                    key={challenge.id}
                    to={`/challenge/${challenge.id}`}
                    className={`group flex flex-col gap-3 rounded-[20px] bg-surface-containerLowest p-4 shadow-card transition active:translate-y-px ${i > 0 ? 'opacity-70' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary-container">
                        <Leaf className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate font-display text-sm font-bold text-on-surface group-hover:text-primary-container">
                          {challenge.name}
                        </h4>
                        <p className="truncate text-xs text-onSurfaceVariant">{challenge.description ?? 'Daily habit challenge'}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-onSurfaceVariant/60" />
                    </div>
                    <div>
                      <ProgressBar value={pct} className="h-3" barClassName="bg-gradient-to-r from-secondary-container to-secondary" />
                      <div className="mt-1 flex justify-between text-xs font-medium text-onSurfaceVariant">
                        <span>
                          Day {dayNumber}/{totalDays}
                        </span>
                        <span>{pct}%</span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </section>
          </div>
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-6 lg:col-span-4">
          {/* Impact */}
          <section className="relative overflow-hidden rounded-[20px] bg-accent-gradient p-6 text-white shadow-lg">
            <h3 className="font-display text-lg font-bold">Your Impact</h3>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <ImpactStat icon={<Flame className="h-6 w-6" />} value={currentStreak} label="Day Streak" iconClass="text-secondary-fixed" />
              <ImpactStat icon={<Award className="h-6 w-6" />} value={unlockedKeys.size} label="Badges Earned" iconClass="text-tertiary-fixed" />
              <div className="col-span-2 rounded-xl bg-white/10 p-4 text-center">
                <Sprout className="mx-auto mb-1 h-6 w-6 text-primary-fixed" />
                <p className="font-display text-2xl font-bold">{tasksCompleted}</p>
                <p className="text-xs font-medium opacity-80">Total Habits Completed</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <ProofModal target={proofTarget} onClose={() => setProofTarget(null)} onSubmitted={reload} />
    </div>
  )
}

function ImpactStat({ icon, value, label, iconClass }: { icon: React.ReactNode; value: number; label: string; iconClass: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-white/10 p-4 text-center">
      <span className={`mb-1 ${iconClass}`}>{icon}</span>
      <p className="font-display text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium opacity-80">{label}</p>
    </div>
  )
}
