import { supabase } from './supabase'
import { addDays, today, weekdayOf } from './dates'
import type { Priority, ProjectStatus } from './types'

interface SeedCommitment {
  label: string
  weekday: number
  start_time: string | null
  end_time: string | null
  kind: 'work' | 'training' | 'planning' | 'other'
}

const COMMITMENTS: SeedCommitment[] = [
  { label: 'Work', weekday: 1, start_time: '07:00', end_time: '17:00', kind: 'work' },
  { label: 'Rest day — no training', weekday: 1, start_time: null, end_time: null, kind: 'other' },

  { label: 'Work', weekday: 2, start_time: '07:00', end_time: '17:00', kind: 'work' },
  { label: 'Muay Thai', weekday: 2, start_time: '18:00', end_time: '20:00', kind: 'training' },

  { label: 'Work', weekday: 3, start_time: '07:00', end_time: '17:00', kind: 'work' },
  { label: '10K run', weekday: 3, start_time: null, end_time: null, kind: 'training' },
  { label: 'Judo', weekday: 3, start_time: '19:00', end_time: '20:00', kind: 'training' },

  { label: 'Work', weekday: 4, start_time: '07:00', end_time: '17:00', kind: 'work' },
  { label: 'Hill sprints', weekday: 4, start_time: null, end_time: null, kind: 'training' },
  { label: 'Plyometrics', weekday: 4, start_time: null, end_time: null, kind: 'training' },

  { label: 'Work', weekday: 5, start_time: '07:00', end_time: '17:00', kind: 'work' },
  { label: 'Muay Thai', weekday: 5, start_time: '19:00', end_time: '21:00', kind: 'training' },

  { label: 'Hill sprints', weekday: 6, start_time: null, end_time: null, kind: 'training' },
  { label: 'Run', weekday: 6, start_time: null, end_time: null, kind: 'training' },

  { label: 'Muay Thai', weekday: 0, start_time: null, end_time: null, kind: 'training' },
  { label: 'Weekly planning / review', weekday: 0, start_time: null, end_time: null, kind: 'planning' },
]

interface SeedProject {
  key: string
  name: string
  description: string
  status: ProjectStatus
  priority: Priority
  deadline: string | null
  milestones: string[]
  /** Tasks seeded against this project, indexed to a milestone. */
  tasks: { name: string; milestone: number; priority: Priority; duration: number; dueIn?: number; notes?: string }[]
}

