# Autobot

Autobot is a simple Next.js app built with:

- Supabase for auth and backend services
- Next.js App Router for the frontend
- TanStack Query with IndexedDB persistence for client-side caching
- shadcn/ui for the component layer
- Deep Agents + LangGraph for autonomous intake and run orchestration

## Getting started

1. Install dependencies:

```bash
pnpm install
```

2. Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_supabase_publishable_key
```

3. Start the development server:

```bash
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Autonomous run setup

1. Apply the SQL schema in [supabase/migrations/20260311_autobot_runs.sql](/Users/besi/Developer/ai/autobot/supabase/migrations/20260311_autobot_runs.sql) to your Supabase project.
   Apply [supabase/migrations/20260310_profiles_and_files.sql](/Users/besi/Developer/ai/autobot/supabase/migrations/20260310_profiles_and_files.sql) first, then [supabase/migrations/20260311_autobot_runs.sql](/Users/besi/Developer/ai/autobot/supabase/migrations/20260311_autobot_runs.sql).
2. Set these additional environment variables:

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4.1-mini
```

3. Sign in before creating a run. Run state, telemetry, and clarification history are stored per authenticated user.

## Notes

- Authentication is powered by Supabase.
- Query cache and lightweight auth state are persisted in IndexedDB in the browser.
- The UI is built with shadcn/ui components and Tailwind CSS.

## Available scripts

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
```
