import type {
  Challenge,
  ChallengeMember,
  ChallengeStats,
  DateKey,
  DaySummary,
  LeaderboardRow,
  Profile,
  StatsSummary,
  Task,
  TaskCompletion,
} from './types'

// ---- Date helpers --------------------------------------------------------

export function toDateKey(d: Date): DateKey {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayKey(): DateKey {
  return toDateKey(new Date())
}

export function parseDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}

export function eachDayKeys(from: DateKey, to: DateKey): DateKey[] {
  const keys: DateKey[] = []
  let cur = parseDateKey(from)
  const end = parseDateKey(to)
  while (cur <= end) {
    keys.push(toDateKey(cur))
    cur = addDays(cur, 1)
  }
  return keys
}

export function daysBetween(from: DateKey, to: DateKey): number {
  return eachDayKeys(from, to).length
}

export function isDueOn(taskRepeat: Task['repeat'], date: DateKey): boolean {
  const day = parseDateKey(date).getDay() // 0 Sun - 6 Sat
  if (taskRepeat === 'daily') return true
  if (taskRepeat === 'weekdays') return day >= 1 && day <= 5
  if (taskRepeat === 'weekends') return day === 0 || day === 6
  return true
}

export function clampDateKey(key: DateKey, from: DateKey, to: DateKey): DateKey {
  if (key < from) return from
  if (key > to) return to
  return key
}

// ---- Completion / day stats ---------------------------------------------

export function daySummaryForUser(
  tasks: Task[],
  completions: TaskCompletion[],
  userId: string,
  date: DateKey,
  dailyTarget: number
): DaySummary {
  const due = tasks.filter((t) => isDueOn(t.repeat, date))
  const done = due.filter((t) =>
    completions.some((c) => c.task_id === t.id && c.user_id === userId && c.date === date)
  )
  const total = due.length
  const pct = total === 0 ? 0 : Math.round((done.length / total) * 100)
  const xp = done.reduce((sum, t) => sum + t.points, 0)
  return {
    date,
    total,
    done: done.length,
    pct,
    met: total > 0 && pct >= dailyTarget,
    xp,
  }
}

export function dailySummariesForUser(
  tasks: Task[],
  completions: TaskCompletion[],
  userId: string,
  days: DateKey[],
  dailyTarget: number
): Record<DateKey, DaySummary> {
  const out: Record<DateKey, DaySummary> = {}
  for (const d of days) {
    out[d] = daySummaryForUser(tasks, completions, userId, d, dailyTarget)
  }
  return out
}

export function xpForCompletions(
  tasks: Task[],
  completions: TaskCompletion[],
  userId: string,
  from: DateKey,
  to: DateKey
): number {
  const taskById = new Map(tasks.map((t) => [t.id, t]))
  let xp = 0
  for (const c of completions) {
    if (c.user_id !== userId) continue
    if (c.date < from || c.date > to) continue
    const task = taskById.get(c.task_id)
    if (task) xp += task.points
  }
  return xp
}

// ---- Streaks -------------------------------------------------------------

export function computeStreaks(
  metByDay: Record<DateKey, boolean>,
  allDays: DateKey[]
): { current: number; longest: number } {
  let current = 0
  let longest = 0
  let run = 0
  const today = todayKey()

  for (let i = 0; i < allDays.length; i++) {
    const d = allDays[i]
    if (metByDay[d]) {
      run += 1
      if (run > longest) longest = run
    } else {
      run = 0
    }
  }

  for (let i = allDays.length - 1; i >= 0; i--) {
    const d = allDays[i]
    if (d === today && !metByDay[d]) continue // today still in progress
    if (metByDay[d]) current += 1
    else break
  }

  return { current, longest }
}

// ---- Wins ------------------------------------------------------------------

export function computeWins(
  members: ChallengeMember[],
  tasks: Task[],
  completions: TaskCompletion[],
  days: DateKey[],
  dailyTarget: number
): Record<string, number> {
  const wins: Record<string, number> = {}
  for (const m of members) wins[m.user_id] = 0
  for (const d of days) {
    let best = 0
    const tops: string[] = []
    for (const m of members) {
      const s = daySummaryForUser(tasks, completions, m.user_id, d, dailyTarget)
      if (s.done > best) {
        best = s.done
        tops.length = 0
        tops.push(m.user_id)
      } else if (s.done === best && s.done > 0) {
        tops.push(m.user_id)
      }
    }
    if (best > 0) {
      for (const id of tops) wins[id] += 1
    }
  }
  return wins
}

// ---- Leaderboard -----------------------------------------------------------

export type PeriodFilter = 'today' | 'week' | 'month' | 'all'

