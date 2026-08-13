import type { AppDB, SessionUser, Unsubscribe } from './db'
import type {
  Activity,
  AppNotification,
  Challenge,
  ChallengeWithMeta,
  MemberWithProfile,
  Profile,
  ProofWithMeta,
  Task,
  TaskCompletion,
  UserAchievement,
} from './types'
import { ACHIEVEMENTS, addDays, toDateKey, todayKey, uid, generateInviteCode } from './calc'
import { syncAchievements } from './achievements'

const STORAGE_KEY = 'growly:local:v1'

interface DbTables {
  users: Record<string, { id: string; username: string; email: string; password: string }>
  session: string | null
  profiles: Record<string, Profile>
  challenges: Record<string, Challenge>
  members: Array<{ id: string; challenge_id: string; user_id: string; role: 'owner' | 'member'; joined_at: string }>
  tasks: Task[]
  completions: TaskCompletion[]
  proofs: ProofWithMeta[]
  userAchievements: UserAchievement[]
  activity: Activity[]
  invites: Array<{ id: string; challenge_id: string; code: string; created_by: string; created_at: string }>
  notifications: AppNotification[]
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

function displayName(username: string): string {
  return username.charAt(0).toUpperCase() + username.slice(1)
}

function deriveUsername(name: string, taken: (u: string) => boolean): string {
  let base = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  if (base.length < 3) base = (base + 'growly').slice(0, 20)
  if (base.length > 20) base = base.slice(0, 20)
  let candidate = base
  let i = 2
  while (taken(candidate)) {
    const suffix = String(i++)
    candidate = base.slice(0, Math.max(3, 20 - suffix.length)) + suffix
  }
  return candidate
}

function migrate(tables: DbTables): boolean {
  let changed = false
  const used = new Set<string>()
  for (const p of Object.values(tables.profiles)) {
    if (p && typeof p.username === 'string') used.add(p.username)
  }
  for (const p of Object.values(tables.profiles)) {
    if (!p) continue
    if (typeof p.username !== 'string' || !p.username) {
      p.username = deriveUsername(p.name || p.email || 'user', (u) => used.has(u))
      used.add(p.username)
      changed = true
    }
    if (typeof p.xp !== 'number') {
      p.xp = 0
      changed = true
    }
    if (typeof p.current_streak !== 'number') {
      p.current_streak = 0
      changed = true
    }
    if (typeof p.best_streak !== 'number') {
      p.best_streak = 0
      changed = true
    }
  }
  for (const rec of Object.values(tables.users)) {
    if (!rec) continue
    if (typeof rec.username !== 'string' || !rec.username) {
      rec.username = tables.profiles[rec.id]?.username ?? (rec.email ? rec.email.split('@')[0] : 'user')
      changed = true
    }
  }
  return changed
}

function emptyTables(): DbTables {
  return {
    users: {},
    session: null,
    profiles: {},
    challenges: {},
    members: [],
    tasks: [],
    completions: [],
    proofs: [],
    userAchievements: [],
    activity: [],
    invites: [],
    notifications: [],
  }
}

function load(): DbTables {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyTables()
    const tables = JSON.parse(raw) as DbTables
    if (migrate(tables)) save(tables)
    return tables
  } catch {
    return emptyTables()
  }
}

function save(tables: DbTables) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tables))
}

function hashPassword(pw: string): string {
  let h = 0
  for (let i = 0; i < pw.length; i++) {
    h = (h * 31 + pw.charCodeAt(i)) | 0
  }
  return 'h' + Math.abs(h).toString(36)
}

// ---- Event bus (simulates Supabase Realtime locally) ----------------------

const listeners = new Map<string, Set<() => void>>()

function emit(key: string) {
  const set = listeners.get(key)
  if (set) set.forEach((cb) => cb())
}

function on(key: string, cb: () => void): Unsubscribe {
  if (!listeners.has(key)) listeners.set(key, new Set())
  listeners.get(key)!.add(cb)
  return () => {
    listeners.get(key)?.delete(cb)
  }
}