function seedProjects(): SeedProject[] {
  return [
    {
      key: 'theory',
      name: 'Driving Theory Test',
      description:
        'Pass the driving theory test on 12 December 2026 by preparing steadily rather than cramming at the end.',
      status: 'in_progress',
      priority: 'high',
      deadline: '2026-12-12',
      milestones: [
        'Learn the syllabus — work through all topics once',
        'Topic practice — drill weak areas',
        'Hazard perception — build up clip practice',
        'Mock tests — consistent pass scores',
        'Final week — review mistakes and stay sharp',
      ],
      tasks: [
        { name: 'Revision session: road signs and markings', milestone: 0, priority: 'medium', duration: 45 },
        { name: 'Revision session: rules of the road', milestone: 0, priority: 'medium', duration: 45 },
        { name: 'First hazard perception practice set', milestone: 2, priority: 'low', duration: 30 },
        { name: 'Take a full mock theory test and log the score', milestone: 3, priority: 'medium', duration: 60 },
      ],
    },
    {
      key: 'shorts',
      name: 'Shorts Automation',
      description:
        'Finish the Claude-built Shorts automation system and get it running with as little daily input from me as possible.',
      status: 'in_progress',
      priority: 'high',
      deadline: null,
      milestones: [
        'Finish the build',
        'Test the complete workflow end to end',
        'Fix the bugs that testing exposes',
        'Automate the repetitive steps',
        'Run it consistently for two weeks',
        'Review results and improve',
      ],
      tasks: [
        { name: 'List what is still unfinished in the Shorts pipeline', milestone: 0, priority: 'medium', duration: 30 },
        { name: 'Run one full video end to end and note every manual step', milestone: 1, priority: 'medium', duration: 60 },
      ],
    },
    {
      key: 'food',
      name: 'Food & Activity App',
      description:
        'Build my own food and training tracker, starting with simple food logging for myself. Later phases add training, wearable data and insights.',
      status: 'planning',
      priority: 'medium',
      deadline: null,
      milestones: [
        'Phase 1 — Food logging that works for me',
        'Phase 1 — Photo/scan estimate with manual correction',
        'Phase 1 — Daily totals and previous days',
        'Phase 2 — Training tracking',
        'Phase 3 — Wearable and activity integration',
        'Phase 4 — Combined nutrition and training insights',
      ],
      tasks: [
        {
          name: 'Sketch the food logging screen on paper',
          milestone: 0,
          priority: 'low',
          duration: 30,
          notes: 'Just the one screen. What do I see, what do I tap, what gets saved.',
        },
        {
          name: 'Build basic food input form (name, quantity, calories)',
          milestone: 0,
          priority: 'low',
          duration: 90,
        },
      ],
    },
    {
      key: 'payday',
      name: 'Payday Planner',
      description:
        'Finish the Claude/Lovable payday planner and have it usable before Monday payday, then fold it into my normal money routine.',
      status: 'testing',
      priority: 'high',
      deadline: null,
      milestones: [
        'Finish the core planner',
        'Test it with my own real numbers',
        'Fix the bugs that show up',
        'Use it on payday',
        'Improve it based on actually using it',
      ],
      tasks: [
        { name: 'Test the Payday Planner with my real figures', milestone: 1, priority: 'high', duration: 45 },
        { name: 'Use the Payday Planner to plan this payday', milestone: 3, priority: 'high', duration: 45, dueIn: 2 },
      ],
    },
    {
      key: 'trading',
      name: 'Trading 212 Portfolio Research',
      description:
        'Understand what I actually own. Write a documented thesis for every holding so I have a game plan instead of guessing. Research and review only — not a buy/sell signal system.',
      status: 'not_started',
      priority: 'medium',
      deadline: null,
      milestones: [
        'List every holding and set up a thesis template',
        'Research the largest holdings first',
        'Research the remaining holdings',
        'Write the overall portfolio view',
        'Quarterly review routine',
      ],
      tasks: [
        {
          name: 'Write out every holding I currently own',
          milestone: 0,
          priority: 'low',
          duration: 20,
          notes: 'Name, ticker, roughly how much of the portfolio it is.',
        },
        {
          name: 'Research session: biggest holding — what it does and why I own it',
          milestone: 1,
          priority: 'low',
          duration: 45,
        },
      ],
    },
  ]
}

