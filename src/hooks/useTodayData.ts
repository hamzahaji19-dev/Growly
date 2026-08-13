import { useCallback, useEffect, useState } from 'react'
import { db } from '../lib'
import { useAuth } from '../contexts/AuthContext'
import type { ChallengeWithMeta, Task, TaskCompletion } from '../lib/types'

export interface TodayChallenge {
  challenge: ChallengeWithMeta
  tasks: Task[]
  completions: TaskCompletion[]
}

export interface TodayBundle {
  items: TodayChallenge[]
  loading: boolean
  error: string | null
  reload: () => void
}

export function useTodayData(): TodayBundle {
  const { user } = useAuth()
  const [items, setItems] = useState<TodayChallenge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true)
    ;(async () => {
      try {
        const challenges = await db.listChallengesForUser(user.id)
        const rows = await Promise.all(
          challenges.map(async (ch) => {
            const [tasks, completions] = await Promise.all([db.listTasks(ch.id), db.listCompletions(ch.id)])
            return { challenge: ch, tasks, completions }
          })
        )
        if (active) {
          setItems(rows)
          setError(null)
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load your challenges.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [user, tick])

  useEffect(() => {
    if (!user) return
    const unsubs = [db.subscribeToUser(user.id, reload)]
    return () => unsubs.forEach((u) => u())
  }, [user, reload])

  return { items, loading, error, reload }
}
