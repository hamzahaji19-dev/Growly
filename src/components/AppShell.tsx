import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Award, Home, Leaf, LogOut, Plus, Sprout } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../contexts/AuthContext'
import { Avatar } from './Avatar'
import { NotificationsBell } from './NotificationsBell'

const NAV = [
  { to: '/dashboard', label: 'Home', icon: Home, match: (p: string) => p === '/dashboard' || p === '/today' },
  {
    to: '/challenges',
    label: 'My Challenges',
    icon: Leaf,
    match: (p: string) => p === '/challenges' || p.startsWith('/challenge') || p === '/join' || p === '/create',
  },
  {
    to: '/profile',
    label: 'Profile',
    icon: Award,
    match: (p: string) => p.startsWith('/profile') || p.startsWith('/settings'),
  },
]

export function AppShell() {
  const { profile, user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const activeIndex = NAV.findIndex((n) => n.match(location.pathname))

  const doSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-surface-outlineVariant bg-surface-containerLowest px-5 lg:hidden">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-gradient text-white">
            <Sprout className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-primary">Growly</span>
        </button>
        <div className="flex items-center gap-2">
          <NotificationsBell />
          <button onClick={() => navigate('/profile')} aria-label="Profile" className="rounded-full p-0.5 transition hover:opacity-80">
            <Avatar name={profile?.name ?? user?.username ?? '?'} url={profile?.avatar_url} size="sm" />
          </button>
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 flex-col gap-4 border-r border-surface-outlineVariant bg-surface-containerLow p-4 lg:flex">
        <div className="flex flex-col items-center border-b border-surface-outlineVariant/30 px-2 pb-6 pt-4">
          <button onClick={() => navigate('/profile')} className="mb-3" aria-label="Profile">
            <Avatar name={profile?.name ?? user?.username ?? '?'} url={profile?.avatar_url} size="lg" className="mx-auto" />
          </button>
          <h2 className="font-display text-xl font-bold text-primary">Welcome Back</h2>
          <p className="text-sm text-onSurfaceVariant">@{user?.username ?? 'Stay Nurtured'}</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {NAV.map((item, i) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={clsx(
                'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition',
                i === activeIndex
                  ? 'bg-secondary-container font-bold text-secondary-onContainer shadow-sm'
                  : 'text-onSurfaceVariant hover:bg-surface-containerHighest hover:text-on-surface'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
          <button
            onClick={() => navigate('/create')}
            className={clsx(
              'mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-accent-gradient px-4 py-3 text-sm font-semibold text-white shadow-card transition hover:brightness-105',
              location.pathname === '/create' && 'ring-2 ring-secondary-container'
            )}
          >
            <Plus className="h-5 w-5" />
            Create Challenge
          </button>
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-surface-outlineVariant/30 pt-4">
          <button onClick={doSignOut} className="flex items-center gap-3 rounded-xl px-3.5 py-2 text-left text-sm font-medium text-onSurfaceVariant transition hover:bg-red-50 hover:text-red-600">
            <LogOut className="h-5 w-5" /> Logout
          </button>
        </div>
      </aside>

      <main className="pb-24 pt-16 lg:pb-12 lg:pl-64 lg:pt-0">
        <div className="mx-auto max-w-7xl p-5 lg:p-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-outlineVariant bg-surface-containerLowest lg:hidden">
        <div className="mx-auto flex items-center justify-around px-4 pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5">
          <NavLink to="/dashboard" className={navItemClass(location, 0)}>
            <Home className={clsx('h-6 w-6', activeIndex === 0 && 'text-secondary-container')} />
            Home
          </NavLink>
          <NavLink to="/challenges" className={navItemClass(location, 1)}>
            <Leaf className={clsx('h-6 w-6', activeIndex === 1 && 'text-secondary-container')} />
            Habits
          </NavLink>
          <NavLink to="/create" className="flex flex-col items-center gap-1 text-[10px] font-semibold text-onSurfaceVariant">
            <span className="mb-0.5 flex h-11 w-11 items-center justify-center rounded-full bg-accent-gradient text-white shadow-card transition active:scale-95">
              <Plus className="h-6 w-6" />
            </span>
            Create
          </NavLink>
          <NavLink to="/profile" className={navItemClass(location, 2)}>
            <Award className={clsx('h-6 w-6', activeIndex === 2 && 'text-secondary-container')} />
            Profile
          </NavLink>
        </div>
      </nav>
    </div>
  )
}

function navItemClass(location: { pathname: string }, index: number) {
  return clsx(
    'flex flex-col items-center gap-1 px-2 py-1 text-[10px] font-semibold transition',
    index === NAV.findIndex((n) => n.match(location.pathname)) ? 'text-primary' : 'text-onSurfaceVariant'
  )
}
