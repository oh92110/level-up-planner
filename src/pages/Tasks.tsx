import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { Card, Empty, SectionHeading } from '../components/ui'
import { TaskRow } from '../components/TaskRow'
import { TaskForm } from '../components/TaskForm'
import { WhatNow } from '../components/WhatNow'
import { MissedTaskPrompt } from '../components/MissedTaskPrompt'
import { backlogTasks, rankTasks, todayCandidates } from '../lib/engine'
import { formatLong, today, weekdayOf } from '../lib/dates'
import { WEEKDAYS } from '../lib/types'

export function Tasks() {
  const { tasks, projects, preferences } = useStore()
  const [showAdd, setShowAdd] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const ref = today()
  const wd = weekdayOf(ref)

  const todaysTasks = useMemo(() => {
    const candidates = todayCandidates(tasks, ref)
    return rankTasks(candidates, { ref, projects, preferences }).map((s) => s.task)
  }, [tasks, ref, projects, preferences])

  const backlog = useMemo(() => {
    const rest = backlogTasks(tasks, ref)
    return rankTasks(rest, { ref, projects, preferences }).map((s) => s.task)
  }, [tasks, ref, projects, preferences])

  const completed = useMemo(
    () => [...tasks.filter((t) => t.completed)].sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
    [tasks],
  )

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-0 pb-8">
      <MissedTaskPrompt />

      <header className="pt-6 pb-5">
        <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.22em] text-cyan mb-1.5">
          // {WEEKDAYS[wd]}
        </p>
        <h1 className="text-2xl font-bold text-slate-100">Tasks</h1>
        <p className="text-sm text-slate-500 mt-1">{formatLong(ref)}</p>
      </header>

      <div className="mb-6">
        <WhatNow />
      </div>

      <div className="mb-6">
        <SectionHeading
          title={`Today (${todaysTasks.length})`}
          action={
            <button onClick={() => setShowAdd(true)} className="btn-quiet text-xs px-2 py-1">
              + Add task
            </button>
          }
        />
        {todaysTasks.length === 0 ? (
          <Card>
            <Empty icon="✨" text="Nothing lined up for today." />
          </Card>
        ) : (
          <ul className="space-y-0.5">
            <AnimatePresence initial={false}>
              {todaysTasks.map((t) => (
                <motion.li
                  key={t.id}
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-start gap-2.5"
                >
                  <span className="mt-3 h-1 w-1 rounded-full bg-cyan shrink-0" />
                  <div className="flex-1 min-w-0">
                    <TaskRow task={t} />
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <div>
        <SectionHeading title={`Backlog (${backlog.length})`} />
        {backlog.length === 0 ? (
          <Card>
            <Empty icon="📋" text="Nothing waiting. Everything open is already lined up for today." />
          </Card>
        ) : (
          <Card className="!p-2">
            <div className="divide-y divide-ink-800/60">
              <AnimatePresence initial={false}>
                {backlog.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </AnimatePresence>
            </div>
          </Card>
        )}

        {completed.length > 0 && (
          <div className="mt-5">
            <button onClick={() => setShowCompleted((s) => !s)} className="btn-quiet text-xs px-2 py-1 font-mono">
              {showCompleted ? '▾' : '▸'} completed ({completed.length})
            </button>
            <div
              className="overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out"
              style={{ maxHeight: showCompleted ? 4000 : 0, opacity: showCompleted ? 1 : 0 }}
            >
              <Card className="!p-2 mt-2">
                <div className="divide-y divide-ink-800/60">
                  {completed.slice(0, 50).map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>

      <TaskForm open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  )
}
