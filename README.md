# Level Up

A simple, visual personal planner: today's actions, this week's schedule, active
projects broken into milestones, longer-term goals, and a "what should I do now?"
recommendation — backed by Supabase so it works from your phone and laptop.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS, deployed as a static site
  (`HashRouter`, so it works on GitHub Pages with no server-side routing).
- **Backend:** Supabase (Postgres + Auth). One project, one user, row-level security
  scoped to `auth.uid()`. Schema lives in `supabase` migrations applied via the
  Supabase MCP tools / dashboard — see `src/lib/types.ts` for the shape.
- **State:** a single `StoreProvider` (`src/store.tsx`) fetches everything on load and
  exposes typed CRUD helpers. No separate cache/query library — the dataset is small
  enough that refetch-on-mutate is simpler to reason about.

## Local development

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL + publishable key
npm run dev
```

## Where the logic lives

- `src/lib/engine.ts` — the priority scoring model, free-time calculation, and the
  "what should I do now?" recommendation. This is the file to touch if the
  prioritisation feels wrong.
- `src/lib/seed.ts` — first-login seed data (fixed schedule, recurring tasks, starter
  projects/milestones). Runs once per account, automatically, the first time you sign in.
- `src/store.tsx` — also generates recurring task instances (two weeks ahead) whenever
  the app loads or a recurring task is completed.

## Deployment

Static build, deployed to the `gh-pages` branch of this repo and served by GitHub
Pages. To redeploy after changes:

```bash
GITHUB_PAGES=true npm run build
npx gh-pages -d dist
```
