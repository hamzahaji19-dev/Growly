export type DateKey = string // YYYY-MM-DD

export type Difficulty = 'easy' | 'medium' | 'hard'
export type RepeatSchedule = 'daily' | 'weekdays' | 'weekends'
export type TaskCategory =
  | 'workout'
  | 'coding'
  | 'reading'
  | 'web'
  | 'content'
  | 'mindfulness'
  | 'diet'
  | 'productivity'
  | 'other'

export interface Profile {
  id: string
  username: string
  name: string
  email: string
  bio: string | null
  avatar_url: string | null
  xp: number
  current_streak: number
  best_streak: number
  created_at: string
}

export interface Challenge {
  id: string
  owner_id: string
  name: string
  description: string | null
  start_date: DateKey
  end_date: DateKey
  visibility: 'private' | 'public'
  daily_target: number // 0 - 100
  competitive_mode: boolean
  proof_required: boolean
  invite_code: string
  created_at: string
}

export interface ChallengeMember {
  id: string
  challenge_id: string
  user_id: string
  role: 'owner' | 'member'
  joined_at: string
}

export interface Task {
  id: string
  challenge_id: string
  created_by: string
  name: string
  description: string | null
  category: TaskCategory
  difficulty: Difficulty
  points: number
  time: string | null
  repeat: RepeatSchedule
  proof_required: boolean
  created_at: string
}

export interface TaskCompletion {
  id: string
  challenge_id: string
  task_id: string
  user_id: string
  date: DateKey
  created_at: string
}

export interface ProofSubmission {
  id: string
  challenge_id: string
  task_id: string
  user_id: string
  completion_id: string
  type: 'image' | 'text' | 'url'
  content: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface Achievement {
  key: string
  name: string
  description: string
  icon: string
}

export interface UserAchievement {
  id: string
  user_id: string
  achievement_key: string
  unlocked_at: string
}

export interface Activity {
  id: string
  challenge_id: string
  user_id: string
  kind: string
  text: string
  created_at: string
}

export interface Invite {
  id: string
  challenge_id: string
  code: string
  created_by: string
  created_at: string
}

export interface AppNotification {
  id: string
  user_id: string
  kind: string
  text: string
  link: string | null
  read: boolean
  created_at: string
}

// ---- Query result shapes -------------------------------------------------

export interface MemberWithProfile extends ChallengeMember {
  profile: Profile
}

export interface ChallengeWithMeta extends Challenge {
  memberCount: number
  owner: Profile | null
}

export interface TaskWithState extends Task {
  completedToday: boolean
  todayCompletion: TaskCompletion | null
}

export interface LeaderboardRow {
  user: Profile
  xp: number
  completion: number // 0-100
  streak: number
  wins: number
  rank: number
}

export interface DaySummary {
  date: DateKey
  total: number
  done: number
  pct: number
  met: boolean
  xp: number
}

export interface ProofWithMeta extends ProofSubmission {
  profile: Profile
  task: Task | null
}

export interface StatsSummary {
  totalXp: number
  weekXp: number
  monthXp: number
  avgCompletion: number
  currentStreak: number
  longestStreak: number
  wins: number
  perfectDays: number
  perfectWeeks: number
  tasksCompleted: number
  daysActive: number
}

export interface ChallengeStats {
  summary: StatsSummary
  daily: Record<DateKey, DaySummary>
  leaderboard: LeaderboardRow[]
  mostImproved: string | null // user id
  mostConsistent: string | null // user id
  bestDay: DateKey | null
}
