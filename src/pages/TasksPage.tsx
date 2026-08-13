import { useMemo, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { ListChecks, Plus, Pencil, Trash2, Flag } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useChallengeData } from '../hooks/useChallengeData'
import { db } from '../lib'
import { isDueOn, todayKey } from '../lib/calc'
import type { Difficulty, RepeatSchedule, Task, TaskCategory } from '../lib/types'
import { ChallengeNav } from '../components/ChallengeNav'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageSpinner, Select, Toggle } from '../components/ui'
import { CATEGORY_ICONS, CATEGORY_LABELS, TaskItem } from '../components/TaskItem'

const CATEGORIES: TaskCategory[] = ['workout', 'coding', 'reading', 'web', 'content', 'mindfulness', 'diet', 'productivity', 'other']
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']
const REPEATS: { value: RepeatSchedule; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekends', label: 'Weekends' },
]

const DIFF_POINTS: Record<Difficulty, number> = { easy: 5, medium: 10, hard: 20 }

const REPEAT_LABELS: Record<RepeatSchedule, string> = { daily: 'Daily', weekdays: 'Weekdays', weekends: 'Weekends' }

interface TaskForm {
  name: string
  description: string
  category: TaskCategory
  difficulty: Difficulty
  points: number
  time: string
  repeat: RepeatSchedule
  proof_required: boolean
}

const EMPTY_FORM: TaskForm = {
  name: '',
  description: '',
  category: 'other',
  difficulty: 'medium',
  points: 10,
  time: '',
  repeat: 'daily',
  proof_required: false,
}

export function TasksPage() {
  const { id } = useParams<{ id: string }>()
  const { challenge, tasks, completions, members, loading } = useChallengeData(id)
  const { user } = useAuth()
  const { toast } = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const today = todayKey()
  const creatorName = useMemo(() => new Map(members.map((m) => [m.user_id, m.profile.name])), [members])

  if (loading) return <PageSpinner />
  if (!challenge) return null

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEdit = (t: Task) => {
    setEditing(t)
    setForm({
      name: t.name,
      description: t.description ?? '',
      category: t.category,
      difficulty: t.difficulty,
      points: t.points,
      time: t.time ?? '',
      repeat: t.repeat,
      proof_required: t.proof_required,
    })
    setFormOpen(true)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!user || !challenge) return
    if (form.name.trim().length < 2) {
      toast('Give the task a name.', 'error')
      return
    }
    setSaving(true)
    try {
      const input = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category,
        difficulty: form.difficulty,
        points: form.points,
        time: form.time.trim() || null,
        repeat: form.repeat,
        proof_required: form.proof_required,
      }
      if (editing) {
        await db.updateTask(editing.id, input)
        toast('Task updated.')
      } else {
        await db.createTask(challenge.id, user.id, input)
        toast('Task added.')
      }
      setFormOpen(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save task.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (t: Task) => {
    if (!confirm(`Delete "${t.name}"? This removes all of its completions too.`)) return
    try {
      await db.deleteTask(t.id)
      toast('Task deleted.')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete task.', 'error')
    }
  }

  const doneIds = new Set(
    (completions ?? []).filter((c) => c.user_id === user?.id && c.date === today).map((c) => c.task_id)
  )
  const dueTasks = tasks.filter((t) => isDueOn(t.repeat, today))
  const offTasks = tasks.filter((t) => !isDueOn(t.repeat, today))

  const renderTask = (t: Task, completed: boolean) => (
    <div className="group flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <TaskItem task={t} completed={completed} onToggle={() => {}} />
      </div>
      <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
        <button onClick={() => openEdit(t)} className="rounded-full p-2 text-onSurfaceVariant/60 transition hover:bg-surface-container hover:text-on-surface" aria-label="Edit task">
          <Pencil className="h-4 w-4" />
        </button>
        <button onClick={() => remove(t)} className="rounded-full p-2 text-onSurfaceVariant/60 transition hover:bg-red-50 hover:text-red-500" aria-label="Delete task">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <ChallengeNav base={`/challenge/${challenge.id}`} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-on-surface">Tasks</h1>
          <p className="text-sm text-onSurfaceVariant">The daily routine everyone commits to.</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" /> Add task
        </Button>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-6 w-6" />}
          title="No tasks yet"
          description="Add a few daily tasks so members know what to complete."
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add the first task
            </Button>
          }
        />
      ) : (
        <>
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-onSurfaceVariant">Due today</h2>
              <Badge tone="green">{dueTasks.filter((t) => doneIds.has(t.id)).length}/{dueTasks.length}</Badge>
            </div>
            {dueTasks.length === 0 ? (
              <p className="py-4 text-center text-sm text-onSurfaceVariant">Nothing due today.</p>
            ) : (
              <ul className="space-y-3">
                {dueTasks.map((t) => (
                  <li key={t.id}>{renderTask(t, doneIds.has(t.id))}</li>
                ))}
              </ul>
            )}
          </Card>

          {offTasks.length > 0 && (
            <Card>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-onSurfaceVariant">Other days</h2>
              <ul className="space-y-3">
                {offTasks.map((t) => (
                  <li key={t.id}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <Badge tone="gray">{REPEAT_LABELS[t.repeat]}</Badge>
                      <span className="text-xs text-onSurfaceVariant">added by {creatorName.get(t.created_by) ?? 'someone'}</span>
                    </div>
                    {renderTask(t, false)}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit task' : 'Add a task'}>
        <form onSubmit={save} className="space-y-4">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Morning run" maxLength={60} autoFocus />
          </Field>
          <Field label="Description">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional details…" maxLength={160} />
          </Field>

          <Field label="Category">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => {
                const Icon = CATEGORY_ICONS[c]
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, category: c })}
                    className={clsx(
                      'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                      form.category === c ? 'border-primary-container bg-primary-fixed/40 text-primary-onFixedVariant' : 'border-surface-outlineVariant text-onSurfaceVariant hover:border-surface-outline'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {CATEGORY_LABELS[c]}
                  </button>
                )
              })}
            </div>
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Difficulty">
              <Select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value as Difficulty, points: DIFF_POINTS[e.target.value as Difficulty] })}>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d[0].toUpperCase() + d.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Points">
              <Input type="number" min={1} max={100} value={form.points} onChange={(e) => setForm({ ...form, points: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Repeat">
              <Select value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value as RepeatSchedule })}>
                {REPEATS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Time of day" hint="Optional — e.g. Morning, Afternoon, Evening.">
            <Input value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} placeholder="Morning" maxLength={20} />
          </Field>

          <div className="flex items-center justify-between rounded-xl bg-surface-containerLow p-3">
            <div>
              <p className="text-sm font-semibold text-on-surface">Require proof</p>
              <p className="text-xs text-onSurfaceVariant">Members must submit proof when completing.</p>
            </div>
            <Toggle checked={form.proof_required} onChange={(v) => setForm({ ...form, proof_required: v })} label="Require proof" />
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={saving} className="flex-1">
              {editing ? 'Save changes' : 'Add task'}
            </Button>
          </div>
        </form>
      </Modal>

      {tasks.length === 0 && (
        <div className="flex items-center justify-center gap-2 text-xs text-onSurfaceVariant/60">
          <Flag className="h-3.5 w-3.5" /> Tasks make a challenge real.
        </div>
      )}
    </div>
  )
}
