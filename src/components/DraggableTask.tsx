import { useState } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import { motion, useDragControls } from 'framer-motion'
import type { PanInfo } from 'framer-motion'
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

const TIME_TONE: Record<string, string> = {
  pinned: 'text-cyan-soft',
  planned: 'text-slate-500',
  done: 'text-slate-600',
  overflow: 'text-med',
}

const BORDER_TONE: Record<string, string> = {
  pinned: 'border-l-2 border-l-cyan/70',
  planned: '',
  done: '',
  overflow: 'border-l-2 border-l-med/70',
}

export function DraggableTask({
  task,
  onDropAt,
  timeLabel,
  timeTone = 'planned',
  showProject = true,
  draggable = true,
}: {
  task: Task
  onDropAt: (point: { x: number; y: number }) => void
  timeLabel?: string
  timeTone?: 'planned' | 'pinned' | 'done' | 'overflow'
  showProject?: boolean
  draggable?: boolean
}) {
  const { toggleTask, deleteTask, projects } = useStore()
  const toast = useToast()
  const dragControls = useDragControls()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

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

  function startDrag(e: PointerEvent) {
    e.preventDefault()
    dragControls.start(e)
  }

  return (
    <>
      <motion.div
        drag={draggable}
        dragControls={dragControls}
        dragListener={false}
        dragSnapToOrigin
        dragElastic={0.1}
        dragMomentum={false}
        whileDrag={draggable ? { scale: 1.03, boxShadow: '0 16px 32px -8px rgba(0,0,0,.65)' } : undefined}
        onDragStart={() => setDragging(true)}
        onDragEnd={(_e, info: PanInfo) => {
          setDragging(false)
          onDropAt(info.point)
        }}
        style={{ touchAction: 'none' }}
        className={`group flex items-start gap-1 rounded-xl px-1.5 py-2 bg-ink-900 border border-ink-800/60
          hover:border-ink-700 transition-colors ${BORDER_TONE[timeTone]} ${dragging ? 'relative z-[60] cursor-grabbing' : ''}`}
      >
        <button
          onPointerDown={draggable ? startDrag : undefined}
          disabled={!draggable}
          aria-label="Drag to reschedule"
          className={`mt-1.5 shrink-0 h-5 w-3.5 flex items-center justify-center touch-none ${
            draggable ? 'text-slate-600 hover:text-slate-400 cursor-grab' : 'text-slate-800 cursor-default'
          }`}
        >
          <svg viewBox="0 0 10 16" className="h-3.5 w-2.5" fill="currentColor">
            <circle cx="2" cy="2" r="1.3" />
            <circle cx="8" cy="2" r="1.3" />
            <circle cx="2" cy="8" r="1.3" />
            <circle cx="8" cy="8" r="1.3" />
            <circle cx="2" cy="14" r="1.3" />
            <circle cx="8" cy="14" r="1.3" />
          </svg>
        </button>

        <motion.button
          onClick={onToggle}
          disabled={busy}
          whileTap={{ scale: 0.85 }}
          aria-label={task.completed ? `Mark ${task.name} not done` : `Complete ${task.name}`}
          className={`mt-0.5 h-5 w-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
            task.completed ? 'bg-lo border-lo text-ink-950' : 'border-ink-600 hover:border-accent text-transparent'
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
          <div className="flex items-baseline gap-1.5">
            {!task.completed && <span className="text-[10px] leading-none shrink-0">{meta.dot}</span>}
            <span
              className={`text-sm leading-snug ${
                task.completed ? 'line-through text-slate-500' : 'text-slate-200'
              }`}
            >
              {task.name}
            </span>
          </div>
          {!task.completed && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-slate-500">
              {timeLabel && <span className={`mono-num font-medium ${TIME_TONE[timeTone]}`}>{timeLabel}</span>}
              <span>{formatDuration(task.duration_min)}</span>
              {due && <span className={DUE_TONE[due.tone]}>{due.text}</span>}
              {showProject && project && <span className="truncate max-w-[10rem]">{project.name}</span>}
            </div>
          )}
        </button>

        <button
          onClick={onDelete}
          disabled={busy}
          aria-label={`Delete ${task.name}`}
          className="mt-0.5 shrink-0 h-5 w-5 flex items-center justify-center rounded-md text-slate-600
            opacity-60 sm:opacity-0 sm:group-hover:opacity-100 hover:!opacity-100 hover:text-hi hover:bg-hi/10 transition-all"
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path
              d="M3 4h10M6.5 4V2.8c0-.4.3-.8.8-.8h1.4c.5 0 .8.4.8.8V4M4.5 4l.6 9c0 .6.5 1 1 1h3.8c.5 0 1-.4 1-1l.6-9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </motion.div>

      <TaskForm open={editing} onClose={() => setEditing(false)} task={task} />
    </>
  )
}
