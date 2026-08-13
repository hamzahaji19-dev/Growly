import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sprout, Flame, Trophy, Users, AtSign, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { db } from '../lib'
import { Button, Field, Input } from '../components/ui'

const FEATURES = [
  { icon: Flame, title: 'Build streaks', desc: 'Hit your daily target, day after day.' },
  { icon: Trophy, title: 'Compete with friends', desc: 'Friendly leaderboards that keep you honest.' },
  { icon: Users, title: 'Do it together', desc: 'Invite your crew and stay consistent.' },
]

const USERNAME_REGEX = /^[a-z0-9_]+$/

function validateUsername(raw: string): { normalized: string; error: string | null } {
  const normalized = raw.trim().toLowerCase()
  if (normalized.length === 0) return { normalized, error: null }
  if (normalized.length < 3) return { normalized, error: 'Username is too short.' }
  if (normalized.length > 20) return { normalized, error: 'Username must be 20 characters or fewer.' }
  if (!USERNAME_REGEX.test(normalized)) return { normalized, error: 'Username can only contain letters, numbers, and underscores.' }
  return { normalized, error: null }
}

type Availability = 'idle' | 'checking' | 'available' | 'taken'

export function AuthPage() {
  const { enter } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [availability, setAvailability] = useState<Availability>('idle')
  const [submitting, setSubmitting] = useState(false)
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const submitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { normalized, error: validationError } = validateUsername(username)
  const valid = !validationError && normalized.length >= 3
  const disabled = !valid || submitting || availability === 'checking'

  useEffect(() => {
    if (checkTimer.current) clearTimeout(checkTimer.current)
    if (submitTimer.current) clearTimeout(submitTimer.current)
    if (!valid) {
      setAvailability('idle')
      return
    }
    setAvailability('checking')
    checkTimer.current = setTimeout(async () => {
      try {
        const available = await db.checkUsername(normalized)
        setAvailability(available ? 'available' : 'taken')
      } catch {
        setAvailability('idle')
      }
    }, 350)
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current)
      if (submitTimer.current) clearTimeout(submitTimer.current)
    }
  }, [normalized, valid])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || submitting) return
    setSubmitting(true)
    try {
      const { created } = await enter(normalized)
      toast(created ? `Welcome to Growly, @${normalized}.` : `Welcome back, @${normalized}`)
      submitTimer.current = setTimeout(() => navigate('/dashboard'), 600)
    } catch (err) {
      setSubmitting(false)
      toast(err instanceof Error ? err.message : 'Something went wrong.', 'error')
    }
  }

  const availabilityNode = () => {
    if (validationError) {
      return <p className="mt-2 text-xs font-semibold text-red-500">{validationError}</p>
    }
    if (availability === 'checking') {
      return (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-onSurfaceVariant">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking username...
        </p>
      )
    }
    if (availability === 'available') {
      return <p className="mt-2 text-xs font-semibold text-primary-container">This username is available.</p>
    }
    if (availability === 'taken') {
      return <p className="mt-2 text-xs font-semibold text-red-500">This username is already taken.</p>
    }
    return null
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto grid min-h-screen max-w-5xl lg:grid-cols-2">
        <div className="relative hidden overflow-hidden bg-accent-gradient lg:flex lg:flex-col lg:justify-between lg:p-12">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-secondary-container/20 blur-3xl" />

          <div className="relative flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-white">
              <Sprout className="h-6 w-6" />
            </span>
            <span className="font-display text-2xl font-extrabold text-white">Growly</span>
          </div>

          <div className="relative space-y-6">
            <h1 className="font-display text-4xl font-extrabold leading-tight text-white">
              Grow together.
              <br />
              Get better every day.
            </h1>
            <p className="max-w-sm text-primary-fixed">
              Create challenges, invite your friends, build better habits, and stay consistent together.
            </p>
            <div className="space-y-4 pt-2">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-bold text-white">{f.title}</p>
                    <p className="text-sm text-primary-fixed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="relative text-sm text-white/70">© {new Date().getFullYear()} Growly. Plant the habit, watch it grow.</p>
        </div>

        <div className="flex items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-sm">
            <div className="mb-8 flex items-center gap-2.5 lg:hidden">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-gradient text-white shadow-card">
                <Sprout className="h-6 w-6" />
              </span>
              <span className="font-display text-2xl font-extrabold tracking-tight text-primary">Growly</span>
            </div>

            <h1 className="font-display text-3xl font-extrabold tracking-tight text-onSurface">Welcome to Growly</h1>
            <p className="mt-2 text-sm text-onSurfaceVariant">Choose a unique username to get started.</p>

            <form onSubmit={submit} className="mt-8 space-y-4">
              <Field label="Username">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-onSurfaceVariant/60">
                    <AtSign className="h-4 w-4" />
                  </span>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. hamza"
                    autoComplete="off"
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    className={clsx('pl-9', validationError && 'border-red-400 focus:border-red-400 focus:ring-red-100')}
                  />
                </div>
              </Field>

              <p className="-mt-1 text-xs text-onSurfaceVariant/80">3–20 characters. Letters, numbers, and underscores only.</p>

              {availabilityNode()}

              <Button type="submit" loading={submitting} disabled={disabled} className="w-full" size="lg">
                {submitting ? 'Entering Growly...' : 'Continue'}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-onSurfaceVariant">
              No email, no password. Just pick a username and start growing.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
