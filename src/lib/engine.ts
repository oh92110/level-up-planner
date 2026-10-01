import { daysBetween, minutesOfDay, nowMinutes, today, weekdayOf } from './dates'
import type { Commitment, Milestone, Preferences, Priority, Project, Task } from './types'

const PRIORITY_WEIGHT: Record<Priority, number> = { high: 55, medium: 30, low: 12 }
const PROJECT_WEIGHT: Record<Priority, number> = { high: 18, medium: 9, low: 3 }

/** How much the deadline alone contributes. Ramps steeply inside a week. */
function deadlinePressure(dueDate: string | null, ref: string): number {
  if (!dueDate) return 0
  const d = daysBetween(ref, dueDate)
  if (d < 0) return 70 + Math.min(-d, 14) * 3
  if (d === 0) return 65
  if (d === 1) return 52
  if (d <= 3) return 40
  if (d <= 7) return 28
  if (d <= 14) return 16
  if (d <= 30) return 8
  if (d <= 90) return 4
  return 1
}

export interface ScoredTask {
  task: Task
  score: number
  reasons: string[]
}

export interface ScoreContext {
  ref: string
  projects: Project[]
  preferences: Preferences | null
}

export function scoreTask(task: Task, ctx: ScoreContext): ScoredTask {
  const reasons: string[] = []
  let score = PRIORITY_WEIGHT[task.priority]

  const pressure = deadlinePressure(task.due_date, ctx.ref)
  score += pressure
  if (task.due_date) {
    const d = daysBetween(ctx.ref, task.due_date)
    if (d < 0) reasons.push('Past its deadline')
    else if (d === 0) reasons.push('Deadline is today')
    else if (d <= 3) reasons.push(`Deadline in ${d} day${d === 1 ? '' : 's'}`)
    else if (d <= 14) reasons.push(`Deadline in ${d} days`)
  }

  if (task.scheduled_date === ctx.ref) {
    score += 22
    reasons.push('Scheduled for today')
  } else if (task.scheduled_date && task.scheduled_date < ctx.ref) {
    score += 18
    reasons.push('Was scheduled earlier and not done')
  }

  const project = ctx.projects.find((p) => p.id === task.project_id)
  if (project) {
    score += PROJECT_WEIGHT[project.priority]
    if (project.priority === 'high') reasons.push(`Moves ${project.name} forward`)
  }

  // Repeatedly pushed back — nudge it up so it stops rotting, but not forever.
  if (task.deferred_count > 0) {
    score += Math.min(task.deferred_count, 4) * 5
    if (task.deferred_count >= 3) reasons.push(`Put off ${task.deferred_count} times`)
  }

  // Small wins are cheap to bank.
  if (task.duration_min <= 20) {
    score += 6
    reasons.push('Quick win')
  }

  return { task, score, reasons }
}

export function rankTasks(tasks: Task[], ctx: ScoreContext): ScoredTask[] {
  return tasks
    .filter((t) => !t.completed)
    .map((t) => scoreTask(t, ctx))
    .sort((a, b) => b.score - a.score || a.task.duration_min - b.task.duration_min)
}

/** Tasks eligible to appear today: scheduled for today/earlier, due soon, or unscheduled but pressing. */
export function todayCandidates(tasks: Task[], ref = today()): Task[] {
  return tasks.filter((t) => {
    if (t.completed) return false
    if (t.scheduled_date && t.scheduled_date <= ref) return true
    if (t.scheduled_date && t.scheduled_date > ref) return false
    if (t.due_date && daysBetween(ref, t.due_date) <= 7) return true
    return false
  })
}

export function backlogTasks(tasks: Task[], ref = today()): Task[] {
  const inToday = new Set(todayCandidates(tasks, ref).map((t) => t.id))
  return tasks.filter((t) => !t.completed && !inToday.has(t.id))
}

// ---------------------------------------------------------------------------
// Free time
// ---------------------------------------------------------------------------

export interface FreeWindow {
  start: number
  end: number
}

const DAY_START = 6 * 60
const DEFAULT_WIND_DOWN = 21 * 60
/** Buffer after a commitment for travel, showering, eating. */
const COMMITMENT_BUFFER = 30

