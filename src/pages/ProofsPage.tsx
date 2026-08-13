import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ShieldCheck, Check, X, FileImage, Link2, Type } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useChallengeData } from '../hooks/useChallengeData'
import { db } from '../lib'
import { timeAgo } from '../lib/calc'
import type { ProofSubmission } from '../lib/types'
import { ChallengeNav } from '../components/ChallengeNav'
import { Avatar } from '../components/Avatar'
import { Badge, Button, Card, EmptyState, PageSpinner, SegmentedControl } from '../components/ui'

type Filter = 'pending' | 'approved' | 'rejected' | 'all'

const STATUS_TONES: Record<ProofSubmission['status'], 'amber' | 'green' | 'red'> = {
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
}

export function ProofsPage() {
  const { id } = useParams<{ id: string }>()
  const { challenge, proofs, loading, reload } = useChallengeData(id)
  const { user } = useAuth()
  const { toast } = useToast()
  const [filter, setFilter] = useState<Filter>('pending')

  const counts = useMemo(
    () => ({
      pending: proofs.filter((p) => p.status === 'pending').length,
      approved: proofs.filter((p) => p.status === 'approved').length,
      rejected: proofs.filter((p) => p.status === 'rejected').length,
      all: proofs.length,
    }),
    [proofs]
  )

  if (loading) return <PageSpinner />
  if (!challenge) return null

  const isOwner = challenge.owner_id === user?.id
  const filtered = proofs.filter((p) => filter === 'all' || p.status === filter)

  const review = async (proofId: string, status: 'approved' | 'rejected') => {
    if (!user) return
    try {
      await db.reviewProof(proofId, status, user.id)
      toast(status === 'approved' ? 'Proof approved.' : 'Proof rejected.')
      reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not review.', 'error')
    }
  }

  const proofIcon = (type: string) => {
    if (type === 'image') return <FileImage className="h-4 w-4" />
    if (type === 'url') return <Link2 className="h-4 w-4" />
    return <Type className="h-4 w-4" />
  }

  return (
    <div className="space-y-5">
      <ChallengeNav base={`/challenge/${challenge.id}`} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-on-surface">Proof</h1>
          <p className="text-sm text-onSurfaceVariant">
            {counts.pending > 0 && isOwner ? `${counts.pending} awaiting review.` : 'Members verify each other.'}
          </p>
        </div>
        <SegmentedControl
          options={[
            { label: `Pending ${counts.pending}`, value: 'pending' },
            { label: 'Approved', value: 'approved' },
            { label: 'Rejected', value: 'rejected' },
            { label: 'All', value: 'all' },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title="Nothing here" description="Proof submissions will show up as members complete proof-required tasks." />
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <Card key={p.id} className={clsx(p.status === 'pending' && isOwner && 'border-primary-fixed-dim')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={p.profile.name} url={p.profile.avatar_url} size="sm" />
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{p.profile.name}</p>
                    <p className="text-xs text-onSurfaceVariant">{timeAgo(p.created_at)}</p>
                  </div>
                </div>
                <Badge tone={STATUS_TONES[p.status]}>{p.status}</Badge>
              </div>

              {p.task && (
                <p className="mt-3 text-sm text-onSurfaceVariant">
                  Completed <span className="font-semibold text-onSurface">{p.task.name}</span>
                </p>
              )}

              <div className="mt-2 rounded-xl bg-surface-containerLow p-3 text-sm text-onSurfaceVariant">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-onSurfaceVariant">
                  {proofIcon(p.type)} {p.type === 'image' ? 'Photo proof' : p.type === 'url' ? 'Link proof' : 'Written proof'}
                </span>
                {p.type === 'image' ? (
                  <img src={p.content} alt="Proof" className="max-h-48 w-full rounded-lg object-cover" />
                ) : p.type === 'url' ? (
                  <a href={p.content} target="_blank" rel="noreferrer" className="break-all text-primary-container underline underline-offset-2">
                    {p.content}
                  </a>
                ) : (
                  <p className="whitespace-pre-wrap">{p.content}</p>
                )}
              </div>

              {isOwner && p.status === 'pending' && (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => review(p.id, 'rejected')} className="flex-1">
                    <X className="h-4 w-4 text-red-500" /> Reject
                  </Button>
                  <Button size="sm" onClick={() => review(p.id, 'approved')} className="flex-1">
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