export async function hasSeedData(userId: string): Promise<boolean> {
  const { count } = await supabase
    .from('commitments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  return (count ?? 0) > 0
}

export async function seedForUser(userId: string): Promise<void> {
  const ref = today()

  await supabase.from('preferences').upsert({ user_id: userId })

  await supabase
    .from('commitments')
    .insert(COMMITMENTS.map((c) => ({ ...c, user_id: userId })))

  const defs = seedProjects()
  const { data: insertedProjects, error: projectError } = await supabase
    .from('projects')
    .insert(
      defs.map((p, i) => ({
        user_id: userId,
        name: p.name,
        description: p.description,
        status: p.status,
        priority: p.priority,
        deadline: p.deadline,
        sort_order: i,
      })),
    )
    .select()
  if (projectError) throw projectError

  const projectIdByKey = new Map<string, string>()
  defs.forEach((def) => {
    const match = insertedProjects!.find((p) => p.name === def.name)
    if (match) projectIdByKey.set(def.key, match.id)
  })

  const milestoneRows = defs.flatMap((def) =>
    def.milestones.map((name, i) => ({
      user_id: userId,
      project_id: projectIdByKey.get(def.key)!,
      name,
      sort_order: i,
    })),
  )
  const { data: insertedMilestones, error: msError } = await supabase
    .from('milestones')
    .insert(milestoneRows)
    .select()
  if (msError) throw msError

  const milestoneId = (projectKey: string, index: number) =>
    insertedMilestones!.find(
      (m) => m.project_id === projectIdByKey.get(projectKey) && m.sort_order === index,
    )?.id ?? null

  // Payday is the coming Monday.
  const daysToMonday = (8 - weekdayOf(ref)) % 7 || 7
  const payday = addDays(ref, daysToMonday)

  const oneOffs = [
    {
      user_id: userId,
      name: 'Complete the Lincoln College form',
      notes: 'Sent to me by email.',
      priority: 'high' as Priority,
      due_date: addDays(ref, 3),
      scheduled_date: ref,
      duration_min: 20,
    },
    {
      user_id: userId,
      name: 'Sell / list remaining shoes on Vinted',
      notes: 'Photograph, list, and reply to offers on whatever is left.',
      priority: 'medium' as Priority,
      due_date: addDays(ref, 7),
      scheduled_date: ref,
      duration_min: 30,
    },
    {
      user_id: userId,
      name: 'Finish the Payday Planner',
      notes: 'Needs to be working before payday.',
      priority: 'high' as Priority,
      due_date: addDays(payday, -1),
      scheduled_date: ref,
      duration_min: 60,
      project_id: projectIdByKey.get('payday'),
      milestone_id: milestoneId('payday', 0),
    },
  ]

  const projectTasks = defs.flatMap((def) =>
    def.tasks.map((t) => ({
      user_id: userId,
      name: t.name,
      notes: t.notes ?? '',
      priority: t.priority,
      due_date: t.dueIn != null ? addDays(ref, t.dueIn) : null,
      scheduled_date: null,
      duration_min: t.duration,
      project_id: projectIdByKey.get(def.key)!,
      milestone_id: milestoneId(def.key, t.milestone),
    })),
  )

  const { error: taskError } = await supabase.from('tasks').insert([...oneOffs, ...projectTasks])
  if (taskError) throw taskError

  const { error: recurError } = await supabase.from('recurring_tasks').insert([
    {
      user_id: userId,
      name: 'Log 6 hours on the apprenticeship app',
      notes: 'Describe what I did this week. 6 hours of off-the-job learning.',
      priority: 'high' as Priority,
      duration_min: 30,
      weekday: 0,
      interval_weeks: 1,
    },
    {
      user_id: userId,
      name: 'Weekly planning and review',
      notes: 'Look at the week behind and set the 3–5 priorities for the week ahead.',
      priority: 'medium' as Priority,
      duration_min: 30,
      weekday: 0,
      interval_weeks: 1,
    },
  ])
  if (recurError) throw recurError

  const { error: goalError } = await supabase.from('goals').insert([
    {
      user_id: userId,
      name: 'Pass my driving theory test',
      description: 'Booked for 12 December 2026. Prepared properly, not crammed.',
      target_date: '2026-12-12',
      project_id: projectIdByKey.get('theory'),
    },
    {
      user_id: userId,
      name: 'Have the Shorts system running on its own',
      description: 'Automated enough that it needs a weekly check rather than daily work.',
      target_date: null,
      project_id: projectIdByKey.get('shorts'),
    },
    {
      user_id: userId,
      name: 'Be using my own food and training tracker daily',
      description: 'Built for me first. Simple, but something I actually open every day.',
      target_date: null,
      project_id: projectIdByKey.get('food'),
    },
    {
      user_id: userId,
      name: 'Know the thesis behind every investment I hold',
      description: 'A written game plan per holding instead of random decisions.',
      target_date: null,
      project_id: projectIdByKey.get('trading'),
    },
  ])
  if (goalError) throw goalError
}
