import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from './contexts/AuthContext'
import { AppShell } from './components/AppShell'
import { SplashScreen } from './components/SplashScreen'

const AuthPage = lazy(() => import('./pages/AuthPage').then((m) => ({ default: m.AuthPage })))
const TodayPage = lazy(() => import('./pages/TodayPage').then((m) => ({ default: m.TodayPage })))
const ChallengesPage = lazy(() => import('./pages/ChallengesPage').then((m) => ({ default: m.ChallengesPage })))
const ChallengePage = lazy(() => import('./pages/ChallengePage').then((m) => ({ default: m.ChallengePage })))
const TasksPage = lazy(() => import('./pages/TasksPage').then((m) => ({ default: m.TasksPage })))
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage })))
const MembersPage = lazy(() => import('./pages/MembersPage').then((m) => ({ default: m.MembersPage })))
const ProofsPage = lazy(() => import('./pages/ProofsPage').then((m) => ({ default: m.ProofsPage })))
const JoinPage = lazy(() => import('./pages/JoinPage').then((m) => ({ default: m.JoinPage })))
const CreateChallengePage = lazy(() => import('./pages/CreateChallengePage').then((m) => ({ default: m.CreateChallengePage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <SplashScreen />
  if (!user) return <Navigate to="/auth" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

export default function App() {
  const { user } = useAuth()
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  if (user && pathname === '/auth') return <Navigate to="/dashboard" replace />

  return (
    <Suspense fallback={<SplashScreen />}>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<TodayPage />} />
          <Route path="/today" element={<Navigate to="/dashboard" replace />} />
          <Route path="/challenges" element={<ChallengesPage />} />
          <Route path="/join" element={<JoinPage />} />
          <Route path="/create" element={<CreateChallengePage />} />
          <Route path="/challenge/:id" element={<ChallengePage />} />
          <Route path="/challenge/:id/tasks" element={<TasksPage />} />
          <Route path="/challenge/:id/leaderboard" element={<LeaderboardPage />} />
          <Route path="/challenge/:id/members" element={<MembersPage />} />
          <Route path="/challenge/:id/proofs" element={<ProofsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