function emitAuth() {
  const tables = load()
  const id = tables.session
  const user = id && tables.users[id] ? { id, username: tables.profiles[id]?.username ?? tables.users[id].username } : null
  const set = listeners.get('auth')
  if (set) set.forEach((cb) => (cb as (u: SessionUser | null) => void)(user))
}

// ---- Demo seed ---------------------------------------------------------------

function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DEMO_IDS = {
  alex: 'u_alex',
  moaad: 'u_moaad',
  hamza: 'u_hamza',
}

function ensureDemoSeed() {
  const tables = load()
  if (tables.profiles[DEMO_IDS.alex]) return tables

  const now = Date.now()
  const iso = (n = 0) => new Date(now - n * 3600_000).toISOString()

  const alex: Profile = { id: DEMO_IDS.alex, username: 'alex', email: 'alex@growly.app', name: 'Alex', bio: 'Building better habits, one day at a time.', avatar_url: null, xp: 0, current_streak: 0, best_streak: 0, created_at: iso(24 * 40) }
  const moaad: Profile = { id: DEMO_IDS.moaad, username: 'moaad', email: 'moaad@growly.app', name: 'Moaad', bio: 'Consistency over intensity.', avatar_url: null, xp: 0, current_streak: 0, best_streak: 0, created_at: iso(24 * 40) }
  const hamza: Profile = { id: DEMO_IDS.hamza, username: 'hamza', email: 'hamza@growly.app', name: 'Hamza', bio: 'Small steps every day.', avatar_url: null, xp: 0, current_streak: 0, best_streak: 0, created_at: iso(24 * 40) }

  tables.users = {
    [DEMO_IDS.alex]: { id: DEMO_IDS.alex, username: 'alex', email: 'alex@growly.app', password: hashPassword('growly-demo') },
    [DEMO_IDS.moaad]: { id: DEMO_IDS.moaad, username: 'moaad', email: 'moaad@growly.app', password: hashPassword('growly-demo') },
    [DEMO_IDS.hamza]: { id: DEMO_IDS.hamza, username: 'hamza', email: 'hamza@growly.app', password: hashPassword('growly-demo') },
  }
  tables.profiles = { [alex.id]: alex, [moaad.id]: moaad, [hamza.id]: hamza }

  const today = todayKey()
  const start = toDateKey(addDays(new Date(), -29))
  const end = toDateKey(addDays(new Date(), 30))

  const challenge: Challenge = {
    id: 'ch_demo_growth',
    owner_id: alex.id,
    name: '30 Day Growth Challenge',
    description: 'Work out, code, read, and create a little bit every single day. Build the momentum together.',
    start_date: start,
    end_date: end,
    visibility: 'private',
    daily_target: 80,
    competitive_mode: true,
    proof_required: false,
    invite_code: 'GROWLY-8K29X',
    created_at: iso(24 * 41),
  }
  tables.challenges[challenge.id] = challenge

  const joined = iso(24 * 40)
  tables.members = [
    { id: 'm1', challenge_id: challenge.id, user_id: alex.id, role: 'owner', joined_at: joined },
    { id: 'm2', challenge_id: challenge.id, user_id: moaad.id, role: 'member', joined_at: joined },
    { id: 'm3', challenge_id: challenge.id, user_id: hamza.id, role: 'member', joined_at: joined },
  ]

  const tasks: Task[] = [
    { id: 't_workout', challenge_id: challenge.id, created_by: alex.id, name: 'Workout', description: '1 hour of training', category: 'workout', difficulty: 'medium', points: 10, time: 'Morning', repeat: 'daily', proof_required: false, created_at: iso(24 * 41) },
    { id: 't_python', challenge_id: challenge.id, created_by: alex.id, name: 'Python', description: 'Coding practice', category: 'coding', difficulty: 'hard', points: 20, time: 'Morning', repeat: 'daily', proof_required: false, created_at: iso(24 * 41) },
    { id: 't_web', challenge_id: challenge.id, created_by: alex.id, name: 'Web Development', description: 'Build or learn something on the web', category: 'web', difficulty: 'hard', points: 15, time: 'Afternoon', repeat: 'daily', proof_required: false, created_at: iso(24 * 41) },
    { id: 't_read', challenge_id: challenge.id, created_by: alex.id, name: 'Reading', description: 'Read 20 pages', category: 'reading', difficulty: 'easy', points: 5, time: 'Evening', repeat: 'daily', proof_required: false, created_at: iso(24 * 41) },
    { id: 't_content', challenge_id: challenge.id, created_by: alex.id, name: 'Content Creation', description: 'Write, record, or publish something', category: 'content', difficulty: 'medium', points: 10, time: 'Evening', repeat: 'daily', proof_required: false, created_at: iso(24 * 41) },
  ]
  tables.tasks = tasks

  // Deterministic history.
  const rand = mulberry32(12345)
  const rates: Record<string, number> = { [alex.id]: 0.82, [hamza.id]: 0.88, [moaad.id]: 0.74 }
  const streakLens: Record<string, number> = { [alex.id]: 8, [hamza.id]: 6, [moaad.id]: 4 }
  const days = []
  let cur = new Date()
  cur = addDays(cur, -29)
  for (let i = 0; i < 30; i++) {
    days.push(toDateKey(cur))
    cur = addDays(cur, 1)
  }

  const memberIds = [alex.id, hamza.id, moaad.id]
  const completions: TaskCompletion[] = []
  const activity: Activity[] = []
  let actId = 0

  const todayIdx = days.length - 1 // last day is today
  for (let di = 0; di < days.length; di++) {
    const d = days[di]
    for (const mid of memberIds) {
      const rate = rates[mid]
      let doneAny = 0
      for (const t of tasks) {
        const r = rand()
        const done = di === todayIdx ? r < 0.25 : r < rate
        if (done) {
          completions.push({
            id: uid('c_'),
            challenge_id: challenge.id,
            task_id: t.id,
            user_id: mid,
            date: d,
            created_at: new Date(parseInt(d.split('-')[0], 10), parseInt(d.split('-')[1], 10) - 1, parseInt(d.split('-')[2], 10), 8, Math.floor(r * 55)).toISOString(),
          })
          doneAny++
          activity.push({
            id: uid('a_'),
            challenge_id: challenge.id,
            user_id: mid,
            kind: 'task_completed',
            text: `completed ${t.name}`,
            created_at: new Date(parseInt(d.split('-')[0], 10), parseInt(d.split('-')[1], 10) - 1, parseInt(d.split('-')[2], 10), 9, Math.floor(r * 55)).toISOString(),
          })
        }
      }
      if (actId === 0 && doneAny > 0) actId = 1
    }
    // Force streak tail so the demo leaderboard looks alive.
    for (const mid of memberIds) {
      const len = streakLens[mid]
      const startIdx = todayIdx - len
      if (di > startIdx && di <= todayIdx) {
        // ensure target met: at least ceil(80% of 5) = 4 tasks done
        let doneCount = completions.filter((c) => c.user_id === mid && c.date === d).length
        for (const t of tasks) {
          if (doneCount >= 4) break
          const exists = completions.some((c) => c.task_id === t.id && c.user_id === mid && c.date === d)
          if (!exists) {
            completions.push({
              id: uid('c_'),
              challenge_id: challenge.id,
              task_id: t.id,
              user_id: mid,
              date: d,
              created_at: new Date(parseInt(d.split('-')[0], 10), parseInt(d.split('-')[1], 10) - 1, parseInt(d.split('-')[2], 10), 8, 30).toISOString(),
            })
            doneCount++
          }
        }
      }
    }
  }

  // Leave today open for Alex to complete (clear today completions for alex).
  tables.completions = completions.filter((c) => !(c.user_id === alex.id && c.date === today))

  // Activity seeds
  activity.push(
    { id: uid('a_'), challenge_id: challenge.id, user_id: hamza.id, kind: 'streak', text: 'reached a 7 day streak', created_at: iso(24) },
    { id: uid('a_'), challenge_id: challenge.id, user_id: moaad.id, kind: 'joined', text: 'joined the challenge', created_at: iso(24 * 39) },
    { id: uid('a_'), challenge_id: challenge.id, user_id: hamza.id, kind: 'joined', text: 'joined the challenge', created_at: iso(24 * 39) },
    { id: uid('a_'), challenge_id: challenge.id, user_id: alex.id, kind: 'target', text: 'completed all tasks today', created_at: iso(20) }
  )
  tables.activity = activity
  tables.invites = [{ id: uid('i_'), challenge_id: challenge.id, code: challenge.invite_code, created_by: alex.id, created_at: iso(24 * 41) }]

  save(tables)
  return tables
}

