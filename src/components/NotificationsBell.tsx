import { useCallback, useEffect, useState } from 'react'
import { Bell, BellRing, CheckCheck, Trophy, Flame, Zap, Users, ShieldAlert, Target, Sprout } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { db } from '../lib'
import { useAuth } from '../contexts/AuthContext'
import { timeAgo } from '../lib/calc'
import type { AppNotification } from '../lib/types'

const KIND_ICONS: Record<string, React.ReactNode> = {
  achievement: <Trophy className="h-4 w-4" />,
  streak_risk: <Flame className="h-4 w-4" />,
  xp_gap: <Zap className="h-4 w-4" />,
  member_joined: <Users className="h-4 w-4" />,
  proof_reviewed: <ShieldAlert className="h-4 w-4" />,
  target_met: <Target className="h-4 w-4" />,
  challenge_start: <Sprout className="h-4 w-4" />,
}

export function useNotifications() {
  const { user } = useAuth()
  const [items, setItems] = useState<AppNotification[]>([])

  const reload = useCallback(async () => {
    if (!user) return
    setItems(await db.listNotifications(user.id))
  }, [user])

  useEffect(() => {
    reload()
    if (!user) return
    const unsub = db.subscribeToUser(user.id, reload)
    void db.pushScheduledNotifications(user.id)
    return unsub
  }, [user, reload])

  return { items, reload }
}

export function NotificationsBell() {
  const { items, reload } = useNotifications()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const unread = items.filter((n) => !n.read).length

  const markAll = async () => {
    const { user } = useAuthFromBell()
    if (!user) return
    await db.markAllNotificationsRead(user.id)
    await reload()
  }

  const openNotification = async (n: AppNotification) => {
    await db.markNotificationRead(n.id)
    await reload()
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full p-2 text-onSurfaceVariant transition hover:bg-surface-container"
        aria-label="Notifications"
      >
        {unread > 0 ? <BellRing className="h-5 w-5 text-primary-container" /> : <Bell className="h-5 w-5" />}
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary-container px-1 text-[10px] font-bold text-secondary-onContainer">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-surface-outlineVariant bg-surface-containerLowest shadow-pop sm:w-96">
            <div className="flex items-center justify-between border-b border-surface-outlineVariant px-4 py-3">
              <p className="font-display font-bold text-on-surface">Notifications</p>
              {unread > 0 && (
                <button onClick={markAll} className="flex items-center gap-1 text-xs font-semibold text-primary-onFixedVariant hover:text-primary-container">
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-onSurfaceVariant/70">You're all caught up.</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => openNotification(n)}
                    className={clsx(
                      'flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface-containerLow',
                      !n.read && 'bg-primary-fixed/40'
                    )}
                  >
                    <span
                      className={clsx(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                        n.read ? 'bg-surface-containerHigh text-onSurfaceVariant' : 'bg-primary-fixed text-primary-onFixedVariant'
                      )}
                    >
                      {KIND_ICONS[n.kind] ?? <Bell className="h-4 w-4" />}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm text-on-surface">{n.text}</span>
                      <span className="mt-0.5 block text-xs text-onSurfaceVariant/70">{timeAgo(n.created_at)}</span>
                    </span>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-secondary-container" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function useAuthFromBell() {
  const { user } = useAuth()
  return { user }
}
