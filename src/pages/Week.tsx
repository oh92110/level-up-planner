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
import { rankTasks } from '../lib/engine'
import {
  addDays,
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
import type { Task } from '../lib/types'

/** One block per hour, 6 AM through 11 PM. */
const DAY_START = 6 * 60
const DAY_END = 23 * 60
const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START + i * 60)

function weekNumber(iso: string): number {
  const d = fromISO(iso)
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const days = Math.floor((d.getTime() - jan1.getTime()) / 86400000)
  return Math.ceil((days + jan1.getDay() + 1) / 7)
}

export function Week() {
  const { tasks, reviews, updateTask } = useStore()
  const toast = useToast()
  const [offset, setOffset] = useState(0)
  const [addFor, setAddFor] = useState<{ date: string; time?: string } | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(today())
  const [pending, setPending] = useState<{ task: Task; date: string; start: string } | null>(null)

  const ref = today()
  const wd = weekdayOf(ref)
  const start = addDays(weekStart(ref), offset * 7)
  const dates = weekDates(start)
  const reviewDone = reviews.some((r) => r.week_start === weekStart(ref))

  /** Hours already taken by a task, so a drop doesn't land on top of one. */
  const firstFreeHour = useCallback(
    (date: string, task: Task, from: number) => {
      const taken = tasks
        .filter((t) => t.id !== task.id && !t.completed && t.scheduled_date === date && t.scheduled_time != null)
        .map((t) => ({ s: minutesOfDay(t.scheduled_time!), e: minutesOfDay(t.scheduled_time!) + t.duration_min }))
      const free = (m: number) => !taken.some((o) => o.s < m + task.duration_min && o.e > m)
      if (free(from)) return from
      for (let h = DAY_START; h < DAY_END; h += 60) if (free(h)) return h
      return from
    },
    [tasks],
  )

  const handleDrop = useCallback(
    async (task: Task, zoneId: string) => {
      if (zoneId === 'backlog') {
        if (!task.scheduled_date && !task.scheduled_time) return
        await updateTask(task.id, { scheduled_date: null, scheduled_time: null })
        toast('Unscheduled')
        return
      }

      const [kind, date, hourStr] = zoneId.split('|')
      if (kind !== 'hour' && kind !== 'day') return

      // Dropping on an hour block starts there; the day row has no hour, so
      // fall back to the first free one. Either way the dialog confirms it.
      const from = kind === 'hour' ? Number(hourStr) : DAY_START
      setPending({ task, date, start: toHHMM(firstFreeHour(date, task, from)) })
    },
    [updateTask, toast, firstFreeHour],
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
                onAddAt={(time) => setAddFor({ date, time })}
              />
            ))}
          </div>

          <Sidebar onAdd={() => setAddFor({ date: '' })} />
        </div>

        <TaskForm
          open={addFor !== null}
          onClose={() => setAddFor(null)}
          defaults={
            addFor?.date
              ? { scheduled_date: addFor.date, ...(addFor.time ? { scheduled_time: addFor.time } : {}) }
              : undefined
          }
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

interface TimedCommitment {
  id: string
  label: string
  start: number
  end: number
}

