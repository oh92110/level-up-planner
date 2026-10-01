import { useCallback, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { Card, Empty, SectionHeading } from '../components/ui'
import { DragProvider, DropZone, useDrag } from '../components/DragLayer'
import { DraggableTask } from '../components/DraggableTask'
import { TaskForm } from '../components/TaskForm'
import { WhatNow } from '../components/WhatNow'
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
  nowMinutes,
  toHHMM,
  today,
  weekDates,
  weekStart,
  weekdayOf,
} from '../lib/dates'
import { WEEKDAYS_SHORT } from '../lib/types'
import type { Commitment, Preferences, Task } from '../lib/types'

const KIND_ICON: Record<string, string> = { training: '🥊', work: '💼', planning: '📝', other: '·' }

function weekNumber(iso: string): number {
  const d = fromISO(iso)
  const start = new Date(d.getFullYear(), 0, 1)
  const days = Math.floor((d.getTime() - start.getTime()) / 86400000)
  return Math.ceil((days + start.getDay() + 1) / 7)
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
  const reviewDoneThisWeek = reviews.some((r) => r.week_start === weekStart(ref))

  const handleDrop = useCallback(
    async (task: Task, zoneId: string) => {
      if (zoneId === 'backlog') {
        if (!task.scheduled_date && !task.scheduled_time) return
        await updateTask(task.id, { scheduled_date: null, scheduled_time: null })
        toast('Moved to side tasks')
        return
      }

      const [kind, date, rest] = zoneId.split('|')

      if (kind === 'day') {
        if (task.scheduled_date === date && !task.scheduled_time) return
        await updateTask(task.id, { scheduled_date: date, scheduled_time: null })
        toast(`Moved to ${formatShort(date)} — anytime`, 'success')
        return
      }

      if (kind === 'win') {
        const minute = slotForDrop({
          date,
          windowStart: Number(rest),
          task,
          tasks,
          commitments,
          preferences,
        })
        const time = toHHMM(minute)
        if (task.scheduled_date === date && task.scheduled_time === time) return
        await updateTask(task.id, { scheduled_date: date, scheduled_time: time })
        toast(`${formatShort(date)} · ${formatMinutesOfDay(minute)}`, 'success')
      }
    },
    [updateTask, toast, tasks, commitments, preferences],
  )

  return (
    <DragProvider onDrop={handleDrop}>
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
                What got done, what slipped, and the 3–5 things that matter next week.
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
  const { dragging } = useDrag()
  const [showDone, setShowDone] = useState(false)
  const wd = weekdayOf(date)

  const schedule = useMemo(
    () => daySchedule(date, commitments, tasks, projects, preferences),
    [date, commitments, tasks, projects, preferences],
  )

  const dayTasks = useMemo(() => tasks.filter((t) => t.scheduled_date === date), [tasks, date])
  const doneCount = dayTasks.filter((t) => t.completed).length
  const openCount = dayTasks.length - doneCount
  const freeMin = schedule.segments
    .filter((s) => s.kind === 'free')
    .reduce((sum, s) => sum + (s.end - s.start), 0)

  return (
    <Card className={`!p-0 overflow-hidden ${isToday ? 'hud-corners !border-cyan/35 shadow-glow' : ''}`}>
      <DropZone
        id={`day|${date}`}
        activeClassName="bg-cyan/10"
        className="border-b border-ink-800/70"
      >
        <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left">
          <div className="flex flex-col items-center w-10 shrink-0">
            <span className={`text-[10px] font-mono tracking-widest ${isToday ? 'text-cyan' : 'text-slate-600'}`}>
              {WEEKDAYS_SHORT[wd].toUpperCase()}
            </span>
            <span className={`text-xl font-bold leading-tight ${isToday ? 'text-cyan-soft' : 'text-slate-300'}`}>
              {fromISO(date).getDate()}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {schedule.segments
                .filter((s) => s.kind === 'commitment')
                .map((s) => (
                  <span key={s.commitment!.id} className="chip bg-ink-800 text-slate-400 text-[10px] py-0.5">
                    {KIND_ICON[s.commitment!.kind] ?? '·'} {s.commitment!.label}
                  </span>
                ))}
              {schedule.anytime.map((c) => (
                <span key={c.id} className="chip bg-ink-800/60 text-slate-500 text-[10px] py-0.5">
                  {KIND_ICON[c.kind] ?? '·'} {c.label}
                </span>
              ))}
              {schedule.segments.length === 0 && schedule.anytime.length === 0 && (
                <span className="text-[11px] text-slate-600 font-mono">clear</span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-600 mono-num">
              {openCount > 0 ? `${openCount} open` : 'nothing open'}
              {doneCount > 0 && ` · ${doneCount} done`}
              {freeMin > 0 && ` · ${formatDuration(freeMin)} free`}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isToday && <span className="chip bg-cyan/15 text-cyan-soft text-[10px] py-0.5 font-mono">NOW</span>}
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-slate-600 text-xs"
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
          >
            <div className="p-2 space-y-1.5">
              {schedule.segments.map((seg) =>
                seg.kind === 'commitment' ? (
                  <CommitmentBand key={`c|${seg.commitment!.id}`} seg={seg} isToday={isToday} />
                ) : (
                  <FreeSlot key={`f|${seg.start}`} date={date} seg={seg} isToday={isToday} empty={!dragging} />
                ),
              )}

              {schedule.overflow.length > 0 && (
                <div className="rounded-lg border border-med/30 bg-med/5 p-1.5 space-y-1">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-med px-1 pb-0.5">
                    ⚠ no room left — move or shrink
                  </p>
                  {schedule.overflow.map((t) => (
                    <DraggableTask key={t.id} task={t} tone="overflow" showProject={false} />
                  ))}
                </div>
              )}

              {schedule.segments.length === 0 && (
                <p className="text-[11px] text-slate-600 px-2 py-3 font-mono">
                  no free time today — your commitments fill it
                </p>
              )}

              <div className="flex items-center gap-2 pt-0.5">
                <button onClick={onAdd} className="btn-quiet text-xs">
                  + add task
                </button>
                {schedule.done.length > 0 && (
                  <button onClick={() => setShowDone((s) => !s)} className="btn-quiet text-xs font-mono">
                    {showDone ? '▾' : '▸'} done ({schedule.done.length})
                  </button>
                )}
              </div>

              <div
                className="overflow-hidden transition-[max-height,opacity] duration-300"
                style={{ maxHeight: showDone ? 2000 : 0, opacity: showDone ? 1 : 0 }}
              >
                <div className="space-y-1 pt-1">
                  {schedule.done.map((t) => (
                    <DraggableTask key={t.id} task={t} draggable={false} showProject={false} />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

function CommitmentBand({ seg, isToday }: { seg: DaySegment; isToday: boolean }) {
  const c = seg.commitment as Commitment
  const now = nowMinutes()
  const live = isToday && now >= seg.start && now < seg.end
  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-2.5 py-2 bg-ink-800/40 stripe-block ${
        live ? 'ring-1 ring-cyan/40' : ''
      }`}
    >
      <span className="mono-num text-[11px] text-slate-500 w-[5.5rem] shrink-0">
        {formatMinutesOfDay(seg.start)}–{formatMinutesOfDay(seg.end)}
      </span>
      <span className="text-sm text-slate-400 flex-1 min-w-0 truncate">
        {KIND_ICON[c.kind] ?? '·'} {c.label}
      </span>
      {live && <span className="text-[10px] font-mono text-cyan animate-pulse shrink-0">● LIVE</span>}
    </div>
  )
}

function FreeSlot({
  date,
  seg,
  isToday,
  empty,
}: {
  date: string
  seg: DaySegment
  isToday: boolean
  empty: boolean
}) {
  const now = nowMinutes()
  const live = isToday && now >= seg.start && now < seg.end
  const used = seg.tasks.reduce((sum, p) => sum + p.task.duration_min, 0)
  const left = Math.max(0, seg.end - seg.start - used)

  return (
    <DropZone
      id={`win|${date}|${seg.start}`}
      className="rounded-lg border border-dashed border-ink-700/70 p-1.5"
      activeClassName="!border-solid border-cyan/70 bg-cyan/10 shadow-glow"
    >
      <div className="flex items-center gap-2 px-1 pb-1">
        <span className={`mono-num text-[11px] shrink-0 ${live ? 'text-cyan' : 'text-slate-500'}`}>
          {formatMinutesOfDay(seg.start)}–{formatMinutesOfDay(seg.end)}
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-ink-700 to-transparent" />
        {live && <span className="text-[10px] font-mono text-cyan shrink-0">◂ now</span>}
        {left > 0 && <span className="text-[10px] font-mono text-slate-600 shrink-0">{formatDuration(left)} free</span>}
      </div>

      <div className="space-y-1">
        {seg.tasks.map((p) => (
          <DraggableTask key={p.task.id} task={p.task} at={p.start} pinned={p.pinned} showProject={false} />
        ))}
        {seg.tasks.length === 0 && (
          <p className={`px-1 py-1 text-[11px] font-mono ${empty ? 'text-slate-700' : 'text-cyan-soft'}`}>
            {empty ? 'free' : 'drop here'}
          </p>
        )}
      </div>
    </DropZone>
  )
}

function Sidebar({ onAdd }: { onAdd: () => void }) {
  const { tasks, projects, preferences } = useStore()
  const { dragging } = useDrag()
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
    <div className="lg:sticky lg:top-6">
      <SectionHeading
        title={`Side tasks (${sideTasks.length})`}
        action={
          <button onClick={onAdd} className="btn-quiet text-xs px-2 py-1">
            + Add
          </button>
        }
      />

      <DropZone
        id="backlog"
        className="rounded-xl border border-dashed border-ink-700/70 p-1.5 min-h-[6rem]"
        activeClassName="!border-solid border-cyan/70 bg-cyan/10 shadow-glow"
      >
        {sideTasks.length === 0 ? (
          <Empty icon="📋" text={dragging ? 'Drop to unschedule' : 'Nothing waiting.'} />
        ) : (
          <div className="space-y-1">
            {sideTasks.map((t) => (
              <DraggableTask key={t.id} task={t} />
            ))}
          </div>
        )}
      </DropZone>

      <p className="text-[10px] font-mono text-slate-600 mt-2 px-1">drag ⠿ onto a day or time slot</p>

      {completed.length > 0 && (
        <div className="pt-3">
          <button onClick={() => setShowCompleted((s) => !s)} className="btn-quiet text-xs px-2 py-1 font-mono">
            {showCompleted ? '▾' : '▸'} completed ({completed.length})
          </button>
          <div
            className="overflow-hidden transition-[max-height,opacity] duration-300"
            style={{ maxHeight: showCompleted ? 4000 : 0, opacity: showCompleted ? 1 : 0 }}
          >
            <div className="space-y-1 mt-2">
              {completed.slice(0, 40).map((t) => (
                <DraggableTask key={t.id} task={t} draggable={false} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
