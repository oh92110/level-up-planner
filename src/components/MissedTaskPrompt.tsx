import { useState } from 'react'
import { useStore } from '../store'
import { Modal } from './ui'
import { addDays, formatDuration, today } from '../lib/dates'
import { missedTasks } from '../lib/engine'
import type { Task } from '../lib/types'

const DISMISS_KEY = 'levelup:missed-dismissed-on'

/** Shows once per day if there are slipped tasks, and lets you decide what happens to each. */
export function MissedTaskPrompt() {
  const { tasks } = useStore()
  const missed = missedTasks(tasks)
  const [dismissedToday, setDismissedToday] = useState(() => localStorage.getItem(DISMISS_KEY) === today())
  const [queueIndex, setQueueIndex] = useState(0)

  if (!missed.length || dismissedToday) return null
  const current = missed[queueIndex]
  if (!current) return null

  function advance() {
    if (queueIndex + 1 >= missed.length) {
      localStorage.setItem(DISMISS_KEY, today())
      setDismissedToday(true)
    } else {
      setQueueIndex((i) => i + 1)
    }
  }

  return <MissedTaskCard key={current.id} task={current} onResolved={advance} onSkip={advance} />
}

function MissedTaskCard({ task, onResolved, onSkip }: { task: Task; onResolved: () => void; onSkip: () => void }) {
  const { updateTask, deleteTask } = useStore()
  const [busy, setBusy] = useState(false)

  async function apply(patch: Partial<Task> | null) {
    setBusy(true)
    try {
      if (patch === null) await deleteTask(task.id)
      else await updateTask(task.id, patch)
      onResolved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onSkip} title="This slipped">
      <div className="space-y-4">
        <div className="rounded-xl border border-ink-700 bg-ink-850 p-4">
          <p className="font-medium text-slate-100">{task.name}</p>
          <p className="text-xs text-slate-500 mt-1">
            {formatDuration(task.duration_min)}
            {task.deferred_count > 0 && ` · rescheduled ${task.deferred_count} time${task.deferred_count === 1 ? '' : 's'} already`}
          </p>
        </div>

        <p className="text-sm text-slate-400">What should happen to it?</p>

        <div className="grid gap-2">
          <button
            disabled={busy}
            onClick={() =>
              apply({ scheduled_date: today(), due_date: task.due_date, deferred_count: task.deferred_count + 1 })
            }
            className="btn-ghost justify-start"
          >
            Reschedule to today
          </button>
          <button
            disabled={busy}
            onClick={() =>
              apply({ scheduled_date: addDays(today(), 1), deferred_count: task.deferred_count + 1 })
            }
            className="btn-ghost justify-start"
          >
            Push to tomorrow
          </button>
          <button
            disabled={busy}
            onClick={() => apply({ duration_min: Math.max(15, Math.round(task.duration_min / 2)) })}
            className="btn-ghost justify-start"
          >
            Break it into a smaller step
          </button>
          <button
            disabled={busy}
            onClick={() => apply({ priority: task.priority === 'high' ? 'medium' : 'low' })}
            className="btn-ghost justify-start"
          >
            Lower the priority
          </button>
          {task.project_id && (
            <button
              disabled={busy}
              onClick={() => apply({ scheduled_date: null, due_date: null })}
              className="btn-ghost justify-start"
            >
              Move back into the project backlog
            </button>
          )}
          <button disabled={busy} onClick={() => apply(null)} className="btn-ghost justify-start text-hi hover:bg-hi/10">
            Delete it
          </button>
        </div>

        <button onClick={onSkip} className="btn-quiet w-full text-xs">
          Decide later
        </button>
      </div>
    </Modal>
  )
}