export function freeWindows(
  commitments: Commitment[],
  prefs: Preferences | null,
  opts: { fromMinute?: number } = {},
): FreeWindow[] {
  const windDown = (prefs?.wind_down_hour ?? 21) * 60 || DEFAULT_WIND_DOWN
  const minBlock = prefs?.min_free_block_min ?? 30
  const lower = Math.max(DAY_START, opts.fromMinute ?? DAY_START)

  const busy = commitments
    .filter((c) => c.active && c.start_time && c.end_time)
    .map((c) => ({
      start: minutesOfDay(c.start_time!) - COMMITMENT_BUFFER,
      end: minutesOfDay(c.end_time!) + COMMITMENT_BUFFER,
    }))
    .sort((a, b) => a.start - b.start)

  const merged: FreeWindow[] = []
  for (const b of busy) {
    const last = merged[merged.length - 1]
    if (last && b.start <= last.end) last.end = Math.max(last.end, b.end)
    else merged.push({ ...b })
  }

  const windows: FreeWindow[] = []
  let cursor = lower
  for (const b of merged) {
    if (b.start > cursor) windows.push({ start: cursor, end: Math.min(b.start, windDown) })
    cursor = Math.max(cursor, b.end)
  }
  if (cursor < windDown) windows.push({ start: cursor, end: windDown })

  return windows.filter((w) => w.end - w.start >= minBlock)
}

export function totalFreeMinutes(windows: FreeWindow[]): number {
  return windows.reduce((sum, w) => sum + (w.end - w.start), 0)
}

/** Free time still ahead of you right now. */
export function remainingFreeMinutes(commitments: Commitment[], prefs: Preferences | null): number {
  return totalFreeMinutes(freeWindows(commitments, prefs, { fromMinute: nowMinutes() }))
}

export function currentWindow(commitments: Commitment[], prefs: Preferences | null): FreeWindow | null {
  const now = nowMinutes()
  const windows = freeWindows(commitments, prefs, { fromMinute: now })
  const active = windows.find((w) => w.start <= now + 5 && w.end > now)
  return active ?? windows[0] ?? null
}

export function activeCommitmentNow(commitments: Commitment[]): Commitment | null {
  const now = nowMinutes()
  return (
    commitments.find(
      (c) =>
        c.active &&
        c.start_time &&
        c.end_time &&
        minutesOfDay(c.start_time) <= now &&
        minutesOfDay(c.end_time) > now,
    ) ?? null
  )
}

// ---------------------------------------------------------------------------
// "What should I do now?"
// ---------------------------------------------------------------------------

export type RecommendationKind = 'task' | 'commitment' | 'rest' | 'empty'

export interface Recommendation {
  kind: RecommendationKind
  headline: string
  detail: string
  task?: Task
  reasons: string[]
  availableMinutes: number
}

export function recommendNow(args: {
  tasks: Task[]
  projects: Project[]
  commitments: Commitment[]
  preferences: Preferences | null
  ref?: string
  /** Override available minutes, e.g. "I only have 20 minutes". */
  budgetOverride?: number | null
}): Recommendation {
  const ref = args.ref ?? today()
  const todaysCommitments = args.commitments.filter((c) => c.weekday === weekdayOf(ref) && c.active)

  const active = activeCommitmentNow(todaysCommitments)
  if (active && args.budgetOverride == null) {
    return {
      kind: 'commitment',
      headline: active.label,
      detail: `You're in a fixed commitment right now. Nothing else needs your attention until it's done.`,
      reasons: [],
      availableMinutes: 0,
    }
  }

  const window = currentWindow(todaysCommitments, args.preferences)
  const now = nowMinutes()
  const windDown = (args.preferences?.wind_down_hour ?? 21) * 60
  const naturalBudget = window ? Math.max(0, Math.min(window.end, windDown) - Math.max(window.start, now)) : 0
  const budget = args.budgetOverride ?? naturalBudget

  if (budget <= 0) {
    return {
      kind: 'rest',
      headline: 'Call it a day',
      detail: `It's past your wind-down time. Rest is part of the plan — pick this back up tomorrow.`,
      reasons: [],
      availableMinutes: 0,
    }
  }

  const candidates = todayCandidates(args.tasks, ref)
  const ranked = rankTasks(candidates, { ref, projects: args.projects, preferences: args.preferences })

  const fits = ranked.find((s) => s.task.duration_min <= budget)
  if (!fits) {
    const smallest = ranked[ranked.length - 1]
    if (!ranked.length) {
      return {
        kind: 'empty',
        headline: 'Nothing is pressing',
        detail: `You have ${formatMins(budget)} free and nothing urgent on today. Enjoy it, or pull something forward from a project.`,
        reasons: [],
        availableMinutes: budget,
      }
    }
    return {
      kind: 'rest',
      headline: 'Not enough time for the next real task',
      detail: `You have ${formatMins(budget)}. Your next task, "${smallest.task.name}", needs ${formatMins(
        smallest.task.duration_min,
      )}. Better to rest than start something you can't finish.`,
      reasons: [],
      availableMinutes: budget,
    }
  }

  return {
    kind: 'task',
    headline: fits.task.name,
    detail: `You have ${formatMins(budget)} available. This takes about ${formatMins(
      fits.task.duration_min,
    )}. Start it now.`,
    task: fits.task,
    reasons: fits.reasons,
    availableMinutes: budget,
  }
}

