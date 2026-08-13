import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { db } from '../lib'
import type { EnterResult, SessionUser } from '../lib/db'
import type { Profile } from '../lib/types'

interface AuthContextValue {
  user: SessionUser | null
  profile: Profile | null
  loading: boolean
  enter: (username: string) => Promise<EnterResult>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async () => {
    const session = await db.getSession()
    if (!session) {
      setUser(null)
      setProfile(null)
      return
    }
    setUser(session)
    const p = await db.getProfile(session.id)
    setProfile(p)
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        await refreshProfile()
      } finally {
        if (active) setLoading(false)
      }
    })()
    const unsub = db.onAuthChange(async (u) => {
      setUser(u)
      setLoading(false)
      if (u) {
        const p = await db.getProfile(u.id)
        setProfile(p)
      } else {
        setProfile(null)
      }
    })
    return () => {
      active = false
      unsub()
    }
  }, [refreshProfile])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      enter: async (username) => {
        const result = await db.getOrCreateByUsername(username)
        await refreshProfile()
        return result
      },
      signOut: async () => {
        await db.signOut()
        setUser(null)
        setProfile(null)
      },
      refreshProfile,
    }),
    [user, profile, loading, refreshProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
