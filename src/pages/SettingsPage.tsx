import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Camera } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { db } from '../lib'
import { Avatar } from '../components/Avatar'
import { Button, Card, Field, Input, Textarea } from '../components/ui'

export function SettingsPage() {
  const { profile, user, signOut, refreshProfile } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(profile?.name ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    if (!user || name.trim().length < 2) {
      toast('Please enter a name.', 'error')
      return
    }
    setSaving(true)
    try {
      await db.updateProfile(user.id, { name: name.trim(), bio: bio.trim() || null })
      await refreshProfile()
      toast('Profile updated.')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update profile.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const uploadAvatar = async (file: File | undefined) => {
    if (!user || !file) return
    try {
      const url = await db.uploadAvatar(user.id, file)
      await db.updateProfile(user.id, { name: name.trim(), bio: bio.trim() || null, avatar_url: url })
      await refreshProfile()
      toast('Avatar updated.')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not upload avatar.', 'error')
    }
  }

  const doSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
      navigate('/auth')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-onSurface">Settings</h1>
        <p className="text-sm text-onSurfaceVariant">Your profile and preferences.</p>
      </header>

      <Card className="flex items-center gap-4">
        <div className="relative">
          <Avatar name={profile?.name ?? user?.username ?? '?'} url={profile?.avatar_url} size="lg" />
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-secondary-container text-secondary-onContainer shadow-card transition hover:brightness-105"
            aria-label="Change avatar"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadAvatar(e.target.files?.[0])} />
        </div>
        <div className="min-w-0">
          <p className="truncate font-bold text-on-surface">{profile?.name ?? 'You'}</p>
          <p className="truncate text-sm text-onSurfaceVariant">@{user?.username}</p>
        </div>
      </Card>

      <form onSubmit={saveProfile} className="space-y-4">
        <Card className="space-y-4">
          <Field label="Display name" hint="Shown to other members in challenges.">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </Field>
          <Field label="Bio" hint="A line about you and your goals.">
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={140} />
          </Field>
          <Button type="submit" loading={saving} className="w-full">
            Save profile
          </Button>
        </Card>
      </form>

      <Card className="border-red-100">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500">
              <LogOut className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-on-surface">Log out</p>
              <p className="text-xs text-onSurfaceVariant">You can come back anytime with your username.</p>
            </div>
          </div>
          <Button variant="danger" size="sm" onClick={doSignOut} loading={signingOut}>
            Log out
          </Button>
        </div>
      </Card>
    </div>
  )
}
