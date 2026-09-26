import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { hasSeedData, seedForUser } from './lib/seed'
import { addDays, today, weekStart } from './lib/dates'
import type {
  Commitment,
  Goal,
  Milestone,
  Preferences,
  Project,
  RecurringTask,
  Task,
  TheoryScore,
  WeeklyReview,
} from './lib/types'

interface Data {
  tasks: Task[]
  projects: Project[]
  milestones: Milestone[]
  goals: Goal[]
  commitments: Commitment[]
  recurring: RecurringTask[]
  scores: TheoryScore[]
  reviews: WeeklyReview[]
  preferences: Preferences | null
}

const EMPTY: Data = {
  tasks: [],
  projects: [],
  milestones: [],
  goals: [],
  commitments: [],
  recurring: [],
  scores: [],
  reviews: [],
  preferences: null,
}

interface StoreValue extends Data {
  session: Session | null
  loading: boolean
  ready: boolean
  refresh: () => Promise<void>

  addTask: (t: Partial<Task>) => Promise<void>
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  toggleTask: (task: Task) => Promise<void>

  addProject: (p: Partial<Project>) => Promise<void>
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>

  addMilestone: (m: Partial<Milestone>) => Promise<void>
  updateMilestone: (id: string, patch: Partial<Milestone>) => Promise<void>
  deleteMilestone: (id: string) => Promise<void>

  addGoal: (g: Partial<Goal>) => Promise<void>
  updateGoal: (id: string, patch: Partial<Goal>) => Promise<void>
  deleteGoal: (id: string) => Promise<void>

  addCommitment: (c: Partial<Commitment>) => Promise<void>
  updateCommitment: (id: string, patch: Partial<Commitment>) => Promise<void>
  deleteCommitment: (id: string) => Promise<void>

  addRecurring: (r: Partial<RecurringTask>) => Promise<void>
  updateRecurring: (id: string, patch: Partial<RecurringTask>) => Promise<void>
  deleteRecurring: (id: string) => Promise<void>

  addScore: (s: Partial<TheoryScore>) => Promise<void>
  deleteScore: (id: string) => Promise<void>

