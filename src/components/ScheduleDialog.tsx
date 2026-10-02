import { useEffect, useMemo, useState } from 'react'
import { Field, Modal } from './ui'
import { formatDuration, formatShort, minutesOfDay, timeOptions, toHHMM } from '../lib/dates'
import type { Task } from '../lib/types'

/** Asks for a start and finish whenever a task is put on a day. */
export function ScheduleDialog({
  open,
  task,
  date,
  defaultStart,
  dayStart,
  dayEnd,
  onClose,
  onConfirm,
}: {
  open: boolean
  task: Task | null
  date: string
  /** "HH:MM" to preselect — where the task was dropped. */
  defaultStart: string
  dayStart: number
  dayEnd: number
  onClose: () => void
  onConfirm: (start: string, durationMin: number) => Promise<void> | void
}) {
  const [start, setStart] = useState(defaultStart)
  const [end, setEnd] = useState(defaultStart)
  const [saving, setSaving] = useState(false)

  // Reset to the dropped position each time the dialog opens.
  useEffect(() => {
    if (!open || !task) return
    const s = minutesOfDay(defaultStart)
    setStart(defaultStart)
    setEnd(toHHMM(Math.min(dayEnd, s + Math.max(15, task.duration_min))))
  }, [open, task, defaultStart, dayEnd])

  const starts = useMemo(() => timeOptions(dayStart, dayEnd - 15), [dayStart, dayEnd])
  const ends = useMemo(() => timeOptions(minutesOfDay(start) + 15, dayEnd), [start, dayEnd])

  const duration = minutesOfDay(end) - minutesOfDay(start)
  const valid = duration > 0

  async function save() {
    if (!valid) return
    setSaving(true)
    try {
      await onConfirm(start, duration)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={task ? task.name : 'Schedule task'}>
      <div className="space-y-5">
        <p className="text-[13px] text-slate-500">{formatShort(date)}</p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <select
              value={start}
              onChange={(e) => {
                const next = e.target.value
                setStart(next)
                // Keep finish after start.
                if (minutesOfDay(end) <= minutesOfDay(next)) {
                  setEnd(toHHMM(Math.min(dayEnd, minutesOfDay(next) + Math.max(15, duration > 0 ? duration : 30))))
                }
              }}
              className="w-full"
            >
              {starts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Finish">
            <select value={end} onChange={(e) => setEnd(e.target.value)} className="w-full">
              {ends.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <p className="mono-num text-xs text-slate-500">
          {valid ? formatDuration(duration) : 'Finish must be after start'}
        </p>

        <div className="flex gap-2">
          <button onClick={save} disabled={!valid || saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : 'Schedule'}
          </button>
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}
