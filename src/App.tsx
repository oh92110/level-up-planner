import { Navigate, Route, Routes } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useStore } from './store'
import { Nav } from './components/Nav'
import { Login } from './pages/Login'
import { Week } from './pages/Week'
import { Tasks } from './pages/Tasks'
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
        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="h-6 w-6 rounded-full border-2 border-ink-700 border-t-accent"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
          />
          <p className="text-xs text-slate-500">Setting things up…</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex">
      <Nav />
      <main className="flex-1 min-w-0 pb-20 sm:pb-8 overflow-x-hidden">
        <Routes>
          <Route path="/" element={<Week />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/week" element={<Navigate to="/" replace />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