// ---- Local DB ---------------------------------------------------------------

export const localDB: AppDB = {
  async getOrCreateByUsername(rawUsername) {
    ensureDemoSeed()
    const tables = load()
    const username = normalizeUsername(rawUsername)
    if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new Error('Username must be 3–20 characters and can only contain letters, numbers, and underscores.')

    const existing = Object.values(tables.profiles).find((p) => p.username === username)
    if (existing) {
      tables.session = existing.id
      save(tables)
      emitAuth()
      return { user: { id: existing.id, username: existing.username }, created: false }
    }

    const id = uid('u_')
    const profile: Profile = {
      id,
      username,
      name: displayName(username),
      email: '',
      bio: null,
      avatar_url: null,
      xp: 0,
      current_streak: 0,
      best_streak: 0,
      created_at: new Date().toISOString(),
    }
    tables.users[id] = { id, username, email: '', password: '' }
    tables.profiles[id] = profile
    tables.session = id
    save(tables)
    emitAuth()
    return { user: { id, username }, created: true }
  },

  async checkUsername(rawUsername) {
    ensureDemoSeed()
    const tables = load()
    const username = normalizeUsername(rawUsername)
    if (!username) return false
    return !Object.values(tables.profiles).some((p) => p.username === username)
  },

  async signOut() {
    const tables = load()
    tables.session = null
    save(tables)
    emitAuth()
  },

  async getSession() {
    ensureDemoSeed()
    const tables = load()
    const id = tables.session
    if (!id || !tables.users[id]) return null
    const profile = tables.profiles[id]
    return { id, username: profile?.username ?? tables.users[id].username }
  },

  onAuthChange(cb) {
    return on('auth', cb as () => void)
  },

  async getProfile(userId) {
    ensureDemoSeed()
    return load().profiles[userId] ?? null
  },

  async updateProfile(userId, input) {
    const tables = load()
    const p = tables.profiles[userId]
    if (!p) throw new Error('Profile not found.')
    const updated: Profile = { ...p, name: input.name, bio: input.bio ?? p.bio, avatar_url: input.avatar_url ?? p.avatar_url }
    tables.profiles[userId] = updated
    save(tables)
    emit('user:' + userId)
    return updated
  },

  async uploadAvatar(_userId, file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Could not read image.'))
      reader.readAsDataURL(file)
    })
  },

  async listProfiles(ids) {
    ensureDemoSeed()
    const tables = load()
    return ids.map((id) => tables.profiles[id]).filter(Boolean)
  },

  async listChallengesForUser(userId) {
    ensureDemoSeed()
    const tables = load()
    const rows = tables.members.filter((m) => m.user_id === userId)
    return rows
      .map((m): ChallengeWithMeta | null => {
        const ch = tables.challenges[m.challenge_id]
        if (!ch) return null
        const memberCount = tables.members.filter((x) => x.challenge_id === ch.id).length
        return { ...ch, memberCount, owner: tables.profiles[ch.owner_id] ?? null }
      })
      .filter((c): c is ChallengeWithMeta => c !== null)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  },

  async listPublicChallenges(userId) {
    ensureDemoSeed()
    const tables = load()
    const mine = new Set(tables.members.filter((m) => m.user_id === userId).map((m) => m.challenge_id))
    return Object.values(tables.challenges)
      .filter((c) => c.visibility === 'public' && !mine.has(c.id))
      .map((c) => ({
        ...c,
        memberCount: tables.members.filter((x) => x.challenge_id === c.id).length,
        owner: tables.profiles[c.owner_id] ?? null,
      }))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  },

  async getChallenge(id) {
    ensureDemoSeed()
    return load().challenges[id] ?? null
  },

  async createChallenge(ownerId, input) {
    const tables = load()
    const code = generateInviteCode()
    const challenge: Challenge = {
      id: uid('ch_'),
      owner_id: ownerId,
      name: input.name,
      description: input.description ?? null,
      start_date: input.start_date,
      end_date: input.end_date,
      visibility: input.visibility,
      daily_target: input.daily_target,
      competitive_mode: input.competitive_mode,
      proof_required: input.proof_required,
      invite_code: code,
      created_at: new Date().toISOString(),
    }
    tables.challenges[challenge.id] = challenge
    tables.members.push({ id: uid('m_'), challenge_id: challenge.id, user_id: ownerId, role: 'owner', joined_at: new Date().toISOString() })
    tables.invites.push({ id: uid('i_'), challenge_id: challenge.id, code, created_by: ownerId, created_at: new Date().toISOString() })
    tables.activity.push({ id: uid('a_'), challenge_id: challenge.id, user_id: ownerId, kind: 'created', text: 'created the challenge', created_at: new Date().toISOString() })
    save(tables)
    emit('user:' + ownerId)
    void syncAchievements(localDB, ownerId)
    return challenge
  },

  async updateChallenge(id, patch) {
    const tables = load()
    const ch = tables.challenges[id]
    if (!ch) throw new Error('Challenge not found.')
    tables.challenges[id] = { ...ch, ...patch }
    save(tables)
    emit('ch:' + id)
    return tables.challenges[id]
  },

  async deleteChallenge(id) {
    const tables = load()
    const members = tables.members.filter((m) => m.challenge_id === id)
    delete tables.challenges[id]
    tables.members = tables.members.filter((m) => m.challenge_id !== id)
    tables.tasks = tables.tasks.filter((t) => t.challenge_id !== id)
    tables.completions = tables.completions.filter((c) => c.challenge_id !== id)
    tables.proofs = tables.proofs.filter((p) => p.challenge_id !== id)
    tables.activity = tables.activity.filter((a) => a.challenge_id !== id)
    tables.invites = tables.invites.filter((i) => i.challenge_id !== id)
    for (const m of members) emit('user:' + m.user_id)
    save(tables)
  },

  async listMembers(challengeId) {
    ensureDemoSeed()
    const tables = load()
    return tables.members
      .filter((m) => m.challenge_id === challengeId)
      .map((m) => ({ ...m, profile: tables.profiles[m.user_id] }))
      .filter((m): m is MemberWithProfile => Boolean(m.profile))
  },

  async addMember(challengeId, userId, role = 'member') {
    const tables = load()
    if (tables.members.some((m) => m.challenge_id === challengeId && m.user_id === userId)) return
    const member = { id: uid('m_'), challenge_id: challengeId, user_id: userId, role, joined_at: new Date().toISOString() }
    tables.members.push(member)
    const ch = tables.challenges[challengeId]
    const profile = tables.profiles[userId]
    if (ch && profile) {
      tables.activity.push({ id: uid('a_'), challenge_id: challengeId, user_id: userId, kind: 'joined', text: 'joined the challenge', created_at: new Date().toISOString() })
      if (ch.owner_id !== userId) {
        tables.notifications.push({ id: uid('n_'), user_id: ch.owner_id, kind: 'member_joined', text: `${profile.name} joined your challenge.`, link: `/challenge/${challengeId}`, read: false, created_at: new Date().toISOString() })
      }
    }
    save(tables)
    emit('ch:' + challengeId)
    emit('user:' + userId)
    void syncAchievements(localDB, userId)
  },

  async removeMember(challengeId, userId) {
    const tables = load()
    tables.members = tables.members.filter((m) => !(m.challenge_id === challengeId && m.user_id === userId))
    save(tables)
    emit('ch:' + challengeId)
    emit('user:' + userId)
  },

  async getChallengeByCode(code) {
    ensureDemoSeed()
    const tables = load()
    const normalized = code.trim().toUpperCase().startsWith('GROWLY-') ? code.trim().toUpperCase() : `GROWLY-${code.trim().toUpperCase()}`
    return Object.values(tables.challenges).find((c) => c.invite_code.toUpperCase() === normalized) ?? null
  },

  async joinByCode(code, userId) {
    ensureDemoSeed()
    const tables = load()
    const ch = await localDB.getChallengeByCode(code)
    if (!ch) throw new Error('Invalid invite code.')
    const existing = tables.members.some((m) => m.challenge_id === ch.id && m.user_id === userId)
    if (!existing) {
      tables.members.push({ id: uid('m_'), challenge_id: ch.id, user_id: userId, role: 'member', joined_at: new Date().toISOString() })
      const profile = tables.profiles[userId]
      tables.activity.push({ id: uid('a_'), challenge_id: ch.id, user_id: userId, kind: 'joined', text: 'joined the challenge', created_at: new Date().toISOString() })
      if (ch.owner_id !== userId && profile) {
        tables.notifications.push({ id: uid('n_'), user_id: ch.owner_id, kind: 'member_joined', text: `${profile.name} joined your challenge.`, link: `/challenge/${ch.id}`, read: false, created_at: new Date().toISOString() })
      }
      save(tables)
      emit('ch:' + ch.id)
      emit('user:' + userId)
      void syncAchievements(localDB, userId)
    }
    return { challenge: ch, created: !existing }
  },

  async listTasks(challengeId) {
    ensureDemoSeed()
    return load().tasks.filter((t) => t.challenge_id === challengeId).sort((a, b) => a.created_at.localeCompare(b.created_at))
  },

  async createTask(challengeId, creatorId, input) {
    const tables = load()
    const task: Task = {
      id: uid('t_'),
      challenge_id: challengeId,
      created_by: creatorId,
      name: input.name,
      description: input.description ?? null,
      category: input.category,
      difficulty: input.difficulty,
      points: input.points,
      time: input.time ?? null,
      repeat: input.repeat,
      proof_required: input.proof_required,
      created_at: new Date().toISOString(),
    }
    tables.tasks.push(task)
    tables.activity.push({ id: uid('a_'), challenge_id: challengeId, user_id: creatorId, kind: 'task_created', text: `added the task "${task.name}"`, created_at: new Date().toISOString() })
    save(tables)
    emit('ch:' + challengeId)
    return task
  },

  async updateTask(taskId, patch) {
    const tables = load()
    const idx = tables.tasks.findIndex((t) => t.id === taskId)
    if (idx < 0) throw new Error('Task not found.')
    tables.tasks[idx] = { ...tables.tasks[idx], ...patch }
    save(tables)
    emit('ch:' + tables.tasks[idx].challenge_id)
    return tables.tasks[idx]
  },

  async deleteTask(taskId) {
    const tables = load()
    const task = tables.tasks.find((t) => t.id === taskId)
    if (!task) return
    tables.tasks = tables.tasks.filter((t) => t.id !== taskId)
    tables.completions = tables.completions.filter((c) => c.task_id !== taskId)
    tables.proofs = tables.proofs.filter((p) => p.task_id !== taskId)
    save(tables)
    emit('ch:' + task.challenge_id)
  },

  async listCompletions(challengeId) {
    ensureDemoSeed()
    return load().completions.filter((c) => c.challenge_id === challengeId)
  },

  async completeTask(taskId, userId, date) {
    const tables = load()
    const task = tables.tasks.find((t) => t.id === taskId)
    if (!task) throw new Error('Task not found.')
    const exists = tables.completions.some((c) => c.task_id === taskId && c.user_id === userId && c.date === date)
    if (exists) return
    tables.completions.push({ id: uid('c_'), challenge_id: task.challenge_id, task_id: taskId, user_id: userId, date, created_at: new Date().toISOString() })
    tables.activity.push({ id: uid('a_'), challenge_id: task.challenge_id, user_id: userId, kind: 'task_completed', text: `completed ${task.name}`, created_at: new Date().toISOString() })

    const ch = tables.challenges[task.challenge_id]
    if (ch) {
      const due = tables.tasks.filter((t) => t.challenge_id === ch.id)
      const done = due.filter((t) => tables.completions.some((c) => c.task_id === t.id && c.user_id === userId && c.date === date))
      const pct = due.length === 0 ? 0 : Math.round((done.length / due.length) * 100)
      if (due.length > 0 && pct >= ch.daily_target) {
        tables.notifications.push({ id: uid('n_'), user_id: userId, kind: 'target_met', text: "You completed today's target.", link: `/challenge/${ch.id}`, read: false, created_at: new Date().toISOString() })
        if (done.length === due.length) {
          tables.activity.push({ id: uid('a_'), challenge_id: ch.id, user_id: userId, kind: 'target', text: 'completed all tasks today', created_at: new Date().toISOString() })
        }
      }
    }

    save(tables)
    emit('ch:' + task.challenge_id)
    emit('user:' + userId)
    void syncAchievements(localDB, userId)
  },

  async uncompleteTask(taskId, userId, date) {
    const tables = load()
    const task = tables.tasks.find((t) => t.id === taskId)
    tables.completions = tables.completions.filter((c) => !(c.task_id === taskId && c.user_id === userId && c.date === date))
    save(tables)
    emit('ch:' + task?.challenge_id)
    emit('user:' + userId)
  },

  async submitProof(completionId, taskId, userId, challengeId, type, content) {
    const tables = load()
    tables.proofs.push({ id: uid('p_'), challenge_id: challengeId, task_id: taskId, user_id: userId, completion_id: completionId, type, content, status: 'pending', reviewed_by: null, reviewed_at: null, created_at: new Date().toISOString(), profile: tables.profiles[userId], task: tables.tasks.find((t) => t.id === taskId) ?? null })
    save(tables)
    emit('ch:' + challengeId)
  },

  async listProofs(challengeId) {
    ensureDemoSeed()
    const tables = load()
    return tables.proofs
      .filter((p) => p.challenge_id === challengeId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map((p) => ({ ...p, profile: tables.profiles[p.user_id] }))
      .filter((p): p is ProofWithMeta => Boolean(p.profile))
  },

  async reviewProof(proofId, status, reviewerId) {
    const tables = load()
    const p = tables.proofs.find((x) => x.id === proofId)
    if (!p) return
    p.status = status
    p.reviewed_by = reviewerId
    p.reviewed_at = new Date().toISOString()
    tables.notifications.push({ id: uid('n_'), user_id: p.user_id, kind: 'proof_reviewed', text: `Your proof for ${p.task?.name ?? 'a task'} was ${status}.`, link: `/challenge/${p.challenge_id}/tasks`, read: false, created_at: new Date().toISOString() })
    save(tables)
    emit('ch:' + p.challenge_id)
  },

  async listActivity(challengeId, limit = 50) {
    ensureDemoSeed()
    const tables = load()
    return tables.activity
      .filter((a) => a.challenge_id === challengeId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, limit)
  },

  async listUserActivity(userId, limit = 20) {
    ensureDemoSeed()
    const tables = load()
    return tables.activity
      .filter((a) => a.user_id === userId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, limit)
  },

  async listAchievements() {
    return ACHIEVEMENTS
  },

  async listUserAchievements(userId) {
    ensureDemoSeed()
    return load().userAchievements.filter((a) => a.user_id === userId).sort((a, b) => (a.unlocked_at < b.unlocked_at ? 1 : -1))
  },

  async unlockAchievement(userId, key) {
    const tables = load()
    if (tables.userAchievements.some((a) => a.user_id === userId && a.achievement_key === key)) {
      return tables.userAchievements.find((a) => a.user_id === userId && a.achievement_key === key)!
    }
    const ua: UserAchievement = { id: uid('ua_'), user_id: userId, achievement_key: key, unlocked_at: new Date().toISOString() }
    tables.userAchievements.push(ua)
    const meta = ACHIEVEMENTS.find((a) => a.key === key)
    if (meta) {
      tables.notifications.push({ id: uid('n_'), user_id: userId, kind: 'achievement', text: `Achievement unlocked: ${meta.name}`, link: '/profile', read: false, created_at: new Date().toISOString() })
    }
    save(tables)
    emit('user:' + userId)
    return ua
  },

  async listNotifications(userId) {
    ensureDemoSeed()
    return load().notifications
      .filter((n) => n.user_id === userId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 50)
  },

  async createNotification(userId, kind, text, link = null) {
    const tables = load()
    tables.notifications.push({ id: uid('n_'), user_id: userId, kind, text, link, read: false, created_at: new Date().toISOString() })
    save(tables)
    emit('user:' + userId)
  },

  async markNotificationRead(id) {
    const tables = load()
    const n = tables.notifications.find((x) => x.id === id)
    if (n) n.read = true
    save(tables)
  },

  async markAllNotificationsRead(userId) {
    const tables = load()
    for (const n of tables.notifications) {
      if (n.user_id === userId) n.read = true
    }
    save(tables)
  },

  async pushScheduledNotifications(userId) {
    ensureDemoSeed()
    const tables = load()
    const today = todayKey()
    let changed = false

    const challenges = await localDB.listChallengesForUser(userId)
    for (const ch of challenges) {
      const members = await localDB.listMembers(ch.id)
      const tasks = await localDB.listTasks(ch.id)
      const completions = await localDB.listCompletions(ch.id)
      const due = tasks.filter((t) => ['daily', 'weekdays', 'weekends'].includes(t.repeat))
      if (due.length === 0) continue

      const doneToday = due.filter((t) => completions.some((c) => c.task_id === t.id && c.user_id === userId && c.date === today)).length
      const metToday = due.length > 0 && Math.round((doneToday / due.length) * 100) >= ch.daily_target

      const exists = (kind: string) => tables.notifications.some((n) => n.user_id === userId && n.kind === kind && n.created_at.slice(0, 10) === today)
      const me = members.find((m) => m.user_id === userId)
      if (me && !metToday && !exists('streak_risk')) {
        const yesterday = toDateKey(addDays(new Date(), -1))
        const doneY = due.filter((t) => completions.some((c) => c.task_id === t.id && c.user_id === userId && c.date === yesterday)).length
        const metY = due.length > 0 && Math.round((doneY / due.length) * 100) >= ch.daily_target
        if (metY) {
          tables.notifications.push({ id: uid('n_'), user_id: userId, kind: 'streak_risk', text: 'Your streak is at risk. Finish today\'s tasks.', link: `/challenge/${ch.id}/tasks`, read: false, created_at: new Date().toISOString() })
          changed = true
        }
      }

      if (ch.competitive_mode && !metToday && !exists('xp_gap')) {
        let meXp = 0
        for (const c of completions) {
          if (c.user_id !== userId || c.date !== today) continue
          const t = tasks.find((x) => x.id === c.task_id)
          if (t) meXp += t.points
        }
        for (const m of members) {
          if (m.user_id === userId) continue
          let xp = 0
          for (const c of completions) {
            if (c.user_id !== m.user_id || c.date !== today) continue
            const t = tasks.find((x) => x.id === c.task_id)
            if (t) xp += t.points
          }
          const gap = xp - meXp
          if (gap >= 20) {
            tables.notifications.push({ id: uid('n_'), user_id: userId, kind: 'xp_gap', text: `You're ${gap} XP behind ${m.profile.name}.`, link: `/challenge/${ch.id}/leaderboard`, read: false, created_at: new Date().toISOString() })
            changed = true
            break
          }
        }
      }

      const tomorrow = toDateKey(addDays(new Date(), 1))
      if (tomorrow === ch.start_date && !exists('challenge_start')) {
        tables.notifications.push({ id: uid('n_'), user_id: userId, kind: 'challenge_start', text: `${ch.name} starts tomorrow. Get ready.`, link: `/challenge/${ch.id}`, read: false, created_at: new Date().toISOString() })
        changed = true
      }
    }

    if (changed) {
      save(tables)
      emit('user:' + userId)
    }
  },

  subscribeToChallenge(challengeId, cb) {
    return on('ch:' + challengeId, cb)
  },

  subscribeToUser(userId, cb) {
    return on('user:' + userId, cb)
  },
}
