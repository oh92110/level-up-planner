import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { Card, Empty, PriorityChip, SectionHeading } from '../components/ui'
import { TaskRow } from '../components/TaskRow'
import { TaskForm } from '../components/TaskForm'
import { WhatNow } from '../components/WhatNow'
import { MissedTaskPrompt } from '../components/MissedTaskPrompt'
import { WeeklyReview } from './WeeklyReview'
import {
  currentMilestone,
  freeWindows,
  projectProgress,
  rankTasks,
  remainingFreeMinutes,
  todayCandidates,
  totalFreeMinutes,
} from '../lib/engine'
import { formatDuration, formatLong, formatTime, today, weekStart, weekdayOf } from '../lib/dates'
import { WEEKDAYS } from '../lib/types'

export function Today() {
  const { tasks, projects, commitments, preferences, milestones, reviews } = useStore()
  const [showAdd, setShowAdd] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const ref = today()
  const wd = weekdayOf(ref)
  const reviewDoneThisWeek = reviews.some((r) => r.week_start === weekStart(ref))

  const todaysCommitments = useMemo(
    () =>
      commitments
        .filter((c) => c.weekday === wd && c.active)
        .sort((a, b) => (a.start_time ?? '99:99').localeCompare(b.start_time ?? '99:99')),
    [commitments, wd],
  )

  const candidates = useMemo(() => todayCandidates(tasks, ref), [tasks, ref])
  const ranked = useMemo(
    () => rankTasks(candidates, { ref, projects, preferences }),
    [candidates, ref, projects, preferences],
  )

  const top = ranked.slice(0, 3)
  const rest = ranked.slice(3)
  const completedToday = tasks.filter((t) => t.completed && t.completed_at?.slice(0, 10) === ref)

  const windows = freeWindows(todaysCommitments, preferences)
  const freeMin = totalFreeMinutes(windows)
  const remainingMin = remainingFreeMinutes(todaysCommitments, preferences)

  const training = todaysCommitments.filter((c) => c.kind === 'training')
  const work = todaysCommitments.filter((c) => c.kind === 'work')
  const other = todaysCommitments.filter((c) => c.kind !== 'training' && c.kind !== 'work')

  const activeProjects = projects
    .filter((p) => !p.archived && p.status !== 'complete')
    .map((p) => ({ project: p, progress: projectProgress(p, milestones) }))

  const upcoming = tasks
    .filter((t) => !t.completed && t.due_date && t.due_date >= ref)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
    .slice(0, 4)

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-0 pb-8">
      <MissedTaskPrompt />

      <header className="pt-6 pb-5">
        <p className="text-xs font-medium text-accent-soft uppercase tracking-wide mb-1">{WEEKDAYS[wd]}</p>
        <h1 className="text-2xl font-bold text-slate-100">{formatLong(ref)}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {freeMin > 0 ? `${formatDuration(freeMin)} of free time today` : 'Fully booked today'}
          {remainingMin > 0 && remainingMin < freeMin && ` · ${formatDuration(remainingMin)} left`}
        </p>
      </header>

      <div className="mb-6">
        <WhatNow />
      </div>

      <AnimatePresence>
        {wd === 0 && !reviewDoneThisWeek && (
          <motion.button
            initial={{ opacity: 0, y: -8, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto', marginBottom: 20 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setShowReview(true)}
            className="w-full text-left card !bg-accent/10 border-accent/30 p-4 hover:!bg-accent/15 transition-colors overflow-hidden"
          >
            <p className="text-sm font-semibold text-accent-soft">It's Sunday — do your weekly review</p>
            <p className="text-xs text-slate-400 mt-1">
              Quick look at what got done, what slipped, and the 3–5 things that matter next week.
            </p>
          </motion.button>
        )}
      </AnimatePresence>

      {(work.length > 0 || training.length > 0 || other.length > 0) && (
        <Card className="mb-5">
          <SectionHeading title="Today's commitments" />
          <div className="space-y-2.5">
            {[...work, ...training, ...other].map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-200">
                  {c.kind === 'training' ? '🥊 ' : c.kind === 'work' ? '💼 ' : '📝 '}
                  {c.label}
                </span>
                <span className="text-slate-500 text-xs">
                  {c.start_time ? `${formatTime(c.start_time)} – ${formatTime(c.end_time)}` : 'Anytime today'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-5">
        <SectionHeading
          title="Top priorities"
          action={
            <button onClick={() => setShowAdd(true)} className="btn-quiet text-xs px-2 py-1">
              + Add task
            </button>
          }
        />
        <Card className="!p-2">
          {top.length === 0 ? (
            <Empty icon="✨" text="Nothing urgent right now. Pull something forward from a project below." />
          ) : (
            <div className="divide-y divide-ink-800/60">
              <AnimatePresence initial={false}>
                {top.map((s) => (
                  <TaskRow key={s.task.id} task={s.task} emphasis />
                ))}
              </AnimatePresence>
            </div>
          )}
        </Card>
      </div>

      {rest.length > 0 && (
        <div className="mb-5">
          <SectionHeading title="Also on today" />
          <Card className="!p-2">
            <div className="divide-y divide-ink-800/60">
              <AnimatePresence initial={false}>
                {rest.map((s) => (
                  <TaskRow key={s.task.id} task={s.task} />
                ))}
              </AnimatePresence>
            </div>
          </Card>
        </div>
      )}

      {completedToday.length > 0 && (
        <div className="mb-5">
          <SectionHeading title={`Done today (${completedToday.length})`} />
          <Card className="!p-2">
            <div className="divide-y divide-ink-800/60">
              <AnimatePresence initial={false}>
                {completedToday.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </AnimatePresence>
            </div>
          </Card>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="mb-5">
          <SectionHeading title="Coming up" />
          <Card>
            <div className="space-y-2.5">
              {upcoming.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300 truncate pr-3">{t.name}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <PriorityChip priority={t.priority} compact />
                    <span className="text-xs text-slate-500">{t.due_date}</span>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeProjects.length > 0 && (
        <div className="mb-5">
          <SectionHeading title="Project progress" />
          <div className="grid gap-2.5">
            {activeProjects.map(({ project, progress }) => (
              <ProjectMini key={project.id} project={project} milestones={milestones} progress={progress} />
            ))}
          </div>
        </div>
      )}

      <div className="text-center py-6">
        {!reviewDoneThisWeek && wd !== 0 && (
          <button onClick={() => setShowReview(true)} className="btn-quiet text-xs mb-2">
            Run weekly review early
          </button>
        )}
        <p className="text-xs text-slate-600">Free time left over is yours. It's not another task slot.</p>
      </div>

      <TaskForm open={showAdd} onClose={() => setShowAdd(false)} />
      <AnimatePresence>{showReview && <WeeklyReview onClose={() => setShowReview(false)} />}</AnimatePresence>
    </div>
  )
}

function ProjectMini({
  project,
  milestones,
  progress,
}: {
  project: import('../lib/types').Project
  milestones: import('../lib/types').Milestone[]
  progress: number
}) {
  const mine = milestones.filter((m) => m.project_id === project.id)
  const current = currentMilestone(project, mine)
  return (
    <Card className="!p-3.5">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-sm font-medium text-slate-200 truncate">{project.name}</p>
        <span className="text-xs text-slate-500 shrink-0">{progress}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-ink-800 overflow-hidden mb-2">
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${progress}%` }} />
      </div>
      {current && <p className="text-xs text-slate-500 truncate">Next: {current.name}</p>}
    </Card>
  )
}
