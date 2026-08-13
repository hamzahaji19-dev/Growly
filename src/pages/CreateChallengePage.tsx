import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, ShieldCheck, Globe2, Lock } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { db } from '../lib'
import { addDays, toDateKey } from '../lib/calc'
import { Button, Card, Field, Input, Textarea, Toggle } from '../components/ui'

export function CreateChallengePage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const today = toDateKey(new Date())
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(toDateKey(addDays(new Date(), 30)))
  const [visibility, setVisibility] = useState<'private' | 'public'>('private')
  const [dailyTarget, setDailyTarget] = useState(70)
  const [competitive, setCompetitive] = useState(true)
  const [proofRequired, setProofRequired] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (name.trim().length < 2) {
      toast('Give your challenge a name.', 'error')
      return
    }
    if (endDate <= startDate) {
      toast('End date must be after the start date.', 'error')
      return
    }
    setLoading(true)
    try {
      const ch = await db.createChallenge(user.id, {
        name: name.trim(),
        description: description.trim() || null,
        start_date: startDate,
        end_date: endDate,
        visibility,
        daily_target: dailyTarget,
        competitive_mode: competitive,
        proof_required: proofRequired,
      })
      toast('Challenge created! Invite your friends.')
      navigate(`/challenge/${ch.id}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not create challenge.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-onSurface">Create a challenge</h1>
        <p className="mt-1 text-sm text-onSurfaceVariant">Set the rules, then invite your friends to join.</p>
      </header>

      <form onSubmit={submit} className="space-y-4">
        <Card className="space-y-4">
          <Field label="Challenge name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 30 Day Growth Challenge" maxLength={60} />
          </Field>
          <Field label="Description" hint="Why are you doing this?">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A little motivation for your crew…" maxLength={240} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="End date">
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card className="space-y-4">
          <Field label={`Daily target: ${dailyTarget}%`} hint="Share of daily tasks you need to complete to hit your target.">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={dailyTarget}
              onChange={(e) => setDailyTarget(Number(e.target.value))}
              className="w-full accent-secondary-container"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setVisibility('private')}
              className={clsx(
                'flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition',
                visibility === 'private' ? 'border-primary-container bg-primary-fixed/40 text-primary-onFixedVariant' : 'border-surface-outlineVariant text-onSurfaceVariant hover:border-surface-outline'
              )}
            >
              <Lock className="h-5 w-5" />
              <span className="text-sm font-semibold">Private</span>
              <span className="text-xs">Invite only</span>
            </button>
            <button
              type="button"
              onClick={() => setVisibility('public')}
              className={clsx(
                'flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition',
                visibility === 'public' ? 'border-primary-container bg-primary-fixed/40 text-primary-onFixedVariant' : 'border-surface-outlineVariant text-onSurfaceVariant hover:border-surface-outline'
              )}
            >
              <Globe2 className="h-5 w-5" />
              <span className="text-sm font-semibold">Public</span>
              <span className="text-xs">Anyone can join</span>
            </button>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary-fixed text-secondary-onFixed">
                <Trophy className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-on-surface">Competitive mode</p>
                <p className="text-xs text-onSurfaceVariant">Enable leaderboards and daily wins.</p>
              </div>
            </div>
            <Toggle checked={competitive} onChange={setCompetitive} label="Competitive mode" />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-fixed text-primary-onFixedVariant">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-on-surface">Require proof</p>
                <p className="text-xs text-onSurfaceVariant">Members submit proof for completed tasks.</p>
              </div>
            </div>
            <Toggle checked={proofRequired} onChange={setProofRequired} label="Require proof" />
          </div>
        </Card>

        <Button type="submit" size="lg" loading={loading} className="w-full">
          Create challenge
        </Button>
      </form>
    </div>
  )
}
