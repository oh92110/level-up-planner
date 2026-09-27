import { useState } from 'react'
import type { MouseEvent } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../store'
import { useToast } from './Toast'
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
  timeLabel,
  timeTone = 'planned',
}: {
  task: Task
  showProject?: boolean
  emphasis?: boolean
  /** Optional time badge shown before the duration — e.g. a suggested or actual slot. */
  timeLabel?: string
  timeTone?: 'planned' | 'done' | 'overflow'
}) {
  const { toggleTask, deleteTask, projects } = useStore()
  const toast = useToast()
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

  async function onDelete(e: MouseEvent) {
    e.stopPropagation()
    setBusy(true)
    try {
      await deleteTask(task.id)
      toast('Task deleted')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <motion.div
        layout="position"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
        transition={{ duration: 0.22 }}
        className={`group flex items-start gap-2 rounded-xl px-3 py-2.5 -mx-1 transition-colors
          hover:bg-ink-850 ${emphasis ? 'bg-ink-850/60' : ''}`}
      >
        <motion.button
          onClick={onToggle}
          disabled={busy}
          whileTap={{ scale: 0.85 }}
          aria-label={task.completed ? `Mark ${task.name} not done` : `Complete ${task.name}`}
          className={`mt-0.5 h-5 w-5 shrink-0 rounded-md border-2 flex items-center justify-center
            transition-colors ${
              task.completed
                ? 'bg-lo border-lo text-ink-950'
                : 'border-ink-600 hover:border-accent text-transparent'
            }`}
        >
          <motion.svg
            viewBox="0 0 12 12"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            initial={false}
            animate={{ scale: task.completed ? 1 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          >
            <path d="M2 6.5 4.5 9 10 3" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
        </motion.button>

        <button onClick={() => setEditing(true)} className="flex-1 min-w-0 text-left">
          <div className="flex items-baseline gap-2">
            {!task.completed && <span className="text-[11px] leading-none shrink-0">{meta.dot}</span>}
            <span
              className={`text-sm leading-snug transition-colors duration-300 ${
                task.completed ? 'line-through text-slate-500' : emphasis ? 'font-medium text-slate-100' : 'text-slate-200'
              }`}
            >
              {task.name}
            </span>
          </div>
          {task.completed ? (
            showProject && project && (
              <div className="mt-0.5 text-xs text-slate-600 truncate max-w-[14rem]">{project.name}</div>
            )
          ) : (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-xs text-slate-500">
              {timeLabel && (
                <span
                  className={`mono-num font-medium ${
                    timeTone === 'done' ? 'text-slate-500' : timeTone === 'overflow' ? 'text-med' : 'text-cyan-soft'
                  }`}
                >
                  {timeLabel}
                </span>
              )}
              <span>{formatDuration(task.duration_min)}</span>
              {due && <span className={DUE_TONE[due.tone]}>{due.text}</span>}
              {showProject && project && <span className="truncate max-w-[14rem]">{project.name}</span>}
              {task.recurring_id && <span title="Recurring task">↻</span>}
              {task.deferred_count > 2 && (
                <span className="text-med" title={`Rescheduled ${task.deferred_count} times`}>
                  put off {task.deferred_count}×
                </span>
              )}
            </div>
          )}
        </button>

        <button
          onClick={onDelete}
          disabled={busy}
          aria-label={`Delete ${task.name}`}
          className="mt-0.5 shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-slate-600
            opacity-60 sm:opacity-0 sm:group-hover:opacity-100 hover:!opacity-100 hover:text-hi hover:bg-hi/10 transition-all"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3 4h10M6.5 4V2.8c0-.4.3-.8.8-.8h1.4c.5 0 .8.4.8.8V4M4.5 4l.6 9c0 .6.5 1 1 1h3.8c.5 0 1-.4 1-1l.6-9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </motion.div>

      <TaskForm open={editing} onClose={() => setEditing(false)} task={task} />
    </>
  )
}
