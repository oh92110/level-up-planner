import { useState } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import { useStore } from '../store'
import { useToast } from './Toast'
import { useDrag } from './DragLayer'
import { formatDuration, formatMinutesOfDay, relativeDue } from '../lib/dates'
import { PRIORITY_META } from '../lib/types'
import type { Task } from '../lib/types'
import { TaskForm } from './TaskForm'

const DUE_TONE: Record<string, string> = {
  over: 'text-hi',
  urgent: 'text-med',
  soon: 'text-slate-400',
  far: 'text-slate-500',
}

export function DraggableTask({
  task,
  at,
  pinned = false,
  showProject = true,
  draggable = true,
  tone = 'normal',
  /** Fills its container and drops the second line — for short calendar blocks. */
  compact = false,
  /** Calendar-grid block: no grip, drags on touch too, delete floats on hover. */
  dense = false,
}: {
  task: Task
  at?: number
  pinned?: boolean
  showProject?: boolean
  draggable?: boolean
  tone?: 'normal' | 'overflow'
  compact?: boolean
  dense?: boolean
}) {
  const { toggleTask, deleteTask, projects } = useStore()
  const toast = useToast()
  const { begin, dragging, didJustDrag } = useDrag()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  // Grid/band blocks are always single-line.
  const tight = compact || dense
  const project = projects.find((p) => p.id === task.project_id)
  const due = relativeDue(task.due_date)
  const meta = PRIORITY_META[task.priority]
  const isDragging = dragging?.id === task.id

  async function onToggle() {
    if (didJustDrag()) return
    setBusy(true)
    try {
      await toggleTask(task)
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(e: MouseEvent) {
    e.stopPropagation()
    if (didJustDrag()) return
    setBusy(true)
    try {
      await deleteTask(task.id)
      toast('Task deleted')
    } finally {
      setBusy(false)
    }
  }

  // Press anywhere to drag; under the threshold it stays a click.
  // In list mode touch is excluded so a finger on the row still scrolls the
  // page — there you drag by the grip. Grid blocks set touch-action: none and
  // accept touch directly, since the calendar has empty space to scroll from.
  function onPointerDown(e: PointerEvent) {
    if (!draggable || e.button !== 0) return
    if (!dense && e.pointerType === 'touch') return
    begin(task, e)
  }

  function onGripDown(e: PointerEvent) {
    if (!draggable) return
    e.stopPropagation()
    begin(task, e)
  }

  const edge = task.completed
    ? 'before:bg-ink-700'
    : tone === 'overflow'
      ? 'before:bg-med'
      : pinned
        ? 'before:bg-cyan'
        : 'before:bg-ink-600'

  return (
    <>
      <div
        onPointerDown={onPointerDown}
        className={`group relative flex items-stretch overflow-hidden select-none transition-colors
          before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-[''] ${edge}
          ${dense
            ? 'h-full gap-1.5 rounded-[5px] bg-ink-800/90 pl-1.5 pr-1 hover:bg-ink-700 touch-none'
            : `gap-2 rounded-md bg-ink-850 pr-1 hover:bg-ink-800 ${tight ? 'h-full' : ''}`}
          ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}
          ${isDragging ? 'opacity-25' : ''}`}
      >
        {!dense && (
        <button
          onPointerDown={onGripDown}
          disabled={!draggable}
          aria-label={`Drag ${task.name}`}
          tabIndex={-1}
          className={`shrink-0 w-4 flex items-center justify-center touch-none ${
            draggable
              ? 'text-slate-600 group-hover:text-slate-400 cursor-grab active:cursor-grabbing'
              : 'text-transparent cursor-default'
          }`}
        >
          <svg viewBox="0 0 6 14" className="h-3 w-1.5" fill="currentColor" aria-hidden="true">
            <circle cx="1" cy="2" r="1" />
            <circle cx="5" cy="2" r="1" />
            <circle cx="1" cy="7" r="1" />
            <circle cx="5" cy="7" r="1" />
            <circle cx="1" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        </button>
        )}

        <button
          onClick={onToggle}
          disabled={busy}
          aria-label={task.completed ? `Mark ${task.name} not done` : `Complete ${task.name}`}
          className={`self-center shrink-0 h-[17px] w-[17px] rounded-[4px] border flex items-center justify-center transition-colors ${
            task.completed ? 'bg-lo border-lo text-ink-950' : 'border-ink-600 hover:border-cyan text-transparent'
          }`}
        >
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.6">
            <path d="M2 6.5 4.5 9 10 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button
          onClick={() => {
            if (!didJustDrag()) setEditing(true)
          }}
          className={`flex-1 min-w-0 self-center text-left ${tight ? 'py-1' : 'py-2'}`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {!task.completed && <span className="text-[9px] leading-none shrink-0">{meta.dot}</span>}
            <span
              className={`truncate text-[13px] leading-tight ${
                task.completed ? 'line-through text-slate-600' : 'text-slate-100'
              }`}
            >
              {task.name}
            </span>
            {tight && at != null && !task.completed && (
              <span className={`mono-num ml-auto pl-2 text-[10px] shrink-0 ${pinned ? 'text-cyan' : 'text-slate-500'}`}>
                {formatMinutesOfDay(at)}
              </span>
            )}
          </div>

          {!tight && !task.completed && (
            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
              {at != null && (
                <span className={`mono-num ${pinned ? 'text-cyan' : 'text-slate-500'}`}>{formatMinutesOfDay(at)}</span>
              )}
              <span className="mono-num">{formatDuration(task.duration_min)}</span>
              {due && <span className={DUE_TONE[due.tone]}>{due.text}</span>}
              {showProject && project && <span className="truncate">{project.name}</span>}
            </div>
          )}
        </button>

        <button
          onClick={onDelete}
          disabled={busy}
          aria-label={`Delete ${task.name}`}
          className={`shrink-0 flex items-center justify-center rounded text-slate-500
            opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-hi transition-opacity ${
              dense ? 'absolute right-0 top-0 h-full w-5 bg-gradient-to-l from-ink-700 to-transparent' : 'self-center h-6 w-6'
            }`}
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <TaskForm open={editing} onClose={() => setEditing(false)} task={task} />
    </>
  )
}
