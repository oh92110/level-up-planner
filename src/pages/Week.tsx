import { useCallback, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { DragProvider, DropZone, useDrag } from '../components/DragLayer'
import { DraggableTask } from '../components/DraggableTask'
import { TaskForm } from '../components/TaskForm'
import { MissedTaskPrompt } from '../components/MissedTaskPrompt'
import { ScheduleDialog } from '../components/ScheduleDialog'
import { WeeklyReview } from './WeeklyReview'
import { useToast } from '../components/Toast'
import { daySchedule, rankTasks } from '../lib/engine'
import type { DaySchedule, PlacedTask } from '../lib/engine'
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

/** Every hour, 6 AM through 11 PM. */
const DAY_START = 6 * 60
const DAY_END = 23 * 60
const HOUR_H = 40
const PPM = HOUR_H / 60

const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START + i * 60)

/** Commitments at least this long fold into a compact band instead of eating the day. */
const COLLAPSE_MIN = 3 * 60
const COLLAPSED_H = 44

const BAND_ROW = 28

interface Span {
  start: number
  end: number
  kind: 'commitment' | 'free'
  commitment?: Commitment
  collapsed: boolean
  /** Tasks falling inside a folded band — listed in it rather than positioned. */
  inner: PlacedTask[]
  top: number
  height: number
}

/**
 * The day as stacked spans. Long commitments collapse to a fixed band, so the
 * minute-to-pixel scale is piecewise — everything positional goes through
 * minuteToY / yToMinute rather than multiplying by PPM.
 *
 * Tasks that fall inside a folded band are listed inside it, so folding never
 * hides anything.
 */
