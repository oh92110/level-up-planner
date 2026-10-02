import { useCallback, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { DragProvider, DropZone, useDrag } from '../components/DragLayer'
import { DraggableTask } from '../components/DraggableTask'
import { TaskForm } from '../components/TaskForm'
import { MissedTaskPrompt } from '../components/MissedTaskPrompt'
import { WeeklyReview } from './WeeklyReview'
import { useToast } from '../components/Toast'
import { daySchedule, rankTasks, slotForDrop } from '../lib/engine'
import type { DaySegment } from '../lib/engine'
import {
  addDays,
  formatDuration,
  formatMinutesOfDay,
  formatShort,
  fromISO,
  minutesOfDay,
  nowMinutes,
  toHHMM,
  today,
  weekDates,
  weekStart,
  weekdayOf,
} from '../lib/dates'
import { WEEKDAYS_SHORT } from '../lib/types'
import type { Commitment, Preferences, Task } from '../lib/types'

/** Vertical scale for free windows, capped so a 15-hour Saturday stays on screen. */
const PX_PER_MIN = 0.8
const MAX_LANE = 340
const MIN_LANE = 84
const SNAP = 15

function laneMetrics(seg: DaySegment) {
  const dur = Math.max(1, seg.end - seg.start)
  const height = Math.max(MIN_LANE, Math.min(MAX_LANE, dur * PX_PER_MIN))
  return { dur, height, ppm: height / dur }
}

function weekNumber(iso: string): number {
  const d = fromISO(iso)
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const days = Math.floor((d.getTime() - jan1.getTime()) / 86400000)
  return Math.ceil((days + jan1.getDay() + 1) / 7)
}

export function Week() {
  const { tasks, commitments, reviews, preferences, updateTask } = useStore()
  const toast = useToast()
  const [offset, setOffset] = useState(0)
  const [addFor, setAddFor] = useState<string | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(today())

  const ref = today()
  const wd = weekdayOf(ref)
  const start = addDays(weekStart(ref), offset * 7)
  const dates = weekDates(start)
  const reviewDone = reviews.some((r) => r.week_start === weekStart(ref))

  const handleDrop = useCallback(
    async (task: Task, zoneId: string, ratio: number) => {
      if (zoneId === 'backlog') {
        if (!task.scheduled_date && !task.scheduled_time) return
        await updateTask(task.id, { scheduled_date: null, scheduled_time: null })
        toast('Unscheduled')
        return
      }

      const [kind, date, startStr, endStr] = zoneId.split('|')

      if (kind === 'day') {
        if (task.scheduled_date === date && !task.scheduled_time) return
        await updateTask(task.id, { scheduled_date: date, scheduled_time: null })
        toast(`${formatShort(date)} — anytime`, 'success')
        return
      }

      if (kind !== 'win') return

      const winStart = Number(startStr)
      const winEnd = Number(endStr)

      // Where in the lane they let go, snapped and kept inside the window.
      const raw = winStart + ratio * (winEnd - winStart)
      const latest = Math.max(winStart, winEnd - task.duration_min)
      let minute = Math.min(latest, Math.max(winStart, Math.round(raw / SNAP) * SNAP))

      // If that would sit on top of another pinned task, use the first gap that fits.
      const clash = tasks.some(
        (t) =>
          t.id !== task.id &&
          !t.completed &&
          t.scheduled_date === date &&
          t.scheduled_time != null &&
          minutesOfDay(t.scheduled_time) < minute + task.duration_min &&
          minutesOfDay(t.scheduled_time) + t.duration_min > minute,
      )
      if (clash) {
        minute = slotForDrop({ date, windowStart: winStart, task, tasks, commitments, preferences })
      }

      const time = toHHMM(minute)
      if (task.scheduled_date === date && task.scheduled_time === time) return
      await updateTask(task.id, { scheduled_date: date, scheduled_time: time })
      toast(`${formatShort(date)} · ${formatMinutesOfDay(minute)}`, 'success')
    },
    [updateTask, toast, tasks, commitments, preferences],
  )

  return (
    <DragProvider onDrop={handleDrop}>
      <div className="max-w-6xl mx-auto px-4 sm:px-8 pb-16">
        <header className="pt-8 pb-6 flex items-end justify-between gap-4">
          <div>
            <p className="mono-num text-[11px] tracking-[0.2em] text-slate-500 mb-2">WEEK {weekNumber(start)}</p>
            <h1 className="text-[28px] sm:text-[34px] font-semibold text-slate-50 tracking-tight leading-none">
              {formatShort(start)} — {formatShort(addDays(start, 6))}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setOffset((o) => o - 1)} className="btn-quiet px-2.5 py-1.5" aria-label="Previous week">
              ←
            </button>
            <button
              onClick={() => {
                setOffset(0)
                setExpanded(ref)
              }}
              disabled={offset === 0}
              className="btn-quiet px-2.5 py-1.5 text-xs mono-num tracking-wider"
            >
              TODAY
            </button>
            <button onClick={() => setOffset((o) => o + 1)} className="btn-quiet px-2.5 py-1.5" aria-label="Next week">
              →
            </button>
          </div>
        </header>

        <AnimatePresence>
          {offset === 0 && wd === 0 && !reviewDone && (
            <motion.button
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              onClick={() => setShowReview(true)}
              className="w-full overflow-hidden rounded-lg border border-cyan/25 bg-cyan/[0.07] px-4 py-3 text-left
                hover:bg-cyan/[0.12] transition-colors"
            >
              <p className="text-[13px] font-medium text-cyan-soft">Sunday — run your weekly review</p>
            </motion.button>
          )}
        </AnimatePresence>

        <MissedTaskPrompt />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
          <div className="space-y-1.5 min-w-0">
            {dates.map((date) => (
              <DayCard
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

          <Sidebar onAdd={() => setAddFor('')} />
        </div>

        <TaskForm
          open={addFor !== null}
          onClose={() => setAddFor(null)}
          defaults={addFor ? { scheduled_date: addFor } : undefined}
        />
        <AnimatePresence>{showReview && <WeeklyReview onClose={() => setShowReview(false)} />}</AnimatePresence>
      </div>
    </DragProvider>
  )
}

function DayCard({
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
  const [showDone, setShowDone] = useState(false)
  const wd = weekdayOf(date)

  const schedule = useMemo(
    () => daySchedule(date, commitments, tasks, projects, preferences),
    [date, commitments, tasks, projects, preferences],
  )

  const dayTasks = useMemo(() => tasks.filter((t) => t.scheduled_date === date), [tasks, date])
  const open = dayTasks.filter((t) => !t.completed).length
  const done = dayTasks.length - open
  const freeMin = schedule.segments
    .filter((s) => s.kind === 'free')
    .reduce((sum, s) => sum + (s.end - s.start), 0)

  const label = [
    ...schedule.segments.filter((s) => s.kind === 'commitment').map((s) => s.commitment!.label),
    ...schedule.anytime.map((c) => c.label),
  ]

  return (
    <div
      className={`rounded-lg border bg-ink-900/60 transition-colors ${
        isToday ? 'border-cyan/40' : 'border-ink-800'
      }`}
    >
      <DropZone id={`day|${date}`} className="rounded-lg">
        <button onClick={onToggle} className="w-full flex items-center gap-4 px-3.5 py-3 text-left">
          <div className="flex items-baseline gap-2 w-[5.5rem] shrink-0">
            <span className={`mono-num text-[10px] tracking-widest ${isToday ? 'text-cyan' : 'text-slate-600'}`}>
              {WEEKDAYS_SHORT[wd].toUpperCase()}
            </span>
            <span className={`text-lg font-semibold leading-none ${isToday ? 'text-cyan-soft' : 'text-slate-300'}`}>
              {fromISO(date).getDate()}
            </span>
          </div>

          <p className="flex-1 min-w-0 truncate text-[13px] text-slate-500">
            {label.length ? label.join(' · ') : 'Nothing scheduled'}
          </p>

          <div className="flex items-center gap-3 shrink-0">
            {open > 0 && <span className="mono-num text-[11px] text-slate-400">{open} open</span>}
            {done > 0 && <span className="mono-num text-[11px] text-lo/70">{done} done</span>}
            {freeMin > 0 && <span className="mono-num text-[11px] text-slate-600">{formatDuration(freeMin)}</span>}
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.18 }}
              className="text-slate-600 text-[10px]"
            >
              ▾
            </motion.span>
          </div>
        </button>
      </DropZone>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-t border-ink-800 p-3 space-y-1">
              {schedule.segments.map((seg) =>
                seg.kind === 'commitment' ? (
                  <CommitmentBar key={`c${seg.commitment!.id}`} seg={seg} isToday={isToday} />
                ) : (
                  <Lane key={`f${seg.start}`} date={date} seg={seg} isToday={isToday} />
                ),
              )}

              {schedule.segments.length === 0 && (
                <p className="py-3 text-[12px] text-slate-600">Your commitments fill this day.</p>
              )}

              {schedule.overflow.length > 0 && (
                <div className="space-y-1 rounded-md border border-med/25 bg-med/[0.06] p-2">
                  <p className="mono-num text-[10px] uppercase tracking-wider text-med">Doesn't fit today</p>
                  {schedule.overflow.map((t) => (
                    <DraggableTask key={t.id} task={t} tone="overflow" showProject={false} />
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1 pt-1">
                <button onClick={onAdd} className="btn-quiet text-[12px] px-2 py-1">
                  + Task
                </button>
                {schedule.done.length > 0 && (
                  <button onClick={() => setShowDone((s) => !s)} className="btn-quiet text-[12px] px-2 py-1">
                    {showDone ? 'Hide' : 'Show'} {schedule.done.length} done
                  </button>
                )}
              </div>

              {showDone && (
                <div className="space-y-1">
                  {schedule.done.map((t) => (
                    <DraggableTask key={t.id} task={t} draggable={false} showProject={false} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CommitmentBar({ seg, isToday }: { seg: DaySegment; isToday: boolean }) {
  const c = seg.commitment as Commitment
  const now = nowMinutes()
  const live = isToday && now >= seg.start && now < seg.end
  return (
    <div className="flex items-center gap-3 rounded-md bg-ink-850/60 px-2.5 py-2">
      <span className="mono-num text-[11px] text-slate-600 w-[6.5rem] shrink-0">
        {formatMinutesOfDay(seg.start)}–{formatMinutesOfDay(seg.end)}
      </span>
      <span className="flex-1 min-w-0 truncate text-[13px] text-slate-500">{c.label}</span>
      {live && <span className="mono-num text-[10px] text-cyan shrink-0">NOW</span>}
    </div>
  )
}

function Lane({ date, seg, isToday }: { date: string; seg: DaySegment; isToday: boolean }) {
  const { dragging } = useDrag()
  const { dur, height, ppm } = laneMetrics(seg)
  const now = nowMinutes()
  const liveAt = isToday && now >= seg.start && now < seg.end ? (now - seg.start) * ppm : null

  const tickStep = ppm * 60 < 26 ? 120 : 60
  const ticks: number[] = []
  for (let m = Math.ceil(seg.start / tickStep) * tickStep; m < seg.end; m += tickStep) ticks.push(m)

  const used = seg.tasks.reduce((s, p) => s + p.task.duration_min, 0)
  const left = Math.max(0, dur - used)

  return (
    <DropZone
      id={`win|${date}|${seg.start}|${seg.end}`}
      className="drop-lane relative rounded-md border border-ink-800/80 bg-ink-950/50"
      style={{ height }}
    >
      {ticks.map((m) => (
        <div key={m} className="absolute inset-x-0 border-t border-ink-800/60" style={{ top: (m - seg.start) * ppm }}>
          <span className="mono-num absolute left-1.5 -top-[7px] bg-ink-950/50 pr-1 text-[9px] text-slate-700">
            {formatMinutesOfDay(m)}
          </span>
        </div>
      ))}

      <span className="mono-num absolute left-1.5 top-1 text-[9px] text-slate-600">
        {formatMinutesOfDay(seg.start)}
      </span>
      {left > 0 && !dragging && (
        <span className="mono-num absolute right-1.5 top-1 text-[9px] text-slate-700">
          {formatDuration(left)} free
        </span>
      )}
      {dragging && (
        <span className="mono-num absolute right-1.5 top-1 text-[9px] text-cyan/80">drop to set a time</span>
      )}

      {liveAt != null && (
        <div className="absolute inset-x-0 z-20 pointer-events-none" style={{ top: liveAt }}>
          <div className="relative h-px bg-cyan/70">
            <span className="absolute -left-[3px] -top-[3px] h-[7px] w-[7px] rounded-full bg-cyan" />
          </div>
        </div>
      )}

      <div className="absolute inset-y-0 left-12 right-1.5">
        {seg.tasks.map((p) => (
          <div
            key={p.task.id}
            className="absolute inset-x-0"
            style={{ top: (p.start - seg.start) * ppm, height: Math.max(26, p.task.duration_min * ppm) }}
          >
            <DraggableTask task={p.task} at={p.start} pinned={p.pinned} showProject={false} compact />
          </div>
        ))}
      </div>
    </DropZone>
  )
}

function Sidebar({ onAdd }: { onAdd: () => void }) {
  const { tasks, projects, preferences } = useStore()
  const { dragging } = useDrag()
  const [showCompleted, setShowCompleted] = useState(false)
  const ref = today()

  const side = useMemo(() => {
    const open = tasks.filter((t) => !t.completed && !t.scheduled_date)
    return rankTasks(open, { ref, projects, preferences }).map((s) => s.task)
  }, [tasks, ref, projects, preferences])

  const completed = useMemo(
    () => [...tasks.filter((t) => t.completed)].sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
    [tasks],
  )

  return (
    <div className="lg:sticky lg:top-6">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-[13px] font-medium text-slate-300">
          Side tasks <span className="mono-num text-slate-600">{side.length}</span>
        </h2>
        <button onClick={onAdd} className="btn-quiet text-[12px] px-2 py-1">
          + Add
        </button>
      </div>

      <DropZone id="backlog" className="drop-lane rounded-lg border border-ink-800 bg-ink-900/40 p-1.5 min-h-[7rem]">
        {side.length === 0 ? (
          <p className="px-1.5 py-6 text-center text-[12px] text-slate-600">
            {dragging ? 'Drop here to unschedule' : 'Nothing waiting.'}
          </p>
        ) : (
          <div className="space-y-1">
            {side.map((t) => (
              <DraggableTask key={t.id} task={t} />
            ))}
          </div>
        )}
      </DropZone>

      <p className="mt-2.5 px-0.5 text-[11px] leading-relaxed text-slate-600">
        Drag a task onto a time slot to schedule it, onto a day row for “anytime”, or back here to unschedule.
      </p>

      {completed.length > 0 && (
        <div className="mt-5">
          <button onClick={() => setShowCompleted((s) => !s)} className="btn-quiet text-[12px] px-2 py-1">
            {showCompleted ? 'Hide' : 'Show'} completed ({completed.length})
          </button>
          {showCompleted && (
            <div className="space-y-1 mt-2">
              {completed.slice(0, 40).map((t) => (
                <DraggableTask key={t.id} task={t} draggable={false} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
