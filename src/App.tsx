import { Route, Routes } from 'react-router-dom'
import { useStore } from './store'
import { Nav } from './components/Nav'
import { Login } from './pages/Login'
import { Today } from './pages/Today'
import { Week } from './pages/Week'
import { Projects } from './pages/Projects'
import { Goals } from './pages/Goals'
import { Progress } from './pages/Progress'
import { Settings } from './pages/Settings'

export default function App() {
  const { session, loading, ready } = useStore()

  if (!session) return <Login />

  if (loading || !ready) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 rounded-full border-2 border-ink-700 border-t-accent animate-spin" />
          <p className="text-xs text-slate-500">Setting things up…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex">
      <Nav />
      <main className="flex-1 min-w-0 pb-20 sm:pb-8">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/week" element={<Week />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
