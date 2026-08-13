import { useParams } from 'react-router-dom'
import { Crown, Users, UserMinus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useChallengeData } from '../hooks/useChallengeData'
import { db } from '../lib'
import { formatShortDate } from '../lib/calc'
import { ChallengeNav } from '../components/ChallengeNav'
import { Avatar } from '../components/Avatar'
import { Badge, Card, EmptyState, PageSpinner } from '../components/ui'

export function MembersPage() {
  const { id } = useParams<{ id: string }>()
  const { challenge, members, loading, reload } = useChallengeData(id)
  const { user } = useAuth()
  const { toast } = useToast()

  if (loading) return <PageSpinner />
  if (!challenge) return null

  const isOwner = challenge.owner_id === user?.id

  const remove = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from the challenge?`)) return
    try {
      await db.removeMember(challenge.id, userId)
      toast(`${name} was removed.`)
      reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not remove member.', 'error')
    }
  }

  return (
    <div className="space-y-5">
      <ChallengeNav base={`/challenge/${challenge.id}`} />

      <div>
        <h1 className="font-display text-xl font-bold tracking-tight text-on-surface">Members</h1>
        <p className="text-sm text-onSurfaceVariant">{members.length} {members.length === 1 ? 'person' : 'people'} growing together.</p>
      </div>

      {members.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No members yet" description="Share the invite code to bring people in." />
      ) : (
        <Card className="p-2 sm:p-3">
          <ul className="divide-y divide-surface-outlineVariant/50">
            {members.map((m) => {
              const me = m.user_id === user?.id
              return (
                <li key={m.id} className="flex items-center gap-3 px-3 py-3">
                  <Avatar name={m.profile.name} url={m.profile.avatar_url} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-on-surface">
                      {m.profile.name} {me && <span className="text-xs font-medium text-primary-container">(you)</span>}
                    </p>
                    <p className="text-xs text-onSurfaceVariant">Joined {formatShortDate(m.joined_at.slice(0, 10))}</p>
                  </div>
                  {m.role === 'owner' ? (
                    <Badge tone="amber">
                      <Crown className="h-3 w-3" /> Owner
                    </Badge>
                  ) : (
                    isOwner && (
                      <button
                        onClick={() => remove(m.user_id, m.profile.name)}
                        className="rounded-full p-2 text-onSurfaceVariant/50 transition hover:bg-red-50 hover:text-red-500"
                        aria-label={`Remove ${m.profile.name}`}
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )
                  )}
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
