import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { Card, Empty, ProgressBar, SectionHeading } from '../components/ui'
import { DraggableTask } from '../components/DraggableTask'
import { TaskForm } from '../components/TaskForm'
import { WhatNow } from '../components/WhatNow'
import { MissedTaskPrompt } from '../components/MissedTaskPrompt'
import { WeeklyReview } from './WeeklyReview'
import { useToast } from '../components/Toast'
import { useDropZones } from '../lib/useDropZones'
import { dayTimeline, rankTasks } from '../lib/engine'
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
import type { Preferences, Task } from '../lib/types'

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 6 AM .. 11 PM

function weekNumber(iso: string): number {
  const d = fromISO(iso)
  const start = new Date(d.getFullYear(), 0, 1)
  const days = Math.floor((d.getTime() - start.getTime()) / 86400000)
  return Math.ceil((days + start.getDay() + 1) / 7)
}

export function Week() {
  const { reviews, preferences, updateTask } = useStore()
  const toast = useToast()
  const [offset, setOffset] = useState(0)
  const [addFor, setAddFor] = useState<string | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(today())
  const { register, hitTest } = useDropZones()

  const ref = today()
  const wd = weekdayOf(ref)
  const start = addDays(weekStart(ref), offset * 7)
  const dates = weekDates(start)
  const reviewDoneThisWeek = reviews.some((r) => r.week_start === weekStart(ref))

  async function handleDropAt(task: Task, point: { x: number; y: number }) {
    const id = hitTest(point)
    if (!id) return

    if (id === 'backlog') {
      if (!task.scheduled_date && !task.scheduled_time) return
      await updateTask(task.id, { scheduled_date: null, scheduled_time: null })
      toast('Moved back to side tasks')
      return
    }

    const [date, hourStr] = id.split('|')
    const scheduled_time = hourStr ? `${hourStr.padStart(2, '0')}:00` : null
    if (task.scheduled_date === date && (task.scheduled_time ?? null) === scheduled_time) return

    await updateTask(task.id, { scheduled_date: date, scheduled_time })
    toast(
      hourStr ? `Moved to ${formatShort(date)} · ${formatMinutesOfDay(Number(hourStr) * 60)}` : `Moved to ${formatShort(date)}`,
      'success',
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-8">
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

      <div className="mb-5">
        <WhatNow />
      </div>

      <MissedTaskPrompt />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
        <div className="space-y-2.5 min-w-0">
          {dates.map((date) => (
            <DayRow
              key={date}
              date={date}
              isToday={offset === 0 && date === ref}
              expanded={expanded === date}
              onToggle={() => setExpanded((e) => (e === date ? null : date))}
              onAdd={() => setAddFor(date)}
              preferences={preferences}
              register={register}
              onDropAt={handleDropAt}
            />
          ))}
        </div>

        <Sidebar register={register} onDropAt={handleDropAt} onAdd={() => setAddFor('')} />
      </div>

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
  register,
  onDropAt,
}: {
  date: string
  isToday: boolean
  expanded: boolean
  onToggle: () => void
  onAdd: () => void
  preferences: Preferences | null
  register: (id: string) => (el: HTMLElement | null) => void
  onDropAt: (task: Task, point: { x: number; y: number }) => void
}) {
  const { tasks, commitments, projects } = useStore()
  const wd = weekdayOf(date)

  const blocks = useMemo(
    () => (expanded ? dayTimeline(date, commitments, tasks, projects, preferences) : []),
    [expanded, date, commitments, tasks, projects, preferences],
  )
  const dayTasksAll = useMemo(() => tasks.filter((t) => t.scheduled_date === date), [tasks, date])
  const doneCount = dayTasksAll.filter((t) => t.completed).length
  const totalCount = dayTasksAll.length

  const busyHours = useMemo(() => {
    const set = new Set<number>()
    for (const b of blocks) {
      if (b.kind !== 'commitment') continue
      for (let h = Math.floor(b.start / 60); h < Math.ceil(b.end / 60); h++) set.add(h)
    }
    return set
  }, [blocks])

  const byHour = useMemo(() => {
    const map = new Map<number, TimelineBlock[]>()
    for (const h of HOURS) map.set(h, [])
    const overflow: TimelineBlock[] = []
    for (const b of blocks) {
      const h = Math.floor(b.start / 60)
      if (b.kind === 'task-overflow' || !map.has(h)) overflow.push(b)
      else map.get(h)!.push(b)
    }
    return { map, overflow }
  }, [blocks])

  return (
    <Card
      className={`!p-0 overflow-hidden transition-shadow ${
        isToday ? 'hud-corners !border-cyan/30 shadow-glow' : ''
      }`}
    >
      <div ref={register(date)}>
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
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="border-t border-ink-800">
              {HOURS.map((h) => {
                const items = byHour.map.get(h) ?? []
                return (
                  <div
                    key={h}
                    ref={register(`${date}|${h}`)}
                    className={`flex items-start gap-2 px-3 py-1.5 border-b border-ink-800/40 min-h-[2.75rem] ${
                      busyHours.has(h) && items.length === 0 ? 'bg-ink-800/30' : ''
                    }`}
                  >
                    <span className="mono-num text-[11px] text-slate-600 w-12 shrink-0 pt-1.5">
                      {formatMinutesOfDay(h * 60)}
                    </span>
                    <div className="flex-1 min-w-0 space-y-1 py-0.5">
                      {items.map((b) =>
                        b.kind === 'commitment' ? (
                          <div key={`c-${b.commitment!.id}`} className="flex items-center gap-2 text-xs text-slate-400 px-1 py-1.5">
                            {b.commitment!.kind === 'training' ? '🥊' : b.commitment!.kind === 'work' ? '💼' : '📝'}{' '}
                            {b.commitment!.label}
                          </div>
                        ) : (
                          <DraggableTask
                            key={b.task!.id}
                            task={b.task!}
                            showProject={false}
                            timeTone={b.kind === 'task-pinned' ? 'pinned' : b.kind === 'task-done' ? 'done' : 'planned'}
                            onDropAt={(point) => onDropAt(b.task!, point)}
                          />
                        ),
                      )}
                    </div>
                  </div>
                )
              })}

              {byHour.overflow.length > 0 && (
                <div className="px-3 py-2 space-y-1.5 bg-med/5 border-t border-med/20">
                  <p className="text-[10px] font-mono uppercase tracking-wide text-med px-1">no time left today</p>
                  {byHour.overflow.map((b) => (
                    <DraggableTask
                      key={b.task!.id}
                      task={b.task!}
                      showProject={false}
                      timeTone="overflow"
                      onDropAt={(point) => onDropAt(b.task!, point)}
                    />
                  ))}
                </div>
              )}

              <button onClick={onAdd} className="btn-quiet text-xs m-2">
                + add task to this day
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

function Sidebar({
  register,
  onDropAt,
  onAdd,
}: {
  register: (id: string) => (el: HTMLElement | null) => void
  onDropAt: (task: Task, point: { x: number; y: number }) => void
  onAdd: () => void
}) {
  const { tasks, projects, preferences } = useStore()
  const [showCompleted, setShowCompleted] = useState(false)
  const ref = today()

  const sideTasks = useMemo(() => {
    const open = tasks.filter((t) => !t.completed && !t.scheduled_date)
    return rankTasks(open, { ref, projects, preferences }).map((s) => s.task)
  }, [tasks, ref, projects, preferences])

  const completed = useMemo(
    () => [...tasks.filter((t) => t.completed)].sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
    [tasks],
  )

  return (
    <div ref={register('backlog')} className="lg:sticky lg:top-6 space-y-3">
      <SectionHeading
        title={`Side tasks (${sideTasks.length})`}
        action={
          <button onClick={onAdd} className="btn-quiet text-xs px-2 py-1">
            + Add
          </button>
        }
      />

      {sideTasks.length === 0 ? (
        <Card>
          <Empty icon="📋" text="Nothing waiting. Drag a task back here to unschedule it." />
        </Card>
      ) : (
        <div className="space-y-1.5">
          {sideTasks.map((t) => (
            <DraggableTask key={t.id} task={t} onDropAt={(point) => onDropAt(t, point)} />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div className="pt-2">
          <button onClick={() => setShowCompleted((s) => !s)} className="btn-quiet text-xs px-2 py-1 font-mono">
            {showCompleted ? '▾' : '▸'} completed ({completed.length})
          </button>
          <div
            className="overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out"
            style={{ maxHeight: showCompleted ? 4000 : 0, opacity: showCompleted ? 1 : 0 }}
          >
            <div className="space-y-1 mt-2">
              {completed.slice(0, 40).map((t) => (
                <DraggableTask key={t.id} task={t} draggable={false} onDropAt={() => {}} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
