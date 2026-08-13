import type {
  Activity,
  AppNotification,
  Challenge,
  ChallengeMember,
  ChallengeWithMeta,
  MemberWithProfile,
  Profile,
  ProofSubmission,
  ProofWithMeta,
  Task,
  TaskCompletion,
  UserAchievement,
} from './types'

export interface SessionUser {
  id: string
  username: string
}

export interface EnterResult {
  user: SessionUser
  created: boolean
}

export interface TaskInput {
  name: string
  description?: string | null
  category: Task['category']
  difficulty: Task['difficulty']
  points: number
  time?: string | null
  repeat: Task['repeat']
  proof_required: boolean
}

export interface ChallengeInput {
  name: string
  description?: string | null
  start_date: string
  end_date: string
  visibility: 'private' | 'public'
  daily_target: number
  competitive_mode: boolean
  proof_required: boolean
}

export interface ProfileInput {
  name: string
  bio?: string | null
  avatar_url?: string | null
}

export type Unsubscribe = () => void

export interface AppDB {
  // auth (username-only)
  getOrCreateByUsername(username: string): Promise<EnterResult>
  checkUsername(username: string): Promise<boolean>
  signOut(): Promise<void>
  getSession(): Promise<SessionUser | null>
  onAuthChange(cb: (user: SessionUser | null) => void): Unsubscribe

  // profile
  getProfile(userId: string): Promise<Profile | null>
  updateProfile(userId: string, input: ProfileInput): Promise<Profile>
  uploadAvatar(userId: string, file: File): Promise<string>
  listProfiles(ids: string[]): Promise<Profile[]>

  // challenges
  listChallengesForUser(userId: string): Promise<ChallengeWithMeta[]>
  listPublicChallenges(userId: string): Promise<ChallengeWithMeta[]>
  getChallenge(id: string): Promise<Challenge | null>
  createChallenge(ownerId: string, input: ChallengeInput): Promise<Challenge>
  updateChallenge(id: string, patch: Partial<ChallengeInput>): Promise<Challenge>
  deleteChallenge(id: string): Promise<void>

  // members
  listMembers(challengeId: string): Promise<MemberWithProfile[]>
  addMember(challengeId: string, userId: string, role?: 'owner' | 'member'): Promise<void>
  removeMember(challengeId: string, userId: string): Promise<void>
  getChallengeByCode(code: string): Promise<Challenge | null>
  joinByCode(code: string, userId: string): Promise<{ challenge: Challenge; created: boolean }>

  // tasks
  listTasks(challengeId: string): Promise<Task[]>
  createTask(challengeId: string, creatorId: string, input: TaskInput): Promise<Task>
  updateTask(taskId: string, patch: Partial<TaskInput>): Promise<Task>
  deleteTask(taskId: string): Promise<void>
  listCompletions(challengeId: string): Promise<TaskCompletion[]>
  completeTask(taskId: string, userId: string, date: string): Promise<void>
  uncompleteTask(taskId: string, userId: string, date: string): Promise<void>

  // proof
  submitProof(completionId: string, taskId: string, userId: string, challengeId: string, type: 'image' | 'text' | 'url', content: string): Promise<void>
  listProofs(challengeId: string): Promise<ProofWithMeta[]>
  reviewProof(proofId: string, status: 'approved' | 'rejected', reviewerId: string): Promise<void>

  // activity
  listActivity(challengeId: string, limit?: number): Promise<Activity[]>
  listUserActivity(userId: string, limit?: number): Promise<Activity[]>

  // achievements
  listAchievements(): Promise<{ key: string; name: string; description: string; icon: string }[]>
  listUserAchievements(userId: string): Promise<UserAchievement[]>
  unlockAchievement(userId: string, key: string): Promise<UserAchievement>

  // notifications
  listNotifications(userId: string): Promise<AppNotification[]>
  createNotification(userId: string, kind: string, text: string, link?: string | null): Promise<void>
  markNotificationRead(id: string): Promise<void>
  markAllNotificationsRead(userId: string): Promise<void>
  pushScheduledNotifications(userId: string): Promise<void>

  // realtime
  subscribeToChallenge(challengeId: string, onChange: () => void): Unsubscribe
  subscribeToUser(userId: string, onChange: () => void): Unsubscribe
}

export type { ChallengeMember, ProofSubmission, Profile }
