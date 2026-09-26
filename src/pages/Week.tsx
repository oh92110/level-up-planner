import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { Card, SectionHeading } from '../components/ui'
import { TaskRow } from '../components/TaskRow'
import { TaskForm } from '../components/TaskForm'
import { addDays, formatShort, formatTime, today, weekDates, weekStart, weekdayOf } from '../lib/dates'
import { WEEKDAYS_SHORT } from '../lib/types'

export function Week() {
  const { tasks } = useStore()
  const [offset, setOffset] = useState(0)
  const [addFor, setAddFor] = useState<string | null>(null)

  const start = addDays(weekStart(today()), offset * 7)
  const dates = weekDates(start)
  const ref = today()

  const unscheduled = useMemo(
    () => tasks.filter((t) => !t.completed && !t.scheduled_date),
    [tasks],
  )

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-0 pb-8">
      <header className="pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">This week</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {formatShort(start)} – {formatShort(addDays(start, 6))}
          </p>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setOffset((o) => o - 1)} className="btn-ghost px-3">
            ←
          </button>
          <button onClick={() => setOffset(0)} disabled={offset === 0} className="btn-ghost px-3 text-xs">
            Today
          </button>
          <button onClick={() => setOffset((o) => o + 1)} className="btn-ghost px-3">
            →
          </button>
        </div>
      </header>

      <div className="space-y-3">
        {dates.map((date) => (
          <DayCard key={date} date={date} isToday={date === ref} onAdd={() => setAddFor(date)} />
        ))}
      </div>

      {unscheduled.length > 0 && (
        <div className="mt-6">
          <SectionHeading title={`Not yet scheduled (${unscheduled.length})`} />
          <Card className="!p-2">
            <div className="divide-y divide-ink-800/60">
              {unscheduled.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          </Card>
        </div>
      )}

      <TaskForm
        open={addFor !== null}
        onClose={() => setAddFor(null)}
        defaults={addFor ? { scheduled_date: addFor } : undefined}
      />
    </div>
  )
}

function DayCard({ date, isToday, onAdd }: { date: string; isToday: boolean; onAdd: () => void }) {
  const { tasks, commitments } = useStore()
  const wd = weekdayOf(date)
  const dayCommitments = commitments
    .filter((c) => c.weekday === wd && c.active)
    .sort((a, b) => (a.start_time ?? '99:99').localeCompare(b.start_time ?? '99:99'))
  const dayTasks = tasks
    .filter((t) => t.scheduled_date === date)
    .sort((a, b) => Number(a.completed) - Number(b.completed))

  return (
    <Card className={`!p-4 ${isToday ? 'ring-1 ring-accent/40' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <span className={`text-sm font-semibold ${isToday ? 'text-accent-soft' : 'text-slate-200'}`}>
            {WEEKDAYS_SHORT[wd]}
          </span>
          <span className="text-xs text-slate-500">{formatShort(date)}</span>
          {isToday && <span className="chip bg-accent/15 text-accent-soft text-[10px] py-0.5">Today</span>}
        </div>
        <button onClick={onAdd} className="btn-quiet text-xs px-2 py-0.5">
          + task
        </button>
      </div>

      {dayCommitments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {dayCommitments.map((c) => (
            <span key={c.id} className="chip bg-ink-800 text-slate-400 text-[11px]">
              {c.kind === 'training' ? '🥊' : c.kind === 'work' ? '💼' : '📝'} {c.label}
              {c.start_time && ` ${formatTime(c.start_time)}`}
            </span>
          ))}
        </div>
      )}

      {dayTasks.length === 0 ? (
        <p className="text-xs text-slate-600">Nothing scheduled.</p>
      ) : (
        <div className="divide-y divide-ink-800/60 -mx-1">
          {dayTasks.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </div>
      )}
    </Card>
  )
}
