import { useState } from 'react'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { Card, Field, Modal, SectionHeading } from '../components/ui'
import { formatDuration, formatTime } from '../lib/dates'
import { PRIORITY_META, WEEKDAYS } from '../lib/types'
import type { Commitment, CommitmentKind, Priority, RecurringTask } from '../lib/types'

export function Settings() {
  const { commitments, recurring, preferences, updatePreferences, session } = useStore()
  const [editingCommitment, setEditingCommitment] = useState<Commitment | 'new' | null>(null)
  const [editingRecurring, setEditingRecurring] = useState<RecurringTask | 'new' | null>(null)

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-0 pb-8">
      <header className="pt-6 pb-4">
        <h1 className="text-xl font-bold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your schedule, repeats, and how the planner behaves.</p>
      </header>

      <div className="mb-6">
        <SectionHeading
          title="Fixed weekly schedule"
          action={
            <button onClick={() => setEditingCommitment('new')} className="btn-quiet text-xs px-2 py-1">
              + Add
            </button>
          }
        />
        <Card className="!p-2">
          {WEEKDAYS.map((day, wd) => {
            const items = commitments
              .filter((c) => c.weekday === wd)
              .sort((a, b) => (a.start_time ?? '99:99').localeCompare(b.start_time ?? '99:99'))
            if (!items.length) return null
            return (
              <div key={day} className="px-2 py-2">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{day}</p>
                <div className="space-y-1">
                  {items.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setEditingCommitment(c)}
                      className={`w-full flex items-center justify-between text-sm rounded-lg px-2 py-1.5 hover:bg-ink-850 ${
                        c.active ? '' : 'opacity-40'
                      }`}
                    >
                      <span className="text-slate-200">
                        {c.kind === 'training' ? '🥊 ' : c.kind === 'work' ? '💼 ' : '📝 '}
                        {c.label}
                      </span>
                      <span className="text-xs text-slate-500">
                        {c.start_time ? `${formatTime(c.start_time)} – ${formatTime(c.end_time)}` : 'Anytime'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </Card>
      </div>

      <div className="mb-6">
        <SectionHeading
          title="Recurring tasks"
          action={
            <button onClick={() => setEditingRecurring('new')} className="btn-quiet text-xs px-2 py-1">
              + Add
            </button>
          }
        />
        <Card className="!p-2">
          {recurring.length === 0 ? (
            <p className="text-xs text-slate-600 p-3">No recurring tasks yet.</p>
          ) : (
            <div className="divide-y divide-ink-800/60">
              {recurring.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setEditingRecurring(r)}
                  className={`w-full flex items-center justify-between text-sm px-2 py-2.5 hover:bg-ink-850 ${
                    r.active ? '' : 'opacity-40'
                  }`}
                >
                  <span className="text-left">
                    <span className="text-slate-200">{r.name}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Every {WEEKDAYS[r.weekday]} · {formatDuration(r.duration_min)}
                    </span>
                  </span>
                  <span>{PRIORITY_META[r.priority].dot}</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mb-6">
        <SectionHeading title="Preferences" />
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-200">Wind-down time</p>
              <p className="text-xs text-slate-500">No new tasks suggested after this hour.</p>
            </div>
            <select
              value={preferences?.wind_down_hour ?? 21}
              onChange={(e) => updatePreferences({ wind_down_hour: Number(e.target.value) })}
              className="w-28"
            >
              {Array.from({ length: 6 }, (_, i) => 18 + i).map((h) => (
                <option key={h} value={h}>
                  {h > 12 ? h - 12 : h}:00 {h >= 12 ? 'PM' : 'AM'}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-200">Protect free time</p>
              <p className="text-xs text-slate-500">Leave realistic gaps instead of filling every minute.</p>
            </div>
            <input
              type="checkbox"
              checked={preferences?.protect_rest ?? true}
              onChange={(e) => updatePreferences({ protect_rest: e.target.checked })}
              className="h-5 w-5 accent-accent"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-200">Daily priority target</p>
              <p className="text-xs text-slate-500">How many top priorities to surface each day.</p>
            </div>
            <input
              type="number"
              min={1}
              max={5}
              value={preferences?.daily_priority_target ?? 3}
              onChange={(e) => updatePreferences({ daily_priority_target: Number(e.target.value) })}
              className="w-20"
            />
          </div>
        </Card>
      </div>

      <div className="mb-6">
        <SectionHeading title="Account" />
        <Card>
          <p className="text-sm text-slate-300 mb-3">{session?.user.email}</p>
          <button onClick={() => supabase.auth.signOut()} className="btn-ghost text-sm">
            Sign out
          </button>
        </Card>
      </div>

      {editingCommitment && (
        <CommitmentEditor
          value={editingCommitment === 'new' ? null : editingCommitment}
          onClose={() => setEditingCommitment(null)}
        />
      )}
      {editingRecurring && (
        <RecurringEditor
          value={editingRecurring === 'new' ? null : editingRecurring}
          onClose={() => setEditingRecurring(null)}
        />
      )}
    </div>
  )
}

const KINDS: CommitmentKind[] = ['work', 'training', 'planning', 'other']

function CommitmentEditor({ value, onClose }: { value: Commitment | null; onClose: () => void }) {
  const { addCommitment, updateCommitment, deleteCommitment } = useStore()
  const [label, setLabel] = useState(value?.label ?? '')
  const [weekday, setWeekday] = useState(value?.weekday ?? 1)
  const [kind, setKind] = useState<CommitmentKind>(value?.kind ?? 'other')
  const [startTime, setStartTime] = useState(value?.start_time ?? '')
  const [endTime, setEndTime] = useState(value?.end_time ?? '')
  const [active, setActive] = useState(value?.active ?? true)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!label.trim()) return
    setSaving(true)
    try {
      const payload = {
        label: label.trim(),
        weekday,
        kind,
        start_time: startTime || null,
        end_time: endTime || null,
        active,
      }
      if (value) await updateCommitment(value.id, payload)
      else await addCommitment(payload)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={value ? 'Edit commitment' : 'Add commitment'}>
      <div className="space-y-4">
        <Field label="Label">
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Day">
            <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className="w-full">
              {WEEKDAYS.map((w, i) => (
                <option key={w} value={i}>
                  {w}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type">
            <select value={kind} onChange={(e) => setKind(e.target.value as CommitmentKind)} className="w-full">
              {KINDS.map((k) => (
                <option key={k} value={k} className="capitalize">
                  {k}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start (optional)">
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full" />
          </Field>
          <Field label="End (optional)">
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full" />
          </Field>
        </div>
        <label className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-accent" />
          Active
        </label>
        <div className="flex gap-2">
          <button onClick={save} disabled={!label.trim() || saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : 'Save'}
          </button>
          {value && (
            <button
              onClick={async () => {
                await deleteCommitment(value.id)
                onClose()
              }}
              className="btn-ghost text-hi hover:bg-hi/10"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

function RecurringEditor({ value, onClose }: { value: RecurringTask | null; onClose: () => void }) {
  const { addRecurring, updateRecurring, deleteRecurring, projects } = useStore()
  const [name, setName] = useState(value?.name ?? '')
  const [weekday, setWeekday] = useState(value?.weekday ?? 0)
  const [priority, setPriority] = useState<Priority>(value?.priority ?? 'medium')
  const [duration, setDuration] = useState(value?.duration_min ?? 30)
  const [projectId, setProjectId] = useState(value?.project_id ?? '')
  const [active, setActive] = useState(value?.active ?? true)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        weekday,
        priority,
        duration_min: duration,
        project_id: projectId || null,
        active,
      }
      if (value) await updateRecurring(value.id, payload)
      else await addRecurring(payload)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={value ? 'Edit recurring task' : 'Add recurring task'}>
      <div className="space-y-4">
        <Field label="Task">
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Repeats on">
            <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className="w-full">
              {WEEKDAYS.map((w, i) => (
                <option key={w} value={i}>
                  {w}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Duration">
            <input
              type="number"
              min={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full"
            />
          </Field>
        </div>
        <Field label="Priority">
          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="w-full">
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </Field>
        <Field label="Project (optional)">
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full">
            <option value="">None</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-accent" />
          Active
        </label>
        <div className="flex gap-2">
          <button onClick={save} disabled={!name.trim() || saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : 'Save'}
          </button>
          {value && (
            <button
              onClick={async () => {
                await deleteRecurring(value.id)
                onClose()
              }}
              className="btn-ghost text-hi hover:bg-hi/10"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
