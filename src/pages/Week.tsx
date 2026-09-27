import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { Card, ProgressBar, SectionHeading } from '../components/ui'
import { TaskRow } from '../components/TaskRow'
import { TaskForm } from '../components/TaskForm'
import { WeeklyReview } from './WeeklyReview'
import { dayTimeline } from '../lib/engine'
import type { TimelineBlock } from '../lib/engine'
import {
  addDays,
  formatMinutesOfDay,
  formatShort,
  fromISO,
  today,
  weekDates,
  weekStart,
  weekdayOf,
} from '../lib/dates'
import { WEEKDAYS_SHORT } from '../lib/types'
import type { Preferences } from '../lib/types'

function weekNumber(iso: string): number {
  const d = fromISO(iso)
  const start = new Date(d.getFullYear(), 0, 1)
  const days = Math.floor((d.getTime() - start.getTime()) / 86400000)
  return Math.ceil((days + start.getDay() + 1) / 7)
}

export function Week() {
  const { tasks, reviews, preferences } = useStore()
  const [offset, setOffset] = useState(0)
  const [addFor, setAddFor] = useState<string | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(today())

  const ref = today()
  const wd = weekdayOf(ref)
  const start = addDays(weekStart(ref), offset * 7)
  const dates = weekDates(start)
  const reviewDoneThisWeek = reviews.some((r) => r.week_start === weekStart(ref))

  const unscheduled = useMemo(() => tasks.filter((t) => !t.completed && !t.scheduled_date), [tasks])

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-8">
      <header className="pt-6 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.22em] text-cyan mb-1.5">
              // week {weekNumber(start)}
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-100 tracking-tight">
              {formatShort(start)} – {formatShort(addDays(start, 6))}
            </h1>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => setOffset((o) => o - 1)} className="btn-ghost px-3">
              ←
            </button>
            <button
              onClick={() => {
                setOffset(0)
                setExpanded(ref)
              }}
              disabled={offset === 0}
              className="btn-ghost px-3 text-xs font-mono tracking-wide"
            >
              NOW
            </button>
            <button onClick={() => setOffset((o) => o + 1)} className="btn-ghost px-3">
              →
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {offset === 0 && wd === 0 && !reviewDoneThisWeek && (
          <motion.button
            initial={{ opacity: 0, y: -8, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto', marginBottom: 20 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setShowReview(true)}
            className="w-full text-left card !bg-cyan/10 border-cyan/30 p-4 hover:!bg-cyan/15 transition-colors overflow-hidden"
          >
            <p className="text-sm font-semibold text-cyan-soft font-mono">// It's Sunday — run your weekly review</p>
            <p className="text-xs text-slate-400 mt-1">
              Quick look at what got done, what slipped, and the 3–5 things that matter next week.
            </p>
          </motion.button>
        )}
      </AnimatePresence>

      <div className="space-y-2.5">
        {dates.map((date) => (
          <DayRow
            key={date}
            date={date}
            isToday={offset === 0 && date === ref}
            expanded={expanded === date}
            onToggle={() => setExpanded((e) => (e === date ? null : date))}
            onAdd={() => setAddFor(date)}
            preferences={preferences}
          />
        ))}
      </div>

      {unscheduled.length > 0 && (
        <div className="mt-6">
          <SectionHeading title={`Not yet scheduled (${unscheduled.length})`} />
          <Card className="!p-2">
            <div className="divide-y divide-ink-800/60">
              <AnimatePresence initial={false}>
                {unscheduled.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </AnimatePresence>
            </div>
          </Card>
        </div>
      )}

      {!reviewDoneThisWeek && wd !== 0 && (
        <div className="text-center py-6">
          <button onClick={() => setShowReview(true)} className="btn-quiet text-xs">
            Run weekly review early
          </button>
        </div>
      )}

      <TaskForm
        open={addFor !== null}
        onClose={() => setAddFor(null)}
        defaults={addFor ? { scheduled_date: addFor } : undefined}
      />
      <AnimatePresence>{showReview && <WeeklyReview onClose={() => setShowReview(false)} />}</AnimatePresence>
    </div>
  )
}

function DayRow({
  date,
  isToday,
  expanded,
  onToggle,
  onAdd,
  preferences,
}: {
  date: string
  isToday: boolean
  expanded: boolean
  onToggle: () => void
  onAdd: () => void
  preferences: Preferences | null
}) {
  const { tasks, commitments, projects } = useStore()
  const wd = weekdayOf(date)

  const blocks = useMemo(
    () => dayTimeline(date, commitments, tasks, projects, preferences),
    [date, commitments, tasks, projects, preferences],
  )
  const dayTasksAll = useMemo(() => tasks.filter((t) => t.scheduled_date === date), [tasks, date])
  const doneCount = dayTasksAll.filter((t) => t.completed).length
  const totalCount = dayTasksAll.length

  return (
    <Card
      className={`!p-0 overflow-hidden transition-shadow ${
        isToday ? 'hud-corners !border-cyan/30 shadow-glow' : ''
      }`}
    >
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className={`text-base font-bold font-mono tracking-wide ${isToday ? 'text-cyan-soft' : 'text-slate-200'}`}>
            {WEEKDAYS_SHORT[wd].toUpperCase()}
          </span>
          <span className="text-xs font-mono text-slate-500 shrink-0">{formatShort(date)}</span>
          {isToday && <span className="chip bg-cyan/15 text-cyan-soft text-[10px] py-0.5 font-mono shrink-0">NOW</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {totalCount > 0 && (
            <span className="mono-num text-xs text-slate-500">
              {doneCount}/{totalCount}
            </span>
          )}
          <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-slate-500 text-xs">
            ▾
          </motion.span>
        </div>
      </button>

      {totalCount > 0 && (
        <div className="px-4 pb-3 -mt-1.5">
          <ProgressBar value={(doneCount / totalCount) * 100} tone={doneCount === totalCount ? 'good' : 'accent'} />
        </div>
      )}

      <div
        className="overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out"
        style={{ maxHeight: expanded ? 2400 : 0, opacity: expanded ? 1 : 0 }}
      >
        <div className="border-t border-ink-800 px-2 py-2">
          {blocks.length === 0 ? (
            <p className="text-xs text-slate-600 px-3 py-3">Nothing planned.</p>
          ) : (
            <div className="divide-y divide-ink-800/60">
              {blocks.map((b) => (
                <TimelineRow key={b.kind === 'commitment' ? `c-${b.commitment!.id}` : b.task!.id} block={b} />
              ))}
            </div>
          )}
          <button onClick={onAdd} className="btn-quiet text-xs mt-1.5 ml-2">
            + add task to this day
          </button>
        </div>
      </div>
    </Card>
  )
}

function TimelineRow({ block }: { block: TimelineBlock }) {
  if (block.kind === 'commitment') {
    const c = block.commitment!
    return (
      <div className="flex items-center gap-3 px-2 py-2.5">
        <span className="mono-num text-xs text-slate-500 w-[4.5rem] shrink-0">{formatMinutesOfDay(block.start)}</span>
        <span className="text-sm text-slate-300">
          {c.kind === 'training' ? '🥊' : c.kind === 'work' ? '💼' : '📝'} {c.label}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 py-0.5">
      <span className="mono-num text-xs text-slate-500 w-[4.5rem] shrink-0 pt-3">
        {block.kind === 'task-overflow' ? '—' : formatMinutesOfDay(block.start)}
      </span>
      <div className="flex-1 min-w-0">
        <TaskRow task={block.task!} showProject={false} />
      </div>
    </div>
  )
}
