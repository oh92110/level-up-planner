import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../store'
import { AnimatedNumber, Card, Empty, Field, Modal, ProgressBar, SectionHeading, Stat } from '../components/ui'
import { useToast } from '../components/Toast'
import { projectProgress } from '../lib/engine'
import { addDays, formatShort, today, weekStart } from '../lib/dates'
import { STATUS_META } from '../lib/types'

export function Progress() {
  const { tasks, projects, milestones, scores, reviews } = useStore()
  const [showScore, setShowScore] = useState(false)

  const ref = today()
  const wStart = weekStart(ref)
  const doneThisWeek = tasks.filter((t) => t.completed && t.completed_at && t.completed_at.slice(0, 10) >= wStart)
  const doneAllTime = tasks.filter((t) => t.completed).length
  const last7 = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(ref, i - 6)
      const count = tasks.filter((t) => t.completed && t.completed_at?.slice(0, 10) === date).length
      return { date, count }
    })
  }, [tasks, ref])
  const maxCount = Math.max(1, ...last7.map((d) => d.count))

  const activeProjects = projects.filter((p) => !p.archived)

  const theoryProject = projects.find((p) => p.name.toLowerCase().includes('theory'))
  const sortedScores = [...scores].sort((a, b) => (a.taken_on < b.taken_on ? -1 : 1))
  const latestScore = sortedScores[sortedScores.length - 1]
  const bestScore = sortedScores.reduce<typeof sortedScores[number] | null>(
    (best, s) => (!best || s.score / s.total > best.score / best.total ? s : best),
    null,
  )

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-0 pb-8">
      <header className="pt-6 pb-4">
        <h1 className="text-xl font-bold text-slate-100">Progress</h1>
        <p className="text-sm text-slate-500 mt-0.5">Are things actually moving?</p>
      </header>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <Stat label="Done this week" value={<AnimatedNumber value={doneThisWeek.length} />} />
        <Stat label="Done all-time" value={<AnimatedNumber value={doneAllTime} />} />
      </div>

      <div className="mb-6">
        <SectionHeading title="Last 7 days" />
        <Card>
          <div className="flex items-end justify-between gap-2 h-24">
            {last7.map((d, i) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full flex-1 flex items-end">
                  <motion.div
                    className="w-full rounded-md bg-accent/70"
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(4, (d.count / maxCount) * 100)}%` }}
                    transition={{ type: 'spring', stiffness: 200, damping: 22, delay: i * 0.04 }}
                    title={`${d.count} completed`}
                  />
                </div>
                <span className="text-[10px] text-slate-600">{formatShort(d.date).split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mb-6">
        <SectionHeading title="Project progress" />
        <div className="space-y-2.5">
          {activeProjects.map((p) => {
            const progress = projectProgress(p, milestones)
            return (
              <Card key={p.id} className="!p-3.5">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="text-sm text-slate-200 truncate">{p.name}</span>
                  <span className={`chip text-[10px] shrink-0 ${STATUS_META[p.status].bg}`}>
                    {STATUS_META[p.status].label}
                  </span>
                </div>
                <ProgressBar value={progress} tone={progress === 100 ? 'good' : 'accent'} />
              </Card>
            )
          })}
        </div>
      </div>

      {theoryProject && (
        <div className="mb-6">
          <SectionHeading
            title="Theory test scores"
            action={
              <button onClick={() => setShowScore(true)} className="btn-quiet text-xs px-2 py-1">
                + Log score
              </button>
            }
          />
          <Card>
            {sortedScores.length === 0 ? (
              <Empty icon="🚗" text="Log a practice test score to start tracking progress." />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <p className="text-[11px] text-slate-500">Latest</p>
                    <p className="text-lg font-semibold text-slate-100">
                      {latestScore.score}/{latestScore.total}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">Best</p>
                    <p className="text-lg font-semibold text-slate-100">
                      {bestScore!.score}/{bestScore!.total}
                    </p>
                  </div>
                </div>
                <div className="flex items-end gap-1.5 h-16">
                  {sortedScores.slice(-14).map((s, i) => (
                    <motion.div
                      key={s.id}
                      className="flex-1 rounded bg-accent/70"
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(6, (s.score / s.total) * 100)}%` }}
                      transition={{ type: 'spring', stiffness: 200, damping: 22, delay: i * 0.03 }}
                      title={`${formatShort(s.taken_on)}: ${s.score}/${s.total}`}
                    />
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {reviews.length > 0 && (
        <div>
          <SectionHeading title="Weekly review history" />
          <div className="space-y-2.5">
            {[...reviews]
              .sort((a, b) => (a.week_start < b.week_start ? 1 : -1))
              .map((r) => (
                <Card key={r.id} className="!p-3.5">
                  <p className="text-xs text-slate-500 mb-1.5">Week of {formatShort(r.week_start)}</p>
                  {r.next_week_focus && <p className="text-sm text-slate-300">{r.next_week_focus}</p>}
                </Card>
              ))}
          </div>
        </div>
      )}

      <ScoreForm open={showScore} onClose={() => setShowScore(false)} />
    </div>
  )
}

function ScoreForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addScore } = useStore()
  const toast = useToast()
  const [score, setScore] = useState(43)
  const [total, setTotal] = useState(50)
  const [hazard, setHazard] = useState(50)
  const [date, setDate] = useState(today())
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await addScore({ score, total, hazard_score: hazard, taken_on: date })
      toast(`Score logged: ${score}/${total}`, 'success')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Log a practice test score">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Score">
            <input type="number" value={score} onChange={(e) => setScore(Number(e.target.value))} className="w-full" />
          </Field>
          <Field label="Out of">
            <input type="number" value={total} onChange={(e) => setTotal(Number(e.target.value))} className="w-full" />
          </Field>
        </div>
        <Field label="Hazard perception score (out of 75, optional)">
          <input type="number" value={hazard} onChange={(e) => setHazard(Number(e.target.value))} className="w-full" />
        </Field>
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full" />
        </Field>
        <button onClick={save} disabled={saving} className="btn-primary w-full">
          {saving ? 'Saving…' : 'Save score'}
        </button>
      </div>
    </Modal>
  )
}
