import type { AppDB } from './db'
import type { UserAchievement } from './types'
import { computeChallengeStats, evaluateAchievementKeys } from './calc'

export async function syncAchievements(db: AppDB, userId: string): Promise<UserAchievement[]> {
  const [existing, challenges] = await Promise.all([
    db.listUserAchievements(userId),
    db.listChallengesForUser(userId),
  ])

  const have = new Set(existing.map((a) => a.achievement_key))
  const unlocked: UserAchievement[] = []

  if (challenges.length === 0) return unlocked

  let hasCompletion = false
  let currentStreak = 0
  let longestStreak = 0
  let totalXp = 0
  let perfectDays = 0
  let perfectWeeks = 0
  let wins = 0
  let isMostImproved = false
  let isLeader = false
  let createdChallenge = false

  for (const ch of challenges) {
    if (ch.owner_id === userId) createdChallenge = true
    const [members, tasks, completions] = await Promise.all([
      db.listMembers(ch.id),
      db.listTasks(ch.id),
      db.listCompletions(ch.id),
    ])
    const allProfiles = await db.listProfiles(members.map((m) => m.user_id))

    const stats = computeChallengeStats(ch, members, tasks, completions, allProfiles, userId)
    hasCompletion = hasCompletion || stats.summary.tasksCompleted > 0
    currentStreak = Math.max(currentStreak, stats.summary.currentStreak)
    longestStreak = Math.max(longestStreak, stats.summary.longestStreak)
    totalXp += stats.summary.totalXp
    perfectDays += stats.summary.perfectDays
    perfectWeeks += stats.summary.perfectWeeks
    wins += stats.summary.wins
    if (stats.mostImproved === userId) isMostImproved = true
    if (stats.leaderboard.length > 0 && stats.leaderboard[0].user.id === userId) isLeader = true
  }

  const keys = evaluateAchievementKeys({
    hasCompletion,
    currentStreak,
    longestStreak,
    totalXp,
    perfectDays,
    perfectWeeks,
    wins,
    isMostImproved,
    isLeader,
    joinedChallenges: challenges.length,
    createdChallenge,
  })

  for (const key of keys) {
    if (!have.has(key)) {
      unlocked.push(await db.unlockAchievement(userId, key))
    }
  }

  return unlocked
}
