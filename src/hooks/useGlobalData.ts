import { useCallback, useEffect, useState } from 'react'
import { db } from '../lib'
import { useAuth } from '../contexts/AuthContext'
import { computeChallengeStats, daySummaryForUser, daysBetween, todayKey } from '../lib/calc'
import { syncAchievements } from '../lib/achievements'
import type { Activity, ChallengeWithMeta, Profile, UserAchievement } from '../lib/types'

export interface ActiveChallengeProgress {
  challenge: ChallengeWithMeta
  dayNumber: number
  totalDays: number
  pct: number
  todayPct: number
}

export interface GlobalStats {
  challenges: ChallengeWithMeta[]
  totalXp: number
  weekXp: number
  currentStreak: number
  longestStreak: number
  wins: number
  perfectDays: number
  perfectWeeks: number
  tasksCompleted: number
  achievements: { key: string; name: string; description: string; icon: string }[]
  unlocked: UserAchievement[]
  unlockedKeys: Set<string>
  activity: Activity[]
  community: Activity[]
  profileById: Record<string, Profile>
  todayDone: number
  todayTotal: number
  activeChallenges: ActiveChallengeProgress[]
  loading: boolean
  reload: () => void
}

export function useGlobalData(): GlobalStats {
  const { user } = useAuth()
  const [stats, setStats] = useState<Omit<GlobalStats, 'loading' | 'reload'>>({
    challenges: [],
    totalXp: 0,
    weekXp: 0,
    currentStreak: 0,
    longestStreak: 0,
    wins: 0,
    perfectDays: 0,
    perfectWeeks: 0,
    tasksCompleted: 0,
    achievements: [],
    unlocked: [],
    unlockedKeys: new Set(),
    activity: [],
    community: [],
    profileById: {},
    todayDone: 0,
    todayTotal: 0,
    activeChallenges: [],
  })
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true)
    ;(async () => {
      try {
        const [challenges, allAchievements, activity] = await Promise.all([
          db.listChallengesForUser(user.id),
          db.listAchievements(),
          db.listUserActivity(user.id, 20),
        ])

        let totalXp = 0
        let weekXp = 0
        let currentStreak = 0
        let longestStreak = 0
        let wins = 0
        let perfectDays = 0
        let perfectWeeks = 0
        let tasksCompleted = 0
        let todayDone = 0
        let todayTotal = 0

        const today = todayKey()
        const profileById: Record<string, Profile> = {}
        const community: Activity[] = []
        const activeChallenges: ActiveChallengeProgress[] = []

        for (const ch of challenges) {
          const [members, tasks, completions, acts] = await Promise.all([db.listMembers(ch.id), db.listTasks(ch.id), db.listCompletions(ch.id), db.listActivity(ch.id, 20)])
          const s = computeChallengeStats(ch, members, tasks, completions, members.map((m) => m.profile), user.id)
          totalXp += s.summary.totalXp
          weekXp += s.summary.weekXp
          currentStreak = Math.max(currentStreak, s.summary.currentStreak)
          longestStreak = Math.max(longestStreak, s.summary.longestStreak)
          wins += s.summary.wins
          perfectDays += s.summary.perfectDays
          perfectWeeks += s.summary.perfectWeeks
          tasksCompleted += s.summary.tasksCompleted

          const day = daySummaryForUser(tasks, completions, user.id, today, ch.daily_target)
          todayDone += day.done
          todayTotal += day.total

          community.push(...acts)
          for (const m of members) profileById[m.user_id] = m.profile

          const totalDays = daysBetween(ch.start_date, ch.end_date)
          if (today >= ch.start_date && today <= ch.end_date && totalDays > 0) {
            const dayNumber = Math.min(daysBetween(ch.start_date, today), totalDays)
            activeChallenges.push({
              challenge: ch,
              dayNumber,
              totalDays,
              pct: Math.round((dayNumber / totalDays) * 100),
              todayPct: day.pct,
            })
          }
        }

        community.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

        await syncAchievements(db, user.id)
        const unlocked = await db.listUserAchievements(user.id)

        if (!active) return
        setStats({
          challenges,
          totalXp,
          weekXp,
          currentStreak,
          longestStreak,
          wins,
          perfectDays,
          perfectWeeks,
          tasksCompleted,
          achievements: allAchievements,
          unlocked,
          unlockedKeys: new Set(unlocked.map((u) => u.achievement_key)),
          activity,
          community: community.slice(0, 12),
          profileById,
          todayDone,
          todayTotal,
          activeChallenges: activeChallenges.slice(0, 4),
        })
      } catch {
        // keep whatever we had
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

  return { ...stats, loading, reload }
}