  saveReview: (r: { week_start: string; reflection: string; next_week_focus: string }) => Promise<void>
  updatePreferences: (patch: Partial<Preferences>) => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [data, setData] = useState<Data>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (!session) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) {
        setData(EMPTY)
        setReady(false)
        setLoading(false)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  const fetchAll = useCallback(async (): Promise<Data> => {
    const [tasks, projects, milestones, goals, commitments, recurring, scores, reviews, prefs] =
      await Promise.all([
        supabase.from('tasks').select('*').order('created_at'),
        supabase.from('projects').select('*').order('sort_order'),
        supabase.from('milestones').select('*').order('sort_order'),
        supabase.from('goals').select('*').order('created_at'),
        supabase.from('commitments').select('*').order('weekday').order('start_time', { nullsFirst: false }),
        supabase.from('recurring_tasks').select('*').order('weekday'),
        supabase.from('theory_scores').select('*').order('taken_on'),
        supabase.from('weekly_reviews').select('*').order('week_start'),
        supabase.from('preferences').select('*').maybeSingle(),
      ])
    return {
      tasks: (tasks.data ?? []) as Task[],
      projects: (projects.data ?? []) as Project[],
      milestones: (milestones.data ?? []) as Milestone[],
      goals: (goals.data ?? []) as Goal[],
      commitments: (commitments.data ?? []) as Commitment[],
      recurring: (recurring.data ?? []) as RecurringTask[],
      scores: (scores.data ?? []) as TheoryScore[],
      reviews: (reviews.data ?? []) as WeeklyReview[],
      preferences: (prefs.data ?? null) as Preferences | null,
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!userId) return
    setData(await fetchAll())
  }, [userId, fetchAll])

  // Initial load: seed on first run, then generate any missing recurring instances.
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        if (!(await hasSeedData(userId))) await seedForUser(userId)
        let fresh = await fetchAll()
        if (!fresh.preferences) {
          await supabase.from('preferences').upsert({ user_id: userId })
          fresh = await fetchAll()
        }
        const created = await generateRecurring(userId, fresh.recurring, fresh.tasks)
        if (created) fresh = await fetchAll()
        if (!cancelled) {
          setData(fresh)
          setReady(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, fetchAll])

  const mutate = useCallback(
    async (fn: () => PromiseLike<{ error: unknown }>) => {
      const result = await fn()
      if (result.error) {
        console.error(result.error)
        throw result.error
      }
      await refresh()
    },
    [refresh],
  )

  const value = useMemo<StoreValue>(() => {
    const uid = userId ?? ''
    return {
      ...data,
      session,
      loading,
      ready,
      refresh,

      addTask: (t) => mutate(() => supabase.from('tasks').insert({ ...t, user_id: uid })),
      updateTask: (id, patch) => mutate(() => supabase.from('tasks').update(patch).eq('id', id)),
      deleteTask: (id) => mutate(() => supabase.from('tasks').delete().eq('id', id)),
      toggleTask: async (task) => {
        const nowDone = !task.completed
        await supabase
          .from('tasks')
          .update({ completed: nowDone, completed_at: nowDone ? new Date().toISOString() : null })
          .eq('id', task.id)
        if (nowDone && task.recurring_id) {
          const fresh = await fetchAll()
          await generateRecurring(uid, fresh.recurring, fresh.tasks)
        }
        await refresh()
      },

      addProject: (p) =>
        mutate(() =>
          supabase
            .from('projects')
            .insert({ ...p, user_id: uid, sort_order: data.projects.length }),
        ),
      updateProject: (id, patch) => mutate(() => supabase.from('projects').update(patch).eq('id', id)),
      deleteProject: (id) => mutate(() => supabase.from('projects').delete().eq('id', id)),

      addMilestone: (m) =>
        mutate(() =>
          supabase
            .from('milestones')
            .insert({
              ...m,
              user_id: uid,
              sort_order: data.milestones.filter((x) => x.project_id === m.project_id).length,
            }),
        ),
      updateMilestone: (id, patch) =>
        mutate(() =>
          supabase
            .from('milestones')
            .update({
              ...patch,
              ...(patch.completed !== undefined
                ? { completed_at: patch.completed ? new Date().toISOString() : null }
                : {}),
            })
            .eq('id', id),
        ),
      deleteMilestone: (id) => mutate(() => supabase.from('milestones').delete().eq('id', id)),

      addGoal: (g) => mutate(() => supabase.from('goals').insert({ ...g, user_id: uid })),
      updateGoal: (id, patch) => mutate(() => supabase.from('goals').update(patch).eq('id', id)),
      deleteGoal: (id) => mutate(() => supabase.from('goals').delete().eq('id', id)),

      addCommitment: (c) => mutate(() => supabase.from('commitments').insert({ ...c, user_id: uid })),
      updateCommitment: (id, patch) =>
        mutate(() => supabase.from('commitments').update(patch).eq('id', id)),
      deleteCommitment: (id) => mutate(() => supabase.from('commitments').delete().eq('id', id)),

      addRecurring: async (r) => {
        await supabase.from('recurring_tasks').insert({ ...r, user_id: uid })
        const fresh = await fetchAll()
        await generateRecurring(uid, fresh.recurring, fresh.tasks)
        await refresh()
      },
      updateRecurring: (id, patch) =>
        mutate(() => supabase.from('recurring_tasks').update(patch).eq('id', id)),
      deleteRecurring: (id) => mutate(() => supabase.from('recurring_tasks').delete().eq('id', id)),

      addScore: (s) => mutate(() => supabase.from('theory_scores').insert({ ...s, user_id: uid })),
      deleteScore: (id) => mutate(() => supabase.from('theory_scores').delete().eq('id', id)),

      saveReview: (r) =>
        mutate(() =>
          supabase
            .from('weekly_reviews')
            .upsert({ ...r, user_id: uid, completed_at: new Date().toISOString() }, { onConflict: 'user_id,week_start' }),
        ),
      updatePreferences: (patch) =>
        mutate(() =>
          supabase
            .from('preferences')
            .upsert({ ...data.preferences, ...patch, user_id: uid, updated_at: new Date().toISOString() }),
        ),
    }
  }, [data, session, loading, ready, refresh, mutate, userId, fetchAll])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

/**
 * Materialises recurring definitions into real tasks for this week and next,
 * so a completed occurrence is always followed by the next one.
 */
async function generateRecurring(
  userId: string,
  recurring: RecurringTask[],
  tasks: Task[],
): Promise<boolean> {
  const start = weekStart(today())
  const rows: Partial<Task>[] = []

  for (const def of recurring.filter((r) => r.active)) {
    for (const weekOffset of [0, 1]) {
      const monday = addDays(start, weekOffset * 7)
      // weekStart is Monday; weekday 0 (Sunday) falls at the end of that week.
      const offset = def.weekday === 0 ? 6 : def.weekday - 1
      const date = addDays(monday, offset)
      if (def.interval_weeks > 1) {
        const weeksSinceCreation = Math.floor(
          (new Date(date).getTime() - new Date(def.created_at).getTime()) / (7 * 86400000),
        )
        if (weeksSinceCreation % def.interval_weeks !== 0) continue
      }
      const exists = tasks.some((t) => t.recurring_id === def.id && t.scheduled_date === date)
      if (exists) continue
      rows.push({
        user_id: userId,
        name: def.name,
        notes: def.notes,
        priority: def.priority,
        duration_min: def.duration_min,
        scheduled_date: date,
        due_date: date,
        project_id: def.project_id,
        kind: 'recurring_instance',
        recurring_id: def.id,
      })
    }
  }

  if (!rows.length) return false
  await supabase.from('tasks').insert(rows)
  return true
}