export function periodRange(
  period: PeriodFilter,
  challengeStart: DateKey,
  challengeEnd: DateKey
): { from: DateKey; to: DateKey } {
  const today = todayKey()
  const to = clampDateKey(today, challengeStart, challengeEnd)
  let from = challengeStart
  if (period === 'today') from = today
  if (period === 'week') {
    const t = parseDateKey(today)
    from = toDateKey(addDays(t, -6))
  }
  if (period === 'month') {
    const t = parseDateKey(today)
    from = toDateKey(addDays(t, -29))
  }
  from = clampDateKey(from, challengeStart, to)
  return { from, to }
}

export function computeLeaderboard(
  members: ChallengeMember[],
  tasks: Task[],
  completions: TaskCompletion[],
  profiles: Profile[],
  challenge: Challenge,
  period: PeriodFilter
): LeaderboardRow[] {
  const { from, to } = periodRange(period, challenge.start_date, challenge.end_date)
  const days = eachDayKeys(from, to)
  const profileById = new Map(profiles.map((p) => [p.id, p]))
  const wins = computeWins(members, tasks, completions, days, challenge.daily_target)

  const rows = members
    .map((m) => {
      const daily = dailySummariesForUser(tasks, completions, m.user_id, days, challenge.daily_target)
      const metByDay: Record<DateKey, boolean> = {}
      for (const d of days) metByDay[d] = daily[d] ? daily[d].met : false
      const streaks = computeStreaks(metByDay, days)

      const totalTasks = days.reduce((sum, d) => sum + daily[d].total, 0)
      const doneTasks = days.reduce((sum, d) => sum + daily[d].done, 0)
      const completion = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100)
      const xp = xpForCompletions(tasks, completions, m.user_id, from, to)

      return {
        user: profileById.get(m.user_id) ?? null,
        xp,
        completion,
        streak: streaks.current,
        wins: wins[m.user_id] ?? 0,
      }
    })
    .filter((r): r is { user: Profile; xp: number; completion: number; streak: number; wins: number } => r.user !== null)
    .sort((a, b) => b.xp - a.xp || b.completion - a.completion || b.wins - a.wins)

  return rows.map((r, i) => ({ ...r, rank: i + 1 }))
}

// ---- Aggregate stats ---------------------------------------------------------

export function computeChallengeStats(
  challenge: Challenge,
  members: ChallengeMember[],
  tasks: Task[],
  completions: TaskCompletion[],
  profiles: Profile[],
  userId: string
): ChallengeStats {
  const today = todayKey()
  const start = clampDateKey(challenge.start_date, challenge.start_date, today)
  const allDays = eachDayKeys(start, today)
  const daily = dailySummariesForUser(tasks, completions, userId, allDays, challenge.daily_target)

  const currentStreak = computeStreaks(
    Object.fromEntries(allDays.map((d) => [d, daily[d].met])),
    allDays
  ).current
  const longestStreak = computeStreaks(
    Object.fromEntries(allDays.map((d) => [d, daily[d].met])),
    allDays
  ).longest

  const wins = computeWins(members, tasks, completions, allDays, challenge.daily_target)
  const perfectDays = allDays.filter((d) => {
    const s = daily[d]
    return s.total > 0 && s.done === s.total
  }).length

  let perfectWeeks = 0
  for (let i = 0; i < allDays.length; i += 7) {
    const week = allDays.slice(i, i + 7)
    if (week.length < 7) break
    if (week.every((d) => daily[d].met)) perfectWeeks += 1
  }

  const summary: StatsSummary = {
    totalXp: xpForCompletions(tasks, completions, userId, start, today),
    weekXp: xpForCompletions(tasks, completions, userId, toDateKey(addDays(parseDateKey(today), -6)), today),
    monthXp: xpForCompletions(tasks, completions, userId, toDateKey(addDays(parseDateKey(today), -29)), today),
    avgCompletion:
      allDays.length === 0
        ? 0
        : Math.round(allDays.reduce((sum, d) => sum + daily[d].pct, 0) / allDays.length),
    currentStreak,
    longestStreak,
    wins: wins[userId] ?? 0,
    perfectDays,
    perfectWeeks,
    tasksCompleted: allDays.reduce((sum, d) => sum + daily[d].done, 0),
    daysActive: allDays.filter((d) => daily[d].done > 0).length,
  }

  const leaderboard = computeLeaderboard(members, tasks, completions, profiles, challenge, 'all')

  // Most improved: compare completion in the two halves of elapsed days.
  const mostImproved = computeMostImproved(members, tasks, completions, allDays, challenge)
  const mostConsistent = computeMostConsistent(members, tasks, completions, allDays, challenge)

  const bestDay = computeBestDay(completions, allDays)

  return { summary, daily, leaderboard, mostImproved, mostConsistent, bestDay }
}