function buildLayout(schedule: DaySchedule, placed: PlacedTask[]): { spans: Span[]; total: number } {
  const timed = schedule.segments
    .filter((s) => s.kind === 'commitment')
    .map((s) => ({
      start: Math.max(DAY_START, s.start),
      end: Math.min(DAY_END, s.end),
      commitment: s.commitment!,
    }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start)

  const raw: Omit<Span, 'top' | 'height'>[] = []
  let cursor = DAY_START
  for (const c of timed) {
    if (c.start > cursor) raw.push({ start: cursor, end: c.start, kind: 'free', collapsed: false, inner: [] })
    if (c.end <= cursor) continue
    const start = Math.max(c.start, cursor)
    const collapsed = c.end - start >= COLLAPSE_MIN
    raw.push({
      start,
      end: c.end,
      kind: 'commitment',
      commitment: c.commitment,
      collapsed,
      inner: collapsed ? placed.filter((p) => p.start >= start && p.start < c.end) : [],
    })
    cursor = c.end
  }
  if (cursor < DAY_END) raw.push({ start: cursor, end: DAY_END, kind: 'free', collapsed: false, inner: [] })

  const spans: Span[] = []
  let top = 0
  for (const r of raw) {
    const height = r.collapsed ? COLLAPSED_H + r.inner.length * BAND_ROW : (r.end - r.start) * PPM
    spans.push({ ...r, top, height })
    top += height
  }
  return { spans, total: top }
}

function minuteToY(spans: Span[], minute: number): number {
  const m = Math.max(DAY_START, Math.min(DAY_END, minute))
  for (const s of spans) {
    if (m >= s.start && m < s.end) return s.top + ((m - s.start) / (s.end - s.start)) * s.height
  }
  const last = spans[spans.length - 1]
  return last ? last.top + last.height : 0
}

function yToMinute(spans: Span[], px: number): number {
  for (const s of spans) {
    if (px >= s.top && px < s.top + s.height) {
      const f = s.height > 0 ? (px - s.top) / s.height : 0
      return s.start + f * (s.end - s.start)
    }
  }
  return px <= 0 ? DAY_START : DAY_END
}

const allPlaced = (schedule: DaySchedule): PlacedTask[] => schedule.segments.flatMap((s) => s.tasks)

function weekNumber(iso: string): number {
  const d = fromISO(iso)
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const days = Math.floor((d.getTime() - jan1.getTime()) / 86400000)
  return Math.ceil((days + jan1.getDay() + 1) / 7)
}

export function Week() {
  const { tasks, commitments, projects, reviews, preferences, updateTask } = useStore()
  const toast = useToast()
  const [offset, setOffset] = useState(0)
  const [addFor, setAddFor] = useState<string | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(today())
  const [pending, setPending] = useState<{ task: Task; date: string; start: string } | null>(null)

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

      const [kind, date] = zoneId.split('|')
      if (kind !== 'day' && kind !== 'track') return

      // Where the drop landed, used only to preselect the start time — the
      // actual start and finish are confirmed in the dialog.
      const schedule = daySchedule(date, commitments, tasks, projects, preferences)
      const { spans, total } = buildLayout(schedule, allPlaced(schedule))
      const dur = task.duration_min
      const lastHour = Math.floor((DAY_END - dur) / 60) * 60
      const snap = (m: number) => Math.max(DAY_START, Math.min(lastHour, Math.round(m / 60) * 60))

      const taken = tasks
        .filter((t) => t.id !== task.id && !t.completed && t.scheduled_date === date && t.scheduled_time != null)
        .map((t) => ({ start: minutesOfDay(t.scheduled_time!), end: minutesOfDay(t.scheduled_time!) + t.duration_min }))
      const isFree = (m: number) => !taken.some((o) => o.start < m + dur && o.end > m)

      // Dropping on the day row has no vertical meaning, so start from the first free hour.
      let minute = kind === 'track' ? snap(yToMinute(spans, ratio * total)) : DAY_START
      if (!isFree(minute)) {
        for (let step = 60; step <= DAY_END - DAY_START; step += 60) {
          const up = minute + step
          const down = minute - step
          if (up <= lastHour && isFree(up)) {
            minute = up
            break
          }
          if (down >= DAY_START && isFree(down)) {
            minute = down
            break
          }
        }
      }

      setPending({ task, date, start: toHHMM(minute) })
    },
    [tasks, commitments, projects, preferences, updateTask, toast],
  )

  const confirmSchedule = useCallback(
    async (startTime: string, durationMin: number) => {
      if (!pending) return
      await updateTask(pending.task.id, {
        scheduled_date: pending.date,
        scheduled_time: startTime,
        duration_min: durationMin,
      })
      toast(
        `${formatShort(pending.date)} · ${formatMinutesOfDay(minutesOfDay(startTime))}–${formatMinutesOfDay(
          minutesOfDay(startTime) + durationMin,
        )}`,
        'success',
      )
    },
    [pending, updateTask, toast],
  )

  return (
    <DragProvider onDrop={handleDrop}>
      <div className="px-5 sm:px-8 pb-16">
        <header className="flex flex-wrap items-end justify-between gap-4 pt-8 pb-6">
          <div>
            <p className="mono-num text-[11px] tracking-[0.24em] text-slate-500">WEEK {weekNumber(start)}</p>
            <h1 className="mt-2 text-[30px] sm:text-[38px] font-semibold leading-none tracking-tight text-slate-50">
              {formatShort(start)} — {formatShort(addDays(start, 6))}
            </h1>
          </div>
          <div className="flex items-center gap-0.5 rounded-xl border border-ink-800 bg-ink-900/60 p-1">
            <button onClick={() => setOffset((o) => o - 1)} className="btn-quiet px-3 py-1.5" aria-label="Previous week">
              ←
            </button>
            <button
              onClick={() => {
                setOffset(0)
                setExpanded(ref)
              }}
              disabled={offset === 0}
              className="btn-quiet mono-num px-3 py-1.5 text-[11px] tracking-widest"
            >
              TODAY
            </button>
            <button onClick={() => setOffset((o) => o + 1)} className="btn-quiet px-3 py-1.5" aria-label="Next week">
              →
            </button>
          </div>
        </header>

        <AnimatePresence>
          {offset === 0 && wd === 0 && !reviewDone && (
            <motion.button
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 18 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              onClick={() => setShowReview(true)}
              className="w-full overflow-hidden rounded-xl border border-cyan/20 bg-cyan/[0.06] px-5 py-3.5 text-left
                text-sm font-medium text-cyan-soft transition-colors hover:bg-cyan/[0.11]"
            >
              Sunday — run your weekly review
            </motion.button>
          )}
        </AnimatePresence>

        <MissedTaskPrompt />

        <div className="flex flex-col items-start gap-6 xl:flex-row">
          <div className="w-full min-w-0 flex-1 space-y-2">
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
        <ScheduleDialog
          open={pending !== null}
          task={pending?.task ?? null}
          date={pending?.date ?? today()}
          defaultStart={pending?.start ?? '18:00'}
          dayStart={DAY_START}
          dayEnd={DAY_END}
          onClose={() => setPending(null)}
          onConfirm={confirmSchedule}
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
  const wd = weekdayOf(date)

  const schedule = useMemo(
    () => daySchedule(date, commitments, tasks, projects, preferences),
    [date, commitments, tasks, projects, preferences],
  )

  const dayTasks = useMemo(() => tasks.filter((t) => t.scheduled_date === date), [tasks, date])
  const open = dayTasks.filter((t) => !t.completed).length
  const done = dayTasks.length - open

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-ink-900/50 transition-colors ${
        isToday ? 'border-cyan/35' : 'border-ink-800'
      }`}
    >
      <DropZone id={`day|${date}`} className="drop-lane">
        <button onClick={onToggle} className="flex w-full items-center gap-5 px-5 py-4 text-left">
          <div className="flex w-[4.5rem] shrink-0 items-baseline gap-2.5">
            <span className={`mono-num text-[11px] tracking-widest ${isToday ? 'text-cyan' : 'text-slate-600'}`}>
              {WEEKDAYS_SHORT[wd].toUpperCase()}
            </span>
            <span
              className={`text-[26px] font-semibold leading-none tracking-tight ${
                isToday ? 'text-cyan-soft' : 'text-slate-200'
              }`}
            >
              {fromISO(date).getDate()}
            </span>
          </div>

          <span className="flex-1" />

          <div className="flex shrink-0 items-center gap-4">
            {open > 0 && <span className="mono-num text-xs text-slate-300">{open} open</span>}
            {done > 0 && <span className="mono-num text-xs text-lo/70">{done} done</span>}
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.18 }}
              className="text-xs text-slate-600"
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
            transition={{ duration: 0.22 }}
            style={{ overflow: 'hidden' }}
          >
            {schedule.anytime.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-5 pt-3">
                {schedule.anytime.map((c) => (
                  <span key={c.id} className="rounded-md bg-ink-850 px-2.5 py-1 text-[12px] text-slate-400">
                    {c.label}
                  </span>
                ))}
              </div>
            )}

            <DayTrack date={date} isToday={isToday} schedule={schedule} />

            {schedule.overflow.length > 0 && (
              <div className="mx-5 mb-4 space-y-1.5 rounded-lg border border-med/20 bg-med/[0.05] p-2.5">
                <p className="mono-num px-0.5 pb-0.5 text-[10px] uppercase tracking-wider text-med">
                  No room left today
                </p>
                {schedule.overflow.map((t) => (
                  <DraggableTask key={t.id} task={t} tone="overflow" showProject={false} />
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 px-5 pb-5">
              <button onClick={onAdd} className="btn-quiet px-2.5 py-1.5 text-[13px]">
                + Task
              </button>
              {schedule.done.length > 0 && (
                <span className="mono-num text-[11px] text-slate-600">{schedule.done.length} done</span>
              )}
            </div>

            {schedule.done.length > 0 && (
              <div className="mx-5 mb-5 space-y-1.5 opacity-50">
                {schedule.done.map((t) => (
                  <DraggableTask key={t.id} task={t} draggable={false} showProject={false} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** 6 AM – 11 PM, with long commitments folded. Free time is empty space, not a box. */
function DayTrack({ date, isToday, schedule }: { date: string; isToday: boolean; schedule: DaySchedule }) {
  const { dragging } = useDrag()
  const now = nowMinutes()
  const showNow = isToday && now >= DAY_START && now <= DAY_END

  const placed = useMemo(() => allPlaced(schedule), [schedule])
  const { spans, total } = useMemo(() => buildLayout(schedule, placed), [schedule, placed])

  // Anything listed inside a folded band must not also be positioned on the axis.
  const banded = new Set(spans.flatMap((s) => s.inner.map((p) => p.task.id)))
  const onAxis = placed.filter((p) => !banded.has(p.task.id))

  const Y = (m: number) => minuteToY(spans, m)
  /** Hours hidden inside a folded band would stack on top of each other. */
  const visibleHours = HOURS.filter((m) => {
    const s = spans.find((sp) => m >= sp.start && m < sp.end)
    return !s || !s.collapsed || m === s.start
  })

  return (
    <div className="relative px-5 pt-1 pb-5">
      {visibleHours.map((m) => (
        <div key={m} className="pointer-events-none absolute left-5" style={{ top: Y(m) }}>
          <span className="mono-num absolute left-0 -top-[8px] w-12 text-right text-[11px] text-slate-600">
            {formatMinutesOfDay(m)}
          </span>
          <span className="absolute left-[3.5rem] h-px w-2 bg-ink-700" />
        </div>
      ))}

      <DropZone
        id={`track|${date}`}
        className={`drop-track relative ml-[4.75rem] rounded-lg transition-colors ${dragging ? 'bg-ink-800/25' : ''}`}
        style={{ height: total }}
      >
        {spans
          .filter((s) => s.kind === 'commitment')
          .map((s) =>
            s.collapsed ? (
              <div
                key={s.commitment!.id}
                className="absolute inset-x-0 overflow-hidden rounded-lg border border-ink-800 bg-ink-850/50"
                style={{ top: s.top, height: s.height }}
              >
                <div className="flex items-center gap-3 px-3.5" style={{ height: COLLAPSED_H }}>
                  <span className="truncate text-[13px] font-medium text-slate-400">{s.commitment!.label}</span>
                  <span className="mono-num ml-auto shrink-0 text-[11px] text-slate-600">
                    {formatMinutesOfDay(s.start)} – {formatMinutesOfDay(s.end)} · {formatDuration(s.end - s.start)}
                  </span>
                </div>
                {s.inner.length > 0 && (
                  <div className="space-y-0.5 px-1.5 pb-1.5">
                    {s.inner.map((p) => (
                      <div key={p.task.id} style={{ height: BAND_ROW - 4 }}>
                        <DraggableTask task={p.task} at={p.start} pinned={p.pinned} showProject={false} dense />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div
                key={s.commitment!.id}
                className="absolute inset-x-0 overflow-hidden rounded-lg bg-ink-850/70 px-3.5 py-2.5"
                style={{ top: s.top, height: Math.max(28, s.height) }}
              >
                <p className="truncate text-[13px] font-medium leading-tight text-slate-400">{s.commitment!.label}</p>
                <p className="mono-num mt-1 text-[11px] text-slate-600">
                  {formatMinutesOfDay(s.start)} – {formatMinutesOfDay(s.end)}
                </p>
              </div>
            ),
          )}

        {onAxis.map((p) => (
          <div
            key={p.task.id}
            className="absolute inset-x-0 z-10"
            style={{ top: Y(p.start), height: Math.max(24, Y(p.start + p.task.duration_min) - Y(p.start)) }}
          >
            <DraggableTask task={p.task} pinned={p.pinned} showProject={false} dense />
          </div>
        ))}

        {showNow && (
          <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: Y(now) }}>
            <div className="relative h-px bg-cyan">
              <span className="absolute -left-1 -top-[3px] h-[7px] w-[7px] rounded-full bg-cyan" />
            </div>
          </div>
        )}
      </DropZone>
    </div>
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
    <aside className="w-full xl:sticky xl:top-6 xl:w-[300px] xl:shrink-0">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-300">
          Side tasks <span className="mono-num ml-1 text-slate-600">{side.length}</span>
        </h2>
        <button onClick={onAdd} className="btn-quiet px-2.5 py-1 text-[13px]">
          + Add
        </button>
      </div>

      <DropZone id="backlog" className="drop-lane min-h-[7rem] rounded-xl border border-ink-800 bg-ink-900/50 p-2">
        {side.length === 0 ? (
          <p className="px-2 py-8 text-center text-[13px] text-slate-600">
            {dragging ? 'Drop to unschedule' : 'Nothing waiting.'}
          </p>
        ) : (
          <div className="space-y-1.5">
            {side.map((t) => (
              <DraggableTask key={t.id} task={t} />
            ))}
          </div>
        )}
      </DropZone>

      <p className="mt-3 px-0.5 text-xs leading-relaxed text-slate-600">
        Drag onto the hours to set a time, onto a day row for “anytime”, or back here to unschedule.
      </p>

      {completed.length > 0 && (
        <div className="mt-5">
          <button onClick={() => setShowCompleted((s) => !s)} className="btn-quiet px-2.5 py-1 text-[13px]">
            {showCompleted ? 'Hide' : 'Show'} completed ({completed.length})
          </button>
          {showCompleted && (
            <div className="mt-2 space-y-1.5">
              {completed.slice(0, 40).map((t) => (
                <DraggableTask key={t.id} task={t} draggable={false} />
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
