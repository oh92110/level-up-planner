import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'

const ITEMS = [
  { to: '/', label: 'Week', icon: '📅' },
  { to: '/tasks', label: 'Tasks', icon: '✅' },
  { to: '/projects', label: 'Projects', icon: '🚀' },
  { to: '/goals', label: 'Goals', icon: '🎯' },
  { to: '/progress', label: 'Progress', icon: '📊' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

function isActivePath(pathname: string, to: string) {
  if (to === '/') return pathname === '/' || pathname === ''
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function Nav() {
  const location = useLocation()

  return (
    <>
      <nav className="hidden sm:flex flex-col w-56 shrink-0 border-r border-ink-800 px-3 py-5 gap-1">
        <div className="px-3 mb-6">
          <p className="text-lg font-bold tracking-tight text-slate-100">
            Level <span className="text-cyan">Up</span>
          </p>
        </div>
        {ITEMS.map((item) => {
          const active = isActivePath(location.pathname, item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? 'text-slate-100' : 'text-slate-400 hover:bg-ink-850 hover:text-slate-200'
              }`}
            >
              {active && (
                <motion.div
                  layoutId="desktop-nav-pill"
                  className="absolute inset-0 bg-ink-800 rounded-xl"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative z-10 text-base">{item.icon}</span>
              <span className="relative z-10">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-ink-900/95 backdrop-blur border-t border-ink-800 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around">
          {ITEMS.map((item) => {
            const active = isActivePath(location.pathname, item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative flex flex-col items-center gap-0.5 py-2.5 px-2 flex-1 text-[10px] font-medium transition-colors ${
                  active ? 'text-cyan-soft' : 'text-slate-500'
                }`}
              >
                <motion.span
                  className="text-lg leading-none"
                  animate={{ scale: active ? 1.12 : 1, y: active ? -1 : 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                >
                  {item.icon}
                </motion.span>
                {item.label}
                {active && (
                  <motion.div
                    layoutId="mobile-nav-dot"
                    className="absolute bottom-1 h-1 w-1 rounded-full bg-cyan"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  />
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