function computeMostImproved(
  members: ChallengeMember[],
  tasks: Task[],
  completions: TaskCompletion[],
  days: DateKey[],
  challenge: Challenge
): string | null {
  if (days.length < 4) return null
  const half = Math.floor(days.length / 2)
  const first = days.slice(0, half)
  const second = days.slice(half)
  let bestUser: string | null = null
  let bestImprovement = -Infinity
  for (const m of members) {
    const avg = (range: DateKey[]) => {
      if (range.length === 0) return 0
      const sum = range.reduce(
        (acc, d) => acc + daySummaryForUser(tasks, completions, m.user_id, d, challenge.daily_target).pct,
        0
      )
      return sum / range.length
    }
    const improvement = avg(second) - avg(first)
    if (improvement > bestImprovement) {
      bestImprovement = improvement
      bestUser = m.user_id
    }
  }
  return bestImprovement > 0 ? bestUser : null
}

function computeMostConsistent(
  members: ChallengeMember[],
  tasks: Task[],
  completions: TaskCompletion[],
  days: DateKey[],
  challenge: Challenge
): string | null {
  let bestUser: string | null = null
  let best = -1
  for (const m of members) {
    const met = days.filter(
      (d) => daySummaryForUser(tasks, completions, m.user_id, d, challenge.daily_target).met
    ).length
    if (met > best) {
      best = met
      bestUser = m.user_id
    }
  }
  return best > 0 ? bestUser : null
}

function computeBestDay(
  completions: TaskCompletion[],
  days: DateKey[]
): DateKey | null {
  let best: DateKey | null = null
  let bestCount = -1
  for (const d of days) {
    const count = completions.filter((c) => c.date === d).length
    if (count > bestCount) {
      bestCount = count
      best = d
    }
  }
  return bestCount > 0 ? best : null
}

// ---- Achievements ------------------------------------------------------------

export interface AchievementEvalInput {
  hasCompletion: boolean
  currentStreak: number
  longestStreak: number
  totalXp: number
  perfectDays: number
  perfectWeeks: number
  wins: number
  isMostImproved: boolean
  isLeader: boolean
  joinedChallenges: number
  createdChallenge: boolean
}

export function evaluateAchievementKeys(input: AchievementEvalInput): string[] {
  const keys: string[] = []
  if (input.hasCompletion) keys.push('first_task')
  if (input.currentStreak >= 7) keys.push('streak_7')
  if (input.currentStreak >= 14) keys.push('streak_14')
  if (input.currentStreak >= 30) keys.push('streak_30')
  if (input.perfectDays >= 1) keys.push('perfect_day')
  if (input.perfectWeeks >= 1) keys.push('perfect_week')
  if (input.totalXp >= 100) keys.push('xp_100')
  if (input.totalXp >= 500) keys.push('xp_500')
  if (input.totalXp >= 1000) keys.push('xp_1000')
  if (input.wins >= 1) keys.push('challenge_winner')
  if (input.isMostImproved) keys.push('most_improved')
  if (input.joinedChallenges >= 3) keys.push('challenge_lover')
  if (input.createdChallenge) keys.push('creator')
  return keys
}

export const ACHIEVEMENTS: {
  key: string
  name: string
  description: string
  icon: string
}[] = [
  { key: 'first_task', name: 'First Task', description: 'Complete your first task.', icon: 'check' },
  { key: 'streak_7', name: '7 Day Streak', description: 'Hit your daily target for 7 days in a row.', icon: 'flame' },
  { key: 'streak_14', name: '14 Day Streak', description: 'Hit your daily target for 14 days in a row.', icon: 'flame' },
  { key: 'streak_30', name: '30 Day Streak', description: 'Hit your daily target for 30 days in a row.', icon: 'flame' },
  { key: 'perfect_day', name: 'Perfect Day', description: 'Complete every task in a single day.', icon: 'sparkles' },
  { key: 'perfect_week', name: 'Perfect Week', description: 'Meet your target every day for a full week.', icon: 'calendar-check' },
  { key: 'xp_100', name: '100 XP', description: 'Earn 100 XP in total.', icon: 'zap' },
  { key: 'xp_500', name: '500 XP', description: 'Earn 500 XP in total.', icon: 'zap' },
  { key: 'xp_1000', name: '1000 XP', description: 'Earn 1000 XP in total.', icon: 'zap' },
  { key: 'challenge_winner', name: 'Challenge Winner', description: 'Win a daily challenge.', icon: 'trophy' },
  { key: 'most_improved', name: 'Most Improved', description: 'Show the biggest improvement in a challenge.', icon: 'trending-up' },
  { key: 'challenge_lover', name: 'Challenge Lover', description: 'Join 3 challenges.', icon: 'flag' },
  { key: 'creator', name: 'Creator', description: 'Create your first challenge.', icon: 'plus' },
]

export function achievementByKey(key: string) {
  return ACHIEVEMENTS.find((a) => a.key === key) ?? null
}

// ---- Misc ---------------------------------------------------------------------

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.max(0, now - then)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return new Date(iso).toLocaleDateString()
}

export function formatDate(key: DateKey): string {
  return parseDateKey(key).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatShortDate(key: DateKey): string {
  return parseDateKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return `GROWLY-${code}`
}
