import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { Card, Field, ProgressBar, SectionHeading } from '../components/ui'
import { projectProgress } from '../lib/engine'
import { addDays, formatShort, today, weekStart } from '../lib/dates'
import { PRIORITY_META } from '../lib/types'

export function WeeklyReview({ onClose }: { onClose: () => void }) {
  const { tasks, projects, milestones, commitments, saveReview, reviews } = useStore()
  const ref = today()
  const thisWeekStart = weekStart(ref)
  const lastWeekStart = addDays(thisWeekStart, -7)
  const lastWeekEnd = addDays(thisWeekStart, -1)

  const existing = reviews.find((r) => r.week_start === thisWeekStart)
  const [reflection, setReflection] = useState(existing?.reflection ?? '')
  const [focus, setFocus] = useState(existing?.next_week_focus ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const completed = useMemo(
    () =>
      tasks.filter(
        (t) => t.completed && t.completed_at && t.completed_at.slice(0, 10) >= lastWeekStart && t.completed_at.slice(0, 10) <= lastWeekEnd,
      ),
    [tasks, lastWeekStart, lastWeekEnd],
  )
  const missed = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !t.completed &&
          t.scheduled_date &&
          t.scheduled_date >= lastWeekStart &&
          t.scheduled_date <= lastWeekEnd,
      ),
    [tasks, lastWeekStart, lastWeekEnd],
  )

  const activeProjects = projects.filter((p) => !p.archived && p.status !== 'complete')
  const upcomingCommitments = commitments.filter((c) => c.active).slice(0, 6)

  async function finish() {
    setSaving(true)
    try {
      await saveReview({ week_start: thisWeekStart, reflection, next_week_focus: focus })
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink-950 overflow-y-auto">
      <div className="max-w-xl mx-auto px-4 py-8 pb-20">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-slate-100">Weekly review</h1>
          <button onClick={onClose} className="btn-quiet px-2 py-1">
            ✕
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          {formatShort(lastWeekStart)} – {formatShort(lastWeekEnd)}
        </p>

        <div className="mb-5">
          <SectionHeading title={`Completed (${completed.length})`} />
          <Card className="!p-2">
            {completed.length === 0 ? (
              <p className="text-xs text-slate-600 p-3">Nothing marked done last week.</p>
            ) : (
              <ul className="divide-y divide-ink-800/60">
                {completed.map((t) => (
                  <li key={t.id} className="text-sm text-slate-300 px-2 py-2 flex items-center gap-2">
                    <span>{PRIORITY_META[t.priority].dot}</span>
                    {t.name}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="mb-5">
          <SectionHeading title={`Missed (${missed.length})`} />
          <Card className="!p-2">
            {missed.length === 0 ? (
              <p className="text-xs text-slate-600 p-3">Nothing slipped. Clean week.</p>
            ) : (
              <ul className="divide-y divide-ink-800/60">
                {missed.map((t) => (
                  <li key={t.id} className="text-sm text-slate-400 px-2 py-2">
                    {t.name}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {missed.length > 0 && (
            <p className="text-xs text-slate-500 mt-2">
              These will prompt you individually from the Today screen — reschedule, shrink, deprioritise or drop
              each one.
            </p>
          )}
        </div>

        <div className="mb-5">
          <SectionHeading title="Project progress" />
          <div className="space-y-2">
            {activeProjects.map((p) => (
              <Card key={p.id} className="!p-3">
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-slate-200">{p.name}</span>
                  <span className="text-xs text-slate-500">{projectProgress(p, milestones)}%</span>
                </div>
                <ProgressBar value={projectProgress(p, milestones)} />
              </Card>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <SectionHeading title="Coming up this week" />
          <Card>
            <div className="flex flex-wrap gap-1.5">
              {upcomingCommitments.map((c) => (
                <span key={c.id} className="chip bg-ink-800 text-slate-400 text-[11px]">
                  {c.label}
                </span>
              ))}
            </div>
          </Card>
        </div>

        <div className="mb-5">
          <Field label="What are the 3–5 things that matter most next week?">
            <textarea
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              rows={4}
              placeholder="Keep it short — this is what Today will lean on."
              className="w-full resize-none"
            />
          </Field>
        </div>

        <div className="mb-6">
          <Field label="Anything else worth remembering (optional)">
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              rows={3}
              className="w-full resize-none"
            />
          </Field>
        </div>

        {saved ? (
          <div className="text-center">
            <p className="text-sm text-lo mb-3">Review saved.</p>
            <button onClick={onClose} className="btn-primary w-full">
              Back to Today
            </button>
          </div>
        ) : (
          <button onClick={finish} disabled={saving} className="btn-primary w-full">
            {saving ? 'Saving…' : 'Finish review'}
          </button>
        )}
      </div>
    </div>
  )
}
