import { NavLink } from 'react-router-dom'

const ITEMS = [
  { to: '/', label: 'Today', icon: '🏠' },
  { to: '/week', label: 'Week', icon: '📅' },
  { to: '/projects', label: 'Projects', icon: '🚀' },
  { to: '/goals', label: 'Goals', icon: '🎯' },
  { to: '/progress', label: 'Progress', icon: '📊' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export function Nav() {
  return (
    <>
      <nav className="hidden sm:flex flex-col w-56 shrink-0 border-r border-ink-800 px-3 py-5 gap-1">
        <div className="px-3 mb-6">
          <p className="text-lg font-bold tracking-tight text-slate-100">
            Level <span className="text-accent">Up</span>
          </p>
        </div>
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-ink-800 text-slate-100' : 'text-slate-400 hover:bg-ink-850 hover:text-slate-200'
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-ink-900/95 backdrop-blur border-t border-ink-800 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around">
          {ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 px-2 flex-1 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-accent' : 'text-slate-500'
                }`
              }
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  )
}
