import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Field, Modal } from './ui'
import { useToast } from './Toast'
import { formatDuration, minutesOfDay, timeOptions, toHHMM, today } from '../lib/dates'
import { WEEKDAYS } from '../lib/types'
import type { Priority, Task } from '../lib/types'

const DURATIONS = [15, 20, 30, 45, 60, 90]
/** Anything longer than this should be split into steps, not scheduled whole. */
const OVERSIZED_MIN = 90
const DAY_START = 6 * 60
const DAY_END = 23 * 60

interface Draft {
  name: string
  notes: string
  priority: Priority
  due_date: string
  scheduled_date: string
  /** "HH:MM" start, only used when the task is given a day. */
  scheduled_time: string
  duration_min: number
  project_id: string
  milestone_id: string
  recurring: boolean
  weekday: number
}

function draftFrom(task?: Task, defaults?: Partial<Draft>): Draft {
  return {
    name: task?.name ?? '',
    notes: task?.notes ?? '',
    priority: task?.priority ?? 'medium',
    due_date: task?.due_date ?? '',
    scheduled_date: task?.scheduled_date ?? '',
    scheduled_time: task?.scheduled_time ?? '',
    duration_min: task?.duration_min ?? 30,
    project_id: task?.project_id ?? '',
    milestone_id: task?.milestone_id ?? '',
    recurring: false,
    weekday: 0,
    ...defaults,
  }
}

