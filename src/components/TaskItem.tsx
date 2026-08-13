import { Check, Flame, Dumbbell, Code2, BookOpen, Globe, PenTool, Brain, Apple, Briefcase, MoreHorizontal, Clock, ShieldCheck } from 'lucide-react'
import clsx from 'clsx'
import type { Task, TaskCategory } from '../lib/types'

export const CATEGORY_ICONS: Record<TaskCategory, React.ComponentType<{ className?: string }>> = {
  workout: Dumbbell,
  coding: Code2,
  reading: BookOpen,
  web: Globe,
  content: PenTool,
  mindfulness: Brain,
  diet: Apple,
  productivity: Briefcase,
  other: MoreHorizontal,
}

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  workout: 'Workout',
  coding: 'Coding',
  reading: 'Reading',
  web: 'Web',
  content: 'Content',
  mindfulness: 'Mindfulness',
  diet: 'Diet',
  productivity: 'Productivity',
  other: 'Other',
}

interface TaskItemProps {
  task: Task
  completed: boolean
  onToggle: () => void
  disabled?: boolean
  streak?: number
  showMeta?: boolean
}

export function TaskItem({ task, completed, onToggle, disabled, streak = 0, showMeta = true }: TaskItemProps) {
  const Icon = CATEGORY_ICONS[task.category]
  const subtitle = completed
    ? streak > 0
      ? `${streak} Day Streak`
      : 'Complete again'
    : 'Start your streak'
  return (
    <div className="flex items-center justify-between gap-3 rounded-[20px] bg-surface-containerLowest p-3 shadow-card transition active:translate-y-px sm:p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={clsx(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            completed ? 'bg-secondary-container/20 text-secondary' : 'bg-surface-containerHigh text-surface-outline'
          )}
        >
          {completed ? <Flame className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <p className={clsx('truncate font-display text-sm font-semibold', completed ? 'text-onSurfaceVariant' : 'text-on-surface')}>
            {task.name}
          </p>
          {showMeta && (
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-onSurfaceVariant">
              {subtitle}
              {!completed && task.time && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {task.time}
                </span>
              )}
              {!completed && task.proof_required && (
                <span className="inline-flex items-center gap-0.5 font-medium text-primary-onFixedVariant">
                  <ShieldCheck className="h-3 w-3" /> proof
                </span>
              )}
            </p>
          )}
        </div>
      </div>
      <button
        onClick={onToggle}
        disabled={disabled}
        aria-label={completed ? `Mark ${task.name} incomplete` : `Complete ${task.name}`}
        className={clsx(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90',
          completed
            ? 'border-primary-fixed-dim bg-primary text-primary-on'
            : 'border-surface-outlineVariant bg-transparent hover:border-primary-fixed-dim hover:bg-primary-fixed/20',
          disabled && 'cursor-wait opacity-60'
        )}
      >
        {completed && <Check className="h-4 w-4" strokeWidth={3} />}
      </button>
    </div>
  )
}
