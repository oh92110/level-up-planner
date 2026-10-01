export type Priority = 'high' | 'medium' | 'low'

export type ProjectStatus =
  | 'not_started'
  | 'planning'
  | 'in_progress'
  | 'testing'
  | 'complete'
  | 'maintenance'

export type CommitmentKind = 'work' | 'training' | 'planning' | 'other'

export type TaskKind = 'one_off' | 'recurring_instance'

export interface Project {
  id: string
  user_id: string
  name: string
  description: string
  status: ProjectStatus
  priority: Priority
  deadline: string | null
  sort_order: number
  archived: boolean
  created_at: string
}

export interface Milestone {
  id: string
  user_id: string
  project_id: string
  name: string
  notes: string
  completed: boolean
  completed_at: string | null
  sort_order: number
  created_at: string
}

export interface Goal {
  id: string
  user_id: string
  name: string
  description: string
  target_date: string | null
  project_id: string | null
  achieved: boolean
  created_at: string
}

export interface Task {
  id: string
  user_id: string
  name: string
  notes: string
  priority: Priority
  due_date: string | null
  scheduled_date: string | null
  /** "HH:MM" — set once a task is dragged onto a specific slot; null means "sometime that day". */
  scheduled_time: string | null
  duration_min: number
  project_id: string | null
  milestone_id: string | null
  kind: TaskKind
  recurring_id: string | null
  completed: boolean
  completed_at: string | null
  deferred_count: number
  created_at: string
}

export interface RecurringTask {
  id: string
  user_id: string
  name: string
  notes: string
  priority: Priority
  duration_min: number
  weekday: number
  interval_weeks: number
  project_id: string | null
  active: boolean
  last_generated_for: string | null
  created_at: string
}

export interface Commitment {
  id: string
  user_id: string
  label: string
  weekday: number
  start_time: string | null
  end_time: string | null
  kind: CommitmentKind
  active: boolean
  created_at: string
}

export interface TheoryScore {
  id: string
  user_id: string
  taken_on: string
  score: number
  total: number
  hazard_score: number | null
  notes: string
  created_at: string
}

export interface WeeklyReview {
  id: string
  user_id: string
  week_start: string
  reflection: string
  next_week_focus: string
  completed_at: string
}

export interface Preferences {
  user_id: string
  wind_down_hour: number
  min_free_block_min: number
  protect_rest: boolean
  daily_priority_target: number
  updated_at: string
}

export const PRIORITY_META: Record<Priority, { dot: string; label: string; text: string; bg: string; rank: number }> = {
  high: { dot: '🔴', label: 'High', text: 'text-hi', bg: 'bg-hi/10 text-hi', rank: 0 },
  medium: { dot: '🟠', label: 'Medium', text: 'text-med', bg: 'bg-med/10 text-med', rank: 1 },
  low: { dot: '🟢', label: 'Low', text: 'text-lo', bg: 'bg-lo/10 text-lo', rank: 2 },
}

export const STATUS_META: Record<ProjectStatus, { label: string; bg: string }> = {
  not_started: { label: 'Not Started', bg: 'bg-ink-700 text-slate-300' },
  planning: { label: 'Planning', bg: 'bg-violet-500/15 text-violet-300' },
  in_progress: { label: 'In Progress', bg: 'bg-accent/15 text-accent-soft' },
  testing: { label: 'Testing', bg: 'bg-med/15 text-med' },
  complete: { label: 'Complete', bg: 'bg-lo/15 text-lo' },
  maintenance: { label: 'Maintenance', bg: 'bg-teal-500/15 text-teal-300' },
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
