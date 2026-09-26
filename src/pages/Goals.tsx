import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { Card, Empty, Field, Modal, ProgressBar, SectionHeading } from '../components/ui'
import { useToast } from '../components/Toast'
import { projectProgress } from '../lib/engine'
import { relativeDue } from '../lib/dates'
import type { Goal } from '../lib/types'

export function Goals() {
  const { goals, projects, milestones, updateGoal, deleteGoal } = useStore()
  const toast = useToast()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)

  const open = goals.filter((g) => !g.achieved)
  const achieved = goals.filter((g) => g.achieved)

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-0 pb-8">
      <header className="pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Goals</h1>
          <p className="text-sm text-slate-500 mt-0.5">The bigger picture behind the daily tasks.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm">
          + Goal
        </button>
      </header>

      {open.length === 0 ? (
        <Empty icon="🎯" text="No goals yet. Add one — every task and project should trace back to something here." />
      ) : (
        <motion.div
          className="space-y-3"
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.05 } } }}
        >
          <AnimatePresence>
            {open.map((g) => {
            const project = projects.find((p) => p.id === g.project_id)
            const progress = project ? projectProgress(project, milestones) : null
            const due = relativeDue(g.target_date)
            return (
              <motion.div
                key={g.id}
                layout
                variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              >
              <Card className="cursor-pointer" hoverable>
                <div onClick={() => setEditing(g)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-100">{g.name}</h3>
                      {g.description && <p className="text-xs text-slate-500 mt-1">{g.description}</p>}
                    </div>
                    {due && (
                      <span className={`text-xs shrink-0 ${due.tone === 'urgent' || due.tone === 'over' ? 'text-hi' : 'text-slate-500'}`}>
                        {due.text}
                      </span>
                    )}
                  </div>
                  {project && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                        <span>via {project.name}</span>
                        <span>{progress}%</span>
                      </div>
                      <ProgressBar value={progress ?? 0} />
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-ink-800">
                  <button
                    onClick={() => {
                      updateGoal(g.id, { achieved: true })
                      toast(`🎉 Goal achieved: ${g.name}`, 'success')
                    }}
                    className="btn-ghost text-xs flex-1"
                  >
                    Mark achieved
                  </button>
                  <button
                    onClick={() => {
                      deleteGoal(g.id)
                      toast('Goal deleted')
                    }}
                    className="btn-ghost text-xs text-hi hover:bg-hi/10"
                  >
                    Delete
                  </button>
                </div>
              </Card>
              </motion.div>
            )
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {achieved.length > 0 && (
        <div className="mt-6">
          <SectionHeading title={`Achieved (${achieved.length})`} />
          <div className="space-y-2">
            {achieved.map((g) => (
              <Card key={g.id} className="!p-3 opacity-60">
                <p className="text-sm text-slate-300 line-through">{g.name}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      <GoalEditor open={showAdd} onClose={() => setShowAdd(false)} />
      {editing && <GoalEditor open onClose={() => setEditing(null)} goal={editing} />}
    </div>
  )
}

function GoalEditor({ open, onClose, goal }: { open: boolean; onClose: () => void; goal?: Goal }) {
  const { addGoal, updateGoal, projects } = useStore()
  const toast = useToast()
  const [name, setName] = useState(goal?.name ?? '')
  const [description, setDescription] = useState(goal?.description ?? '')
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? '')
  const [projectId, setProjectId] = useState(goal?.project_id ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description,
        target_date: targetDate || null,
        project_id: projectId || null,
      }
      if (goal) {
        await updateGoal(goal.id, payload)
        toast('Goal updated', 'success')
      } else {
        await addGoal(payload)
        toast('Goal added', 'success')
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={goal ? 'Edit goal' : 'New goal'}>
      <div className="space-y-4">
        <Field label="Goal">
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full" autoFocus />
        </Field>
        <Field label="Why it matters">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full resize-none"
          />
        </Field>
        <Field label="Target date (optional)">
          <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="w-full" />
        </Field>
        <Field label="Linked project (optional)">
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full">
            <option value="">None</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <button onClick={save} disabled={!name.trim() || saving} className="btn-primary w-full">
          {saving ? 'Saving…' : goal ? 'Save changes' : 'Add goal'}
        </button>
      </div>
    </Modal>
  )
}
