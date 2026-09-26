import { useState } from 'react'
import { useStore } from '../store'
import { Card, Empty, Field, Modal, PriorityChip, ProgressBar, SectionHeading } from '../components/ui'
import { TaskForm } from '../components/TaskForm'
import { currentMilestone, nextActionFor, projectProgress } from '../lib/engine'
import { relativeDue } from '../lib/dates'
import { STATUS_META } from '../lib/types'
import type { Milestone, Priority, Project, ProjectStatus } from '../lib/types'

export function Projects() {
  const { projects } = useStore()
  const [showAdd, setShowAdd] = useState(false)
  const [open, setOpen] = useState<Project | null>(null)

  const active = projects.filter((p) => !p.archived).sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-0 pb-8">
      <header className="pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Projects</h1>
          <p className="text-sm text-slate-500 mt-0.5">Every big goal, broken into a next actionable step.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm">
          + Project
        </button>
      </header>

      {active.length === 0 ? (
        <Empty icon="🚀" text="No projects yet. Add one to break a big goal into milestones." />
      ) : (
        <div className="space-y-3">
          {active.map((p) => (
            <ProjectCard key={p.id} project={p} onOpen={() => setOpen(p)} />
          ))}
        </div>
      )}

      <ProjectEditor open={showAdd} onClose={() => setShowAdd(false)} />
      {open && <ProjectDetail project={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const { milestones, tasks } = useStore()
  const mine = milestones.filter((m) => m.project_id === project.id)
  const progress = projectProgress(project, mine)
  const milestone = currentMilestone(project, mine)
  const next = nextActionFor(project, tasks, mine)
  const due = relativeDue(project.deadline)

  return (
    <button onClick={onOpen} className="w-full text-left">
      <Card className="hover:border-ink-600 transition-colors">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-100 truncate">{project.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{project.description}</p>
          </div>
          <span className={`chip shrink-0 text-[11px] ${STATUS_META[project.status].bg}`}>
            {STATUS_META[project.status].label}
          </span>
        </div>

        <ProgressBar value={progress} className="my-3" />

        <div className="flex items-center justify-between text-xs">
          <div className="min-w-0 flex-1">
            {next ? (
              <p className="text-slate-400 truncate">
                <span className="text-slate-600">Next: </span>
                {next.name}
              </p>
            ) : milestone ? (
              <p className="text-slate-400 truncate">
                <span className="text-slate-600">Milestone: </span>
                {milestone.name}
              </p>
            ) : (
              <p className="text-slate-600">No open actions</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <PriorityChip priority={project.priority} compact />
            {due && <span className="text-slate-500">{due.text}</span>}
          </div>
        </div>
      </Card>
    </button>
  )
}

function ProjectDetail({ project, onClose }: { project: Project; onClose: () => void }) {
  const { milestones, tasks, addMilestone, updateMilestone, deleteMilestone, deleteProject } = useStore()
  const [newMilestone, setNewMilestone] = useState('')
  const [editing, setEditing] = useState(false)
  const [addTaskFor, setAddTaskFor] = useState<{ milestoneId?: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const mine = milestones.filter((m) => m.project_id === project.id).sort((a, b) => a.sort_order - b.sort_order)
  const progress = projectProgress(project, mine)
  const projectTasks = tasks.filter((t) => t.project_id === project.id && !t.completed)

  async function addMs() {
    if (!newMilestone.trim()) return
    await addMilestone({ project_id: project.id, name: newMilestone.trim() })
    setNewMilestone('')
  }

  return (
    <Modal open onClose={onClose} title={project.name} wide>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">{project.description}</p>
          <button onClick={() => setEditing(true)} className="btn-quiet text-xs shrink-0 ml-3">
            Edit
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="section-title">Progress</span>
            <span className="text-xs text-slate-400">{progress}%</span>
          </div>
          <ProgressBar value={progress} />
        </div>

        <div>
          <SectionHeading title="Milestones" />
          <div className="space-y-1.5">
            {mine.map((m) => (
              <MilestoneRow
                key={m.id}
                milestone={m}
                taskCount={tasks.filter((t) => t.milestone_id === m.id && !t.completed).length}
                onToggle={() => updateMilestone(m.id, { completed: !m.completed })}
                onDelete={() => deleteMilestone(m.id)}
                onAddTask={() => setAddTaskFor({ milestoneId: m.id })}
              />
            ))}
          </div>
          <div className="flex gap-2 mt-2.5">
            <input
              value={newMilestone}
              onChange={(e) => setNewMilestone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addMs()}
              placeholder="Add a milestone"
              className="flex-1 text-sm"
            />
            <button onClick={addMs} className="btn-ghost text-xs">
              Add
            </button>
          </div>
        </div>

        <div>
          <SectionHeading
            title="Open tasks"
            action={
              <button onClick={() => setAddTaskFor({})} className="btn-quiet text-xs px-2 py-1">
                + Add task
              </button>
            }
          />
          {projectTasks.length === 0 ? (
            <p className="text-xs text-slate-600">No open tasks. Add the next actionable step.</p>
          ) : (
            <ul className="space-y-1.5">
              {projectTasks.map((t) => (
                <li key={t.id} className="text-sm text-slate-300 flex items-center gap-2">
                  <PriorityChip priority={t.priority} compact />
                  {t.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {confirmDelete ? (
          <div className="rounded-lg border border-hi/30 bg-hi/5 p-3 space-y-2.5">
            <p className="text-xs text-slate-300">
              Delete "{project.name}" and all its milestones? Tasks will be kept but unlinked.
            </p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  await deleteProject(project.id)
                  onClose()
                }}
                className="btn-ghost text-xs text-hi hover:bg-hi/10 flex-1"
              >
                Yes, delete it
              </button>
              <button onClick={() => setConfirmDelete(false)} className="btn-ghost text-xs flex-1">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="btn-ghost text-xs text-hi hover:bg-hi/10">
            Delete project
          </button>
        )}
      </div>

      <ProjectEditor open={editing} onClose={() => setEditing(false)} project={project} />
      <TaskForm
        open={addTaskFor !== null}
        onClose={() => setAddTaskFor(null)}
        defaults={{ project_id: project.id, milestone_id: addTaskFor?.milestoneId ?? '' }}
      />
    </Modal>
  )
}

function MilestoneRow({
  milestone,
  taskCount,
  onToggle,
  onDelete,
  onAddTask,
}: {
  milestone: Milestone
  taskCount: number
  onToggle: () => void
  onDelete: () => void
  onAddTask: () => void
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-ink-850 group">
      <button
        onClick={onToggle}
        className={`h-[18px] w-[18px] shrink-0 rounded-full border-2 flex items-center justify-center ${
          milestone.completed ? 'bg-lo border-lo' : 'border-ink-600'
        }`}
        aria-label={milestone.completed ? 'Mark not done' : 'Mark done'}
      >
        {milestone.completed && (
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-ink-950" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M2 6.5 4.5 9 10 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <span className={`flex-1 text-sm ${milestone.completed ? 'line-through text-slate-600' : 'text-slate-200'}`}>
        {milestone.name}
      </span>
      {taskCount > 0 && <span className="text-[11px] text-slate-500">{taskCount} open</span>}
      <button onClick={onAddTask} className="btn-quiet text-xs px-1.5 py-0.5 opacity-0 group-hover:opacity-100">
        + task
      </button>
      <button
        onClick={onDelete}
        className="btn-quiet text-xs px-1.5 py-0.5 text-hi opacity-0 group-hover:opacity-100"
      >
        ✕
      </button>
    </div>
  )
}

const STATUSES: ProjectStatus[] = ['not_started', 'planning', 'in_progress', 'testing', 'complete', 'maintenance']

function ProjectEditor({ open, onClose, project }: { open: boolean; onClose: () => void; project?: Project }) {
  const { addProject, updateProject } = useStore()
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'not_started')
  const [priority, setPriority] = useState<Priority>(project?.priority ?? 'medium')
  const [deadline, setDeadline] = useState(project?.deadline ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const payload = { name: name.trim(), description, status, priority, deadline: deadline || null }
      if (project) await updateProject(project.id, payload)
      else await addProject(payload)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={project ? 'Edit project' : 'New project'}>
      <div className="space-y-4">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full" autoFocus />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full resize-none"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} className="w-full">
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="w-full">
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </Field>
        </div>
        <Field label="Deadline (optional)">
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full" />
        </Field>
        <button onClick={save} disabled={!name.trim() || saving} className="btn-primary w-full">
          {saving ? 'Saving…' : project ? 'Save changes' : 'Create project'}
        </button>
      </div>
    </Modal>
  )
}
