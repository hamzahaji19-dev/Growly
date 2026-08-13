import { useRef, useState } from 'react'
import { ShieldCheck, Link2, FileImage, Type } from 'lucide-react'
import clsx from 'clsx'
import { db } from '../lib'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { Button, Field, Input, Modal, Textarea } from './ui'
import type { Task } from '../lib/types'

type ProofType = 'text' | 'url' | 'image'

interface ProofTarget {
  task: Task
  completionId: string
}

export function ProofModal({
  target,
  onClose,
  onSubmitted,
}: {
  target: ProofTarget | null
  onClose: () => void
  onSubmitted: () => void
}) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [type, setType] = useState<ProofType>('text')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const submit = async () => {
    if (!target) return
    setLoading(true)
    try {
      let content = text.trim()
      if (type === 'url') content = url.trim()
      if (type === 'image') content = image ?? ''
      if (!content) throw new Error('Add some content first.')
      if (!user) throw new Error('Not signed in.')
      await db.submitProof(target.completionId, target.task.id, user.id, target.task.challenge_id, type, content)
      toast('Proof submitted for review.')
      onSubmitted()
      onClose()
      setText('')
      setUrl('')
      setImage(null)
      setType('text')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not submit proof.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const readFile = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImage(String(reader.result))
    reader.readAsDataURL(file)
  }

  const types: { value: ProofType; label: string; icon: React.ReactNode }[] = [
    { value: 'text', label: 'Text', icon: <Type className="h-4 w-4" /> },
    { value: 'url', label: 'Link', icon: <Link2 className="h-4 w-4" /> },
    { value: 'image', label: 'Photo', icon: <FileImage className="h-4 w-4" /> },
  ]

  return (
    <Modal open={target !== null} onClose={onClose} title={`Proof: ${target?.task.name ?? ''}`}>
      {target && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl bg-primary-fixed/70 p-3 text-sm text-primary-onFixedVariant">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            This task requires proof. Show what you did so the challenge can verify it.
          </div>

          <div className="inline-flex rounded-full bg-surface-container p-1">
            {types.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={clsx(
                  'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition',
                  type === t.value ? 'bg-surface-containerLowest text-onSurface shadow-card' : 'text-onSurfaceVariant hover:text-onSurface'
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {type === 'text' && <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Describe what you completed…" />}
          {type === 'url' && (
            <Field label="Link">
              <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            </Field>
          )}
          {type === 'image' && (
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} />
              {image ? (
                <div className="relative overflow-hidden rounded-xl">
                  <img src={image} alt="Proof" className="max-h-64 w-full object-cover" />
                  <button onClick={() => setImage(null)} className="absolute right-2 top-2 rounded-full bg-gray-900/60 px-3 py-1 text-xs font-semibold text-white">
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-surface-outlineVariant bg-surface-containerLow py-8 text-sm font-medium text-onSurfaceVariant transition hover:border-primary-fixed-dim hover:text-primary-container"
                >
                  <FileImage className="h-6 w-6" />
                  Upload a photo
                </button>
              )}
            </div>
          )}

          <Button onClick={submit} loading={loading} className="w-full">
            Submit proof
          </Button>
        </div>
      )}
    </Modal>
  )
}
