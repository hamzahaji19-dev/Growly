import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { db } from '../lib'
import { Button, Card, Input } from '../components/ui'
import { AvatarStack } from '../components/Avatar'

export function JoinPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<{ name: string; memberCount: number; members: { name: string; avatar_url?: string | null }[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const lookup = async () => {
    if (!code.trim()) return
    try {
      const ch = await db.getChallengeByCode(code.trim())
      if (!ch) {
        setPreview(null)
        setError('No challenge found with that code.')
        return
      }
      setError(null)
      const members = await db.listMembers(ch.id)
      setPreview({ name: ch.name, memberCount: members.length, members: members.map((m) => m.profile) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not look up code.')
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    try {
      const { challenge, created } = await db.joinByCode(code.trim(), user.id)
      toast(created ? `Joined ${challenge.name}!` : 'You are already a member.')
      navigate(`/challenge/${challenge.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid invite code.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-onSurface">Join a challenge</h1>
        <p className="mt-1 text-sm text-onSurfaceVariant">Enter the invite code shared by a friend.</p>
      </header>

      <Card>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-onSurfaceVariant">Invite code</span>
            <Input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase())
                setError(null)
                setPreview(null)
              }}
              placeholder="GROWLY-XXXXX"
              className="font-mono tracking-widest"
            />
          </label>

          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={lookup} className="flex-1">
              Check code
            </Button>
            <Button type="submit" loading={loading} disabled={!preview && !error} className="flex-1">
              Join
            </Button>
          </div>
        </form>

        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600">{error}</p>}

        {preview && (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-primary-fixed/40 p-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container text-primary-fixed">
              <KeyRound className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-primary">{preview.name}</p>
              <p className="text-xs text-primary-container">{preview.memberCount} members</p>
            </div>
            <AvatarStack profiles={preview.members} />
          </div>
        )}
      </Card>

      <p className="text-center text-xs text-onSurfaceVariant">
        Try the demo code <span className="font-semibold text-onSurface">GROWLY-8K29X</span>
      </p>
    </div>
  )
}
