import { useState } from 'react'
import { useStore } from '../store'
import { formatDuration, relativeDue } from '../lib/dates'
import { PRIORITY_META } from '../lib/types'
import type { Task } from '../lib/types'
import { TaskForm } from './TaskForm'

const DUE_TONE: Record<string, string> = {
  over: 'text-hi',
  urgent: 'text-med',
  soon: 'text-slate-400',
  far: 'text-slate-500',
}

export function TaskRow({
  task,
  showProject = true,
  emphasis = false,
}: {
  task: Task
  showProject?: boolean
  emphasis?: boolean
}) {
  const { toggleTask, projects } = useStore()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  const project = projects.find((p) => p.id === task.project_id)
  const due = relativeDue(task.due_date)
  const meta = PRIORITY_META[task.priority]

  async function onToggle() {
    setBusy(true)
    try {
      await toggleTask(task)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div
        className={`group flex items-start gap-3 rounded-xl px-3 py-2.5 -mx-1 transition-colors
          hover:bg-ink-850 ${emphasis ? 'bg-ink-850/60' : ''}`}
      >
        <button
          onClick={onToggle}
          disabled={busy}
          aria-label={task.completed ? `Mark ${task.name} not done` : `Complete ${task.name}`}
          className={`mt-0.5 h-5 w-5 shrink-0 rounded-md border-2 flex items-center justify-center
            transition-colors ${
              task.completed
                ? 'bg-lo border-lo text-ink-950'
                : 'border-ink-600 hover:border-accent text-transparent'
            }`}
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M2 6.5 4.5 9 10 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button onClick={() => setEditing(true)} className="flex-1 min-w-0 text-left">
          <div className="flex items-baseline gap-2">
            {!task.completed && <span className="text-[11px] leading-none shrink-0">{meta.dot}</span>}
            <span
              className={`text-sm leading-snug ${
                task.completed ? 'line-through text-slate-500' : emphasis ? 'font-medium text-slate-100' : 'text-slate-200'
              }`}
            >
              {task.name}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-xs text-slate-500">
            <span>{formatDuration(task.duration_min)}</span>
            {due && !task.completed && <span className={DUE_TONE[due.tone]}>{due.text}</span>}
            {showProject && project && <span className="truncate max-w-[14rem]">{project.name}</span>}
            {task.recurring_id && <span title="Recurring task">↻</span>}
            {task.deferred_count > 2 && !task.completed && (
              <span className="text-med" title={`Rescheduled ${task.deferred_count} times`}>
                put off {task.deferred_count}×
              </span>
            )}
          </div>
        </button>
      </div>

      <TaskForm open={editing} onClose={() => setEditing(false)} task={task} />
    </>
  )
}