export function TaskForm({
  open,
  onClose,
  task,
  defaults,
}: {
  open: boolean
  onClose: () => void
  task?: Task
  defaults?: Partial<Draft>
}) {
  const { addTask, updateTask, deleteTask, addRecurring, projects, milestones } = useStore()
  const toast = useToast()
  const [d, setD] = useState<Draft>(() => draftFrom(task, defaults))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setD(draftFrom(task, defaults))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }))

  const projectMilestones = milestones.filter((m) => m.project_id === d.project_id && !m.completed)
  // A task given a day needs a start; default to 6 PM rather than leaving it blank.
  const startTime = d.scheduled_time || '18:00'
  const oversized = d.duration_min > OVERSIZED_MIN

  async function save() {
    if (!d.name.trim()) return
    setSaving(true)
    try {
      if (d.recurring && !task) {
        await addRecurring({
          name: d.name.trim(),
          notes: d.notes,
          priority: d.priority,
          duration_min: d.duration_min,
          weekday: d.weekday,
          interval_weeks: 1,
          project_id: d.project_id || null,
        })
        toast('Recurring task added', 'success')
      } else {
        const payload = {
          name: d.name.trim(),
          notes: d.notes,
          priority: d.priority,
          due_date: d.due_date || null,
          scheduled_date: d.scheduled_date || null,
          // A time only means something alongside a day.
          scheduled_time: d.scheduled_date ? d.scheduled_time || null : null,
          duration_min: d.duration_min,
          project_id: d.project_id || null,
          milestone_id: d.milestone_id || null,
        }
        if (task) {
          await updateTask(task.id, payload)
          toast('Task updated', 'success')
        } else {
          await addTask(payload)
          toast('Task added', 'success')
        }
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!task) return
    setSaving(true)
    try {
      await deleteTask(task.id)
      toast('Task deleted')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={task ? 'Edit task' : 'Add task'}>
      <div className="space-y-4">
        <Field label="What needs doing">
          <input
            autoFocus
            value={d.name}
            onChange={(e) => set('name', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && d.name.trim()) save()
            }}
            placeholder="e.g. Complete the Lincoln College form"
            className="w-full"
          />
        </Field>

        <div>
          <label className="label">Priority</label>
          <div className="grid grid-cols-3 gap-2">
            {(['high', 'medium', 'low'] as Priority[]).map((p) => (
              <button
                key={p}
                onClick={() => set('priority', p)}
                className={`btn text-xs capitalize ${
                  d.priority === p ? 'bg-ink-700 text-slate-100 ring-1 ring-accent/50' : 'btn-ghost'
                }`}
              >
                {p === 'high' ? '🔴' : p === 'medium' ? '🟠' : '🟢'} {p}
              </button>
            ))}
          </div>
        </div>

        {d.scheduled_date && !d.recurring ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <select
                value={startTime}
                onChange={(e) => {
                  const next = minutesOfDay(e.target.value)
                  set('scheduled_time', e.target.value)
                  set('duration_min', Math.max(15, Math.min(DAY_END - next, d.duration_min)))
                }}
                className="w-full"
              >
                {timeOptions(DAY_START, DAY_END - 15).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Finish">
              <select
                value={toHHMM(minutesOfDay(startTime) + d.duration_min)}
                onChange={(e) => set('duration_min', minutesOfDay(e.target.value) - minutesOfDay(startTime))}
                className="w-full"
              >
                {timeOptions(minutesOfDay(startTime) + 15, DAY_END).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <p className="col-span-2 -mt-1 text-xs text-slate-500">{formatDuration(d.duration_min)}</p>
          </div>
        ) : (
          <div>
            <label className="label">How long will it take</label>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => set('duration_min', m)}
                  className={`btn text-xs px-3 ${
                    d.duration_min === m ? 'bg-ink-700 text-slate-100 ring-1 ring-accent/50' : 'btn-ghost'
                  }`}
                >
                  {m < 60 ? `${m}m` : m === 60 ? '1h' : '1.5h'}
                </button>
              ))}
              <input
                type="number"
                min={5}
                step={5}
                value={d.duration_min}
                onChange={(e) => set('duration_min', Math.max(5, Number(e.target.value) || 5))}
                className="w-20 text-xs"
                aria-label="Custom duration in minutes"
              />
            </div>
            {oversized && (
              <p className="text-xs text-med mt-2 leading-relaxed">
                Over 90 minutes is usually a sign this is more than one task. Consider splitting it into steps you
                can finish in one sitting.
              </p>
            )}
          </div>
        )}

        {!task && (
          <label className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={d.recurring}
              onChange={(e) => set('recurring', e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            This repeats every week
          </label>
        )}

        {d.recurring && !task ? (
          <Field label="Which day">
            <select value={d.weekday} onChange={(e) => set('weekday', Number(e.target.value))} className="w-full">
              {WEEKDAYS.map((w, i) => (
                <option key={w} value={i}>
                  {w}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Do it on">
              <input
                type="date"
                value={d.scheduled_date}
                onChange={(e) => set('scheduled_date', e.target.value)}
                className="w-full"
              />
            </Field>
            <Field label="Deadline">
              <input
                type="date"
                value={d.due_date}
                onChange={(e) => set('due_date', e.target.value)}
                className="w-full"
              />
            </Field>
          </div>
        )}

        {!d.recurring && !d.scheduled_date && (
          <button onClick={() => set('scheduled_date', today())} className="btn-quiet text-xs -mt-1 px-0">
            Schedule for today
          </button>
        )}

        <Field label="Project">
          <select
            value={d.project_id}
            onChange={(e) => {
              set('project_id', e.target.value)
              set('milestone_id', '')
            }}
            className="w-full"
          >
            <option value="">No project</option>
            {projects
              .filter((p) => !p.archived)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </Field>

        {d.project_id && projectMilestones.length > 0 && !d.recurring && (
          <Field label="Milestone">
            <select
              value={d.milestone_id}
              onChange={(e) => set('milestone_id', e.target.value)}
              className="w-full"
            >
              <option value="">No specific milestone</option>
              {projectMilestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Notes">
          <textarea
            value={d.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            placeholder="Optional"
            className="w-full resize-none"
          />
        </Field>

        <div className="flex items-center gap-2 pt-1">
          <button onClick={save} disabled={!d.name.trim() || saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : task ? 'Save changes' : 'Add task'}
          </button>
          {task && (
            <button onClick={remove} disabled={saving} className="btn-ghost text-hi hover:bg-hi/10">
              Delete
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
