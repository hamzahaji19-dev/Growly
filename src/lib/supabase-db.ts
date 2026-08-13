import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from './supabase'
import { normalizeUsername } from './local-db'
import type { AppDB, ChallengeInput, ProfileInput, SessionUser, TaskInput } from './db'
import type {
  Activity,
  AppNotification,
  Challenge,
  MemberWithProfile,
  Profile,
  ProofWithMeta,
  Task,
  TaskCompletion,
  UserAchievement,
} from './types'
import { ACHIEVEMENTS, generateInviteCode } from './calc'

const SESSION_KEY = 'growly:session'

interface StoredSession {
  id: string
  username: string
}

const sessionListeners = new Set<(user: SessionUser | null) => void>()

function emitSession(user: SessionUser | null) {
  sessionListeners.forEach((cb) => cb(user))
}

function readSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSession
    if (!parsed?.id || !parsed?.username) return null
    return parsed
  } catch {
    return null
  }
}

function writeSession(user: SessionUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
  emitSession(user)
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY)
  emitSession(null)
}

function capitalize(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function notConfigured(): never {
  throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
}

function tables() {
  if (!supabase) return notConfigured()
  return supabase
}

interface RealtimeSubscription {
  channel: RealtimeChannel
  handlers: Set<() => void>
}

const realtimeSubscriptions = new Map<string, RealtimeSubscription>()
let realtimeChannelSeq = 0

function subscribeRealtime(key: string, filter: string, cb: () => void): () => void {
  if (!supabase) return () => {}
  const client = supabase
  const existing = realtimeSubscriptions.get(key)
  if (existing) {
    existing.handlers.add(cb)
    return () => {
      existing.handlers.delete(cb)
      if (existing.handlers.size === 0) {
        realtimeSubscriptions.delete(key)
        client.removeChannel(existing.channel)
      }
    }
  }
  const handlers = new Set<() => void>([cb])
  const channel = client
    .channel(`${key}:${++realtimeChannelSeq}`)
    .on('postgres_changes', { event: '*', schema: 'public', filter }, () => {
      handlers.forEach((h) => h())
    })
  const entry: RealtimeSubscription = { channel, handlers }
  realtimeSubscriptions.set(key, entry)
  channel.subscribe()
  return () => {
    entry.handlers.delete(cb)
    if (entry.handlers.size === 0) {
      realtimeSubscriptions.delete(key)
      client.removeChannel(entry.channel)
    }
  }
}

export const supabaseDB: AppDB = {
  async getOrCreateByUsername(rawUsername) {
    const sb = tables()
    const username = normalizeUsername(rawUsername)
    if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new Error('Username must be 3–20 characters and can only contain letters, numbers, and underscores.')

    const { data: existing, error } = await sb.from('profiles').select('id, username').eq('username', username).maybeSingle()
    if (error) throw error
    if (existing) {
      const user = { id: existing.id as string, username: existing.username as string }
      writeSession(user)
      return { user, created: false }
    }

    const id = crypto.randomUUID()
    const { data: created, error: insertError } = await sb
      .from('profiles')
      .insert({ id, username, name: capitalize(username), email: '', bio: null, avatar_url: null, xp: 0, current_streak: 0, best_streak: 0 })
      .select('id, username')
      .single()
    if (insertError) throw insertError

    const user = { id: created.id as string, username: created.username as string }
    writeSession(user)
    return { user, created: true }
  },

  async checkUsername(rawUsername) {
    const sb = tables()
    const username = normalizeUsername(rawUsername)
    if (!username) return false
    const { data, error } = await sb.from('profiles').select('id').eq('username', username).maybeSingle()
    if (error) throw error
    return !data
  },

  async signOut() {
    clearSession()
    if (supabase) {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    }
  },

  async getSession() {
    return readSession()
  },

  onAuthChange(cb) {
    sessionListeners.add(cb)
    const onStorage = (e: StorageEvent) => {
      if (e.key === SESSION_KEY) cb(readSession())
    }
    window.addEventListener('storage', onStorage)
    return () => {
      sessionListeners.delete(cb)
      window.removeEventListener('storage', onStorage)
    }
  },

  async getProfile(userId) {
    const sb = tables()
    const { data, error } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (error) throw error
    return data as Profile | null
  },

  async updateProfile(userId, input: ProfileInput) {
    const sb = tables()
    const { data, error } = await sb
      .from('profiles')
      .update({ name: input.name, bio: input.bio ?? null, avatar_url: input.avatar_url ?? null })
      .eq('id', userId)
      .select()
      .single()
    if (error) throw error
    return data as Profile
  },

  async uploadAvatar(userId, file) {
    const sb = tables()
    const path = `avatars/${userId}/${Date.now()}-${file.name}`
    const { error } = await sb.storage.from('proofs').upload(path, file)
    if (error) throw error
    const { data } = sb.storage.from('proofs').getPublicUrl(path)
    return data.publicUrl
  },

  async listProfiles(ids) {
    if (ids.length === 0) return []
    const sb = tables()
    const { data, error } = await sb.from('profiles').select('*').in('id', ids)
    if (error) throw error
    return (data as Profile[]) ?? []
  },

  async listChallengesForUser(userId) {
    const sb = tables()
    const { data, error } = await sb
      .from('challenge_members')
      .select('challenge:challenges(id, owner_id, name, description, start_date, end_date, visibility, daily_target, competitive_mode, proof_required, invite_code, created_at)')
      .eq('user_id', userId)
    if (error) throw error
    const seen = new Map<string, Challenge>()
    for (const row of (data ?? []) as unknown as { challenge?: Challenge | Challenge[] }[]) {
      const raw = row.challenge
      const ch = Array.isArray(raw) ? raw[0] : raw
      if (ch) seen.set(ch.id, ch)
    }
    const rows = await Promise.all(
      [...seen.values()].map(async (c) => {
        const { count } = await sb.from('challenge_members').select('*', { count: 'exact', head: true }).eq('challenge_id', c.id)
        const owner = await this.getProfile(c.owner_id)
        return { ...c, memberCount: count ?? 0, owner }
      })
    )
    return rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  },

  async listPublicChallenges(userId) {
    const sb = tables()
    const { data: mine, error: mineErr } = await sb.from('challenge_members').select('challenge_id').eq('user_id', userId)
    if (mineErr) throw mineErr
    const mineIds = (mine ?? []).map((r) => r.challenge_id)
    const { data, error } = await sb.from('challenges').select('*').eq('visibility', 'public').not('id', 'in', mineIds.length ? mineIds : ['__none__'])
    if (error) throw error
    const rows = await Promise.all(
      (data ?? []).map(async (c) => {
        const { count } = await sb.from('challenge_members').select('*', { count: 'exact', head: true }).eq('challenge_id', c.id)
        const owner = await this.getProfile(c.owner_id)
        return { ...c, memberCount: count ?? 0, owner }
      })
    )
    return rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  },

  async getChallenge(id) {
    const sb = tables()
    const { data, error } = await sb.from('challenges').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data as Challenge | null
  },

  async createChallenge(ownerId, input: ChallengeInput) {
    const sb = tables()
    const { data, error } = await sb
      .from('challenges')
      .insert({ ...input, owner_id: ownerId, invite_code: generateInviteCode() })
      .select()
      .single()
    if (error) throw error
    await sb.from('challenge_members').insert({ challenge_id: data.id, user_id: ownerId, role: 'owner' })
    await sb.from('invites').insert({ challenge_id: data.id, code: data.invite_code, created_by: ownerId })
    await sb.from('activity').insert({ challenge_id: data.id, user_id: ownerId, kind: 'created', text: 'created the challenge' })
    return data as Challenge
  },

  async updateChallenge(id, patch: Partial<ChallengeInput>) {
    const sb = tables()
    const { data, error } = await sb.from('challenges').update(patch).eq('id', id).select().single()
    if (error) throw error
    return data as Challenge
  },

  async deleteChallenge(id) {
    const sb = tables()
    const { error } = await sb.from('challenges').delete().eq('id', id)
    if (error) throw error
  },

  async listMembers(challengeId) {
    const sb = tables()
    const { data, error } = await sb
      .from('challenge_members')
      .select('*, profile:profiles(*)')
      .eq('challenge_id', challengeId)
    if (error) throw error
    return (data as MemberWithProfile[]) ?? []
  },

  async addMember(challengeId, userId, role = 'member') {
    const sb = tables()
    await sb.from('challenge_members').insert({ challenge_id: challengeId, user_id: userId, role })
    await sb.from('activity').insert({ challenge_id: challengeId, user_id: userId, kind: 'joined', text: 'joined the challenge' })
  },

  async removeMember(challengeId, userId) {
    const sb = tables()
    const { error } = await sb.from('challenge_members').delete().eq('challenge_id', challengeId).eq('user_id', userId)
    if (error) throw error
  },

  async getChallengeByCode(code) {
    const sb = tables()
    const normalized = code.trim().toUpperCase().startsWith('GROWLY-') ? code.trim().toUpperCase() : `GROWLY-${code.trim().toUpperCase()}`
    const { data, error } = await sb.from('challenges').select('*').ilike('invite_code', normalized).maybeSingle()
    if (error) throw error
    return data as Challenge | null
  },

  async joinByCode(code, userId) {
    const sb = tables()
    const challenge = await this.getChallengeByCode(code)
    if (!challenge) throw new Error('Invalid invite code.')
    const { data: existing } = await sb
      .from('challenge_members')
      .select('*')
      .eq('challenge_id', challenge.id)
      .eq('user_id', userId)
      .maybeSingle()
    if (!existing) {
      await sb.from('challenge_members').insert({ challenge_id: challenge.id, user_id: userId, role: 'member' })
      await sb.from('activity').insert({ challenge_id: challenge.id, user_id: userId, kind: 'joined', text: 'joined the challenge' })
    }
    return { challenge, created: !existing }
  },

  async listTasks(challengeId) {
    const sb = tables()
    const { data, error } = await sb.from('tasks').select('*').eq('challenge_id', challengeId).order('created_at')
    if (error) throw error
    return (data as Task[]) ?? []
  },

  async createTask(challengeId, creatorId, input: TaskInput) {
    const sb = tables()
    const { data, error } = await sb
      .from('tasks')
      .insert({ ...input, challenge_id: challengeId, created_by: creatorId })
      .select()
      .single()
    if (error) throw error
    await sb.from('activity').insert({ challenge_id: challengeId, user_id: creatorId, kind: 'task_created', text: `added the task "${input.name}"` })
    return data as Task
  },

  async updateTask(taskId, patch: Partial<TaskInput>) {
    const sb = tables()
    const { data, error } = await sb.from('tasks').update(patch).eq('id', taskId).select().single()
    if (error) throw error
    return data as Task
  },

  async deleteTask(taskId) {
    const sb = tables()
    const { error } = await sb.from('tasks').delete().eq('id', taskId)
    if (error) throw error
  },

  async listCompletions(challengeId) {
    const sb = tables()
    const { data, error } = await sb.from('task_completions').select('*').eq('challenge_id', challengeId)
    if (error) throw error
    return (data as TaskCompletion[]) ?? []
  },

  async completeTask(taskId, userId, date) {
    const sb = tables()
    const { data: task } = await sb.from('tasks').select('*').eq('id', taskId).single()
    if (!task) throw new Error('Task not found.')
    const { data: existing } = await sb
      .from('task_completions')
      .select('*')
      .eq('task_id', taskId)
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()
    if (existing) return
    await sb.from('task_completions').insert({ challenge_id: task.challenge_id, task_id: taskId, user_id: userId, date })
    await sb.from('activity').insert({ challenge_id: task.challenge_id, user_id: userId, kind: 'task_completed', text: `completed ${task.name}` })
  },

  async uncompleteTask(taskId, userId, date) {
    const sb = tables()
    const { error } = await sb.from('task_completions').delete().eq('task_id', taskId).eq('user_id', userId).eq('date', date)
    if (error) throw error
  },

  async submitProof(completionId, taskId, userId, challengeId, type, content) {
    const sb = tables()
    const { error } = await sb.from('proof_submissions').insert({ completion_id: completionId, task_id: taskId, user_id: userId, challenge_id: challengeId, type, content, status: 'pending' })
    if (error) throw error
  },

  async listProofs(challengeId) {
    const sb = tables()
    const { data, error } = await sb
      .from('proof_submissions')
      .select('*, profile:profiles(*), task:tasks(*)')
      .eq('challenge_id', challengeId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data as ProofWithMeta[]) ?? []
  },

  async reviewProof(proofId, status, reviewerId) {
    const sb = tables()
    const { error } = await sb.from('proof_submissions').update({ status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() }).eq('id', proofId)
    if (error) throw error
  },

  async listActivity(challengeId, limit = 50) {
    const sb = tables()
    const { data, error } = await sb
      .from('activity')
      .select('*, profile:profiles(*)')
      .eq('challenge_id', challengeId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data as Activity[]) ?? []
  },

  async listUserActivity(userId, limit = 20) {
    const sb = tables()
    const { data, error } = await sb
      .from('activity')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data as Activity[]) ?? []
  },

  async listAchievements() {
    return ACHIEVEMENTS
  },

  async listUserAchievements(userId) {
    const sb = tables()
    const { data, error } = await sb
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false })
    if (error) throw error
    return (data as UserAchievement[]) ?? []
  },

  async unlockAchievement(userId, key) {
    const sb = tables()
    const { data, error } = await sb.from('user_achievements').upsert({ user_id: userId, achievement_key: key }).select().single()
    if (error) throw error
    return data as UserAchievement
  },

  async listNotifications(userId) {
    const sb = tables()
    const { data, error } = await sb.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
    if (error) throw error
    return (data as AppNotification[]) ?? []
  },

  async createNotification(userId, kind, text, link = null) {
    const sb = tables()
    await sb.from('notifications').insert({ user_id: userId, kind, text, link })
  },

  async markNotificationRead(id) {
    const sb = tables()
    await sb.from('notifications').update({ read: true }).eq('id', id)
  },

  async markAllNotificationsRead(userId) {
    const sb = tables()
    await sb.from('notifications').update({ read: true }).eq('user_id', userId)
  },

  async pushScheduledNotifications(_userId) {
    // Scheduled notifications are emitted by database triggers / edge functions in production.
  },

  subscribeToChallenge(challengeId, cb) {
    return subscribeRealtime(`challenge:${challengeId}`, `challenge_id=eq.${challengeId}`, cb)
  },

  subscribeToUser(userId, cb) {
    return subscribeRealtime(`user:${userId}`, `user_id=eq.${userId}`, cb)
  },
}

export { isSupabaseConfigured }