function DayCard({
  date,
  isToday,
  expanded,
  onToggle,
  onAddAt,
}: {
  date: string
  isToday: boolean
  expanded: boolean
  onToggle: () => void
  onAddAt: (time?: string) => void
}) {
  const { tasks, commitments } = useStore()
  const wd = weekdayOf(date)

  const dayCommitments = useMemo(() => commitments.filter((c) => c.weekday === wd && c.active), [commitments, wd])
  const timed = useMemo<TimedCommitment[]>(
    () =>
      dayCommitments
        .filter((c) => c.start_time && c.end_time)
        .map((c) => ({
          id: c.id,
          label: c.label,
          start: minutesOfDay(c.start_time!),
          end: minutesOfDay(c.end_time!),
        }))
        .sort((a, b) => a.start - b.start),
    [dayCommitments],
  )
  const anytime = useMemo(() => dayCommitments.filter((c) => !c.start_time || !c.end_time), [dayCommitments])

  const dayTasks = useMemo(() => tasks.filter((t) => t.scheduled_date === date), [tasks, date])
  const openTasks = dayTasks.filter((t) => !t.completed)
  const doneTasks = dayTasks.filter((t) => t.completed)
  // A task sits in an hour because of its own time, never because of packing.
  const timedTasks = openTasks.filter((t) => t.scheduled_time != null)
  const untimed = openTasks.filter((t) => t.scheduled_time == null)

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
            {openTasks.length > 0 && (
              <span className="mono-num text-xs text-slate-300">{openTasks.length} open</span>
            )}
            {doneTasks.length > 0 && <span className="mono-num text-xs text-lo/70">{doneTasks.length} done</span>}
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
            {anytime.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-5 pt-3">
                {anytime.map((c) => (
                  <span key={c.id} className="rounded-md bg-ink-850 px-2.5 py-1 text-[12px] text-slate-400">
                    {c.label}
                  </span>
                ))}
              </div>
            )}

            {untimed.length > 0 && (
              <div className="mx-5 mt-3 space-y-1.5 rounded-lg bg-ink-850/50 p-2.5">
                <p className="mono-num px-0.5 text-[10px] uppercase tracking-wider text-slate-500">No time set</p>
                {untimed.map((t) => (
                  <DraggableTask key={t.id} task={t} showProject={false} />
                ))}
              </div>
            )}

            <HourBlocks
              date={date}
              isToday={isToday}
              timed={timed}
              tasks={timedTasks}
              onAddAt={onAddAt}
            />

            {doneTasks.length > 0 && (
              <div className="mx-5 mb-5 space-y-1.5 opacity-50">
                {doneTasks.map((t) => (
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

/** A separate, droppable block for every hour of the day. */
function HourBlocks({
  date,
  isToday,
  timed,
  tasks,
  onAddAt,
}: {
  date: string
  isToday: boolean
  timed: TimedCommitment[]
  tasks: Task[]
  onAddAt: (time?: string) => void
}) {
  const { dragging } = useDrag()
  const nowHour = Math.floor(nowMinutes() / 60) * 60

  return (
    <div className="space-y-1 p-3 sm:p-4">
      {HOURS.map((h) => {
        const hourEnd = h + 60
        const commitment = timed.find((c) => c.start < hourEnd && c.end > h)
        // Label a commitment once, on the hour it begins, rather than repeating
        // "Work" down eleven blocks.
        const opens = commitment != null && commitment.start < hourEnd && commitment.start >= h
        const startsHere = tasks.filter((t) => {
          const s = minutesOfDay(t.scheduled_time!)
          return s >= h && s < hourEnd
        })
        const continues = tasks.filter((t) => {
          const s = minutesOfDay(t.scheduled_time!)
          return s < h && s + t.duration_min > h
        })
        const live = isToday && h === nowHour
        const empty = startsHere.length === 0 && continues.length === 0 && !opens

        return (
          <DropZone
            key={h}
            id={`hour|${date}|${h}`}
            className={`drop-lane group flex items-stretch gap-3 rounded-lg px-3 transition-colors ${
              commitment ? 'bg-ink-850/60' : 'bg-ink-900/60 hover:bg-ink-850/60'
            } ${live ? 'ring-1 ring-cyan/40' : ''}`}
          >
            <div className="flex w-14 shrink-0 items-start pt-2.5">
              <span className={`mono-num text-[11px] ${live ? 'text-cyan' : 'text-slate-600'}`}>
                {formatMinutesOfDay(h)}
              </span>
            </div>

            <div className="min-w-0 flex-1 space-y-1 py-1.5">
              {opens && (
                <p className="truncate py-1 text-[13px] text-slate-500">
                  {commitment!.label}
                  <span className="mono-num ml-2 text-[11px] text-slate-600">
                    {formatMinutesOfDay(commitment!.start)}–{formatMinutesOfDay(commitment!.end)}
                  </span>
                </p>
              )}

              {startsHere.map((t) => (
                <DraggableTask
                  key={t.id}
                  task={t}
                  at={minutesOfDay(t.scheduled_time!)}
                  pinned
                  showProject={false}
                  dense
                />
              ))}

              {continues.map((t) => (
                <p key={t.id} className="truncate border-l-2 border-ink-700 py-0.5 pl-2 text-[12px] text-slate-600">
                  {t.name}
                  <span className="mono-num ml-2 text-[10px]">
                    until {formatMinutesOfDay(minutesOfDay(t.scheduled_time!) + t.duration_min)}
                  </span>
                </p>
              ))}

              {empty && (
                <button
                  onClick={() => onAddAt(toHHMM(h))}
                  className="flex h-7 w-full items-center text-left text-[12px] text-slate-700
                    opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
                >
                  {dragging ? '' : `+ Add at ${formatMinutesOfDay(h)}`}
                </button>
              )}
            </div>
          </DropZone>
        )
      })}

      <button onClick={() => onAddAt()} className="btn-quiet mt-1 px-2.5 py-1.5 text-[13px]">
        + Task
      </button>
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
        Drag a task onto an hour to pick its start and finish, or back here to unschedule.
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
