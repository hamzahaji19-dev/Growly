import { useCallback, useEffect, useState } from 'react'
import { db } from '../lib'
import { useAuth } from '../contexts/AuthContext'
import type { Activity, Challenge, MemberWithProfile, ProofWithMeta, Task, TaskCompletion } from '../lib/types'

export interface ChallengeBundle {
  challenge: Challenge | null
  members: MemberWithProfile[]
  tasks: Task[]
  completions: TaskCompletion[]
  activity: Activity[]
  proofs: ProofWithMeta[]
  loading: boolean
  error: string | null
  reload: () => void
}

export function useChallengeData(challengeId: string | undefined): ChallengeBundle {
  const { user } = useAuth()
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [completions, setCompletions] = useState<TaskCompletion[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [proofs, setProofs] = useState<ProofWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!challengeId) return
    let active = true
    setLoading(true)
    ;(async () => {
      try {
        const [ch, mem, tks, comps, acts, prfs] = await Promise.all([
          db.getChallenge(challengeId),
          db.listMembers(challengeId),
          db.listTasks(challengeId),
          db.listCompletions(challengeId),
          db.listActivity(challengeId, 50),
          db.listProofs(challengeId),
        ])
        if (!active) return
        setChallenge(ch)
        setMembers(mem)
        setTasks(tks)
        setCompletions(comps)
        setActivity(acts)
        setProofs(prfs)
        setError(null)
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load challenge.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [challengeId, tick])

  useEffect(() => {
    if (!challengeId) return
    const unsubs: (() => void)[] = [db.subscribeToChallenge(challengeId, reload)]
    if (user) unsubs.push(db.subscribeToUser(user.id, reload))
    return () => unsubs.forEach((u) => u())
  }, [challengeId, user, reload])

  return { challenge, members, tasks, completions, activity, proofs, loading, error, reload }
}
