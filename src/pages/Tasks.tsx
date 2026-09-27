import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { Card, Empty, SectionHeading } from '../components/ui'
import { TaskRow } from '../components/TaskRow'
import { TaskForm } from '../components/TaskForm'
import { WhatNow } from '../components/WhatNow'
import { MissedTaskPrompt } from '../components/MissedTaskPrompt'
import { rankTasks, todayCandidates } from '../lib/engine'
import { formatLong, today, weekdayOf } from '../lib/dates'
import { WEEKDAYS } from '../lib/types'
import type { Project } from '../lib/types'

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

  const allOpen = useMemo(() => {
    const open = tasks.filter((t) => !t.completed)
    return rankTasks(open, { ref, projects, preferences }).map((s) => s.task)
  }, [tasks, ref, projects, preferences])

  const completed = useMemo(
    () => [...tasks.filter((t) => t.completed)].sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
    [tasks],
  )

  const grouped = useMemo(() => {
    const byProject = new Map<string, { project: Project | null; tasks: typeof allOpen }>()
    for (const t of allOpen) {
      const key = t.project_id ?? '__none__'
      if (!byProject.has(key)) {
        byProject.set(key, { project: projects.find((p) => p.id === t.project_id) ?? null, tasks: [] })
      }
      byProject.get(key)!.tasks.push(t)
    }
    return Array.from(byProject.values()).sort((a, b) => {
      if (!a.project) return 1
      if (!b.project) return -1
      return a.project.sort_order - b.project.sort_order
    })
  }, [allOpen, projects])

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
        <SectionHeading title={`All tasks (${allOpen.length})`} />
        {grouped.length === 0 ? (
          <Card>
            <Empty icon="📋" text="No open tasks anywhere. Add one, or check back later." />
          </Card>
        ) : (
          <div className="space-y-4">
            {grouped.map(({ project, tasks: group }) => (
              <div key={project?.id ?? 'none'}>
                <p className="text-xs font-mono text-slate-500 uppercase tracking-wide mb-1.5 px-1">
                  {project ? project.name : 'No project'}
                </p>
                <Card className="!p-2">
                  <div className="divide-y divide-ink-800/60">
                    <AnimatePresence initial={false}>
                      {group.map((t) => (
                        <TaskRow key={t.id} task={t} showProject={false} />
                      ))}
                    </AnimatePresence>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}

        {completed.length > 0 && (
          <div className="mt-5">
            <button
              onClick={() => setShowCompleted((s) => !s)}
              className="btn-quiet text-xs px-2 py-1 font-mono"
            >
              {showCompleted ? '▾' : '▸'} completed ({completed.length})
            </button>
            <AnimatePresence initial={false}>
              {showCompleted && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <Card className="!p-2 mt-2">
                    <div className="divide-y divide-ink-800/60">
                      {completed.slice(0, 50).map((t) => (
                        <TaskRow key={t.id} task={t} />
                      ))}
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <TaskForm open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  )
}