function formatMins(min: number): string {
  if (min < 60) return `${min} minutes`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} hour${h === 1 ? '' : 's'}` : `${h}h ${m}m`
}

// ---------------------------------------------------------------------------
// Project progress
// ---------------------------------------------------------------------------

export function projectProgress(project: Project, milestones: Milestone[]): number {
  if (project.status === 'complete') return 100
  const mine = milestones.filter((m) => m.project_id === project.id)
  if (!mine.length) return project.status === 'not_started' ? 0 : 10
  return Math.round((mine.filter((m) => m.completed).length / mine.length) * 100)
}

export function currentMilestone(project: Project, milestones: Milestone[]): Milestone | null {
  return (
    milestones
      .filter((m) => m.project_id === project.id && !m.completed)
      .sort((a, b) => a.sort_order - b.sort_order)[0] ?? null
  )
}

export function nextActionFor(project: Project, tasks: Task[], milestones: Milestone[]): Task | null {
  const open = tasks.filter((t) => !t.completed && t.project_id === project.id)
  if (!open.length) return null
  const milestone = currentMilestone(project, milestones)
  const onMilestone = milestone ? open.filter((t) => t.milestone_id === milestone.id) : []
  const pool = onMilestone.length ? onMilestone : open
  return pool.sort(
    (a, b) =>
      PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] ||
      (a.scheduled_date ?? '9999').localeCompare(b.scheduled_date ?? '9999'),
  )[0]
}

// ---------------------------------------------------------------------------
// Day schedule — the day as a short list of real blocks, not an hour grid
// ---------------------------------------------------------------------------

function subtractRange(windows: FreeWindow[], range: FreeWindow): FreeWindow[] {
  const result: FreeWindow[] = []
  for (const w of windows) {
    if (range.end <= w.start || range.start >= w.end) {
      result.push(w)
      continue
    }
    if (range.start > w.start) result.push({ start: w.start, end: Math.min(range.start, w.end) })
    if (range.end < w.end) result.push({ start: Math.max(range.end, w.start), end: w.end })
  }
  return result.filter((w) => w.end > w.start)
}

export interface PlacedTask {
  task: Task
  start: number
  /** true when the user dragged it to this exact time; false when we suggested it. */
  pinned: boolean
}

export interface DaySegment {
  kind: 'commitment' | 'free'
  start: number
  end: number
  commitment?: Commitment
  tasks: PlacedTask[]
}

export interface DaySchedule {
  /** Commitments with no set time — "10K run", "Rest day". Shown as chips, not blocks. */
  anytime: Commitment[]
  segments: DaySegment[]
  /** Open tasks with nowhere left to go today. */
  overflow: Task[]
  done: Task[]
}

/**
 * Builds the day as an ordered list of only the blocks that actually exist:
 * fixed commitments at their real times, and the free windows between them.
 * Pinned tasks (dragged to a time) hold their slot; the rest are packed into
 * what's left in priority order as a suggestion.
 */
export function daySchedule(
  date: string,
  commitments: Commitment[],
  tasks: Task[],
  projects: Project[],
  preferences: Preferences | null,
): DaySchedule {
  const wd = weekdayOf(date)
  const dayCommitments = commitments.filter((c) => c.weekday === wd && c.active)
  const anytime = dayCommitments.filter((c) => !c.start_time || !c.end_time)
  const timed = dayCommitments.filter((c) => c.start_time && c.end_time)

  const dayTasks = tasks.filter((t) => t.scheduled_date === date)
  const done = dayTasks.filter((t) => t.completed)
  const open = dayTasks.filter((t) => !t.completed)

  const segments: DaySegment[] = [
    ...timed.map((c) => ({
      kind: 'commitment' as const,
      start: minutesOfDay(c.start_time!),
      end: minutesOfDay(c.end_time!),
      commitment: c,
      tasks: [] as PlacedTask[],
    })),
    ...freeWindows(dayCommitments, preferences).map((w) => ({
      kind: 'free' as const,
      start: w.start,
      end: w.end,
      tasks: [] as PlacedTask[],
    })),
  ].sort((a, b) => a.start - b.start || (a.kind === 'commitment' ? -1 : 1))

  const overflow: Task[] = []

  for (const t of open.filter((t) => t.scheduled_time)) {
    const start = minutesOfDay(t.scheduled_time!)
    const seg = segments.find((s) => start >= s.start && start < s.end)
    if (seg) seg.tasks.push({ task: t, start, pinned: true })
    else overflow.push(t)
  }

  // Remaining capacity per free segment, after pinned tasks have taken their slots.
  const caps = segments
    .filter((s) => s.kind === 'free')
    .map((seg) => {
      let free: FreeWindow[] = [{ start: seg.start, end: seg.end }]
      for (const p of seg.tasks) free = subtractRange(free, { start: p.start, end: p.start + p.task.duration_min })
      return { seg, free }
    })

  for (const { task } of rankTasks(open.filter((t) => !t.scheduled_time), { ref: date, projects, preferences })) {
    const cap = caps.find((c) => c.free.some((f) => f.end - f.start >= task.duration_min))
    if (!cap) {
      overflow.push(task)
      continue
    }
    const slot = cap.free.find((f) => f.end - f.start >= task.duration_min)!
    cap.seg.tasks.push({ task, start: slot.start, pinned: false })
    cap.free = subtractRange(cap.free, { start: slot.start, end: slot.start + task.duration_min })
  }

  for (const s of segments) s.tasks.sort((a, b) => a.start - b.start)
  return { anytime, segments, overflow, done }
}

/**
 * Where a task should land when dropped on a free window: the first gap inside
 * it that fits, so dropping two tasks on the same window stacks them instead of
 * overlapping. Returns minutes-of-day.
 */
export function slotForDrop(args: {
  date: string
  windowStart: number
  task: Task
  tasks: Task[]
  commitments: Commitment[]
  preferences: Preferences | null
}): number {
  const { date, windowStart, task, tasks, commitments, preferences } = args
  const wd = weekdayOf(date)
  const dayCommitments = commitments.filter((c) => c.weekday === wd && c.active)
  const window = freeWindows(dayCommitments, preferences).find((w) => w.start === windowStart)
  if (!window) return windowStart

  let free: FreeWindow[] = [{ ...window }]
  for (const t of tasks) {
    if (t.id === task.id || t.completed || t.scheduled_date !== date || !t.scheduled_time) continue
    const s = minutesOfDay(t.scheduled_time)
    free = subtractRange(free, { start: s, end: s + t.duration_min })
  }

  return (free.find((f) => f.end - f.start >= task.duration_min) ?? free[0] ?? window).start
}

/** Tasks that slipped: scheduled before today, or past due, still open. */
export function missedTasks(tasks: Task[], ref = today()): Task[] {
  return tasks.filter(
    (t) =>
      !t.completed &&
      ((t.scheduled_date != null && t.scheduled_date < ref) ||
        (t.due_date != null && t.due_date < ref)),
  )
}
