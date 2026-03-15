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

## Local Supabase workflow

This repo includes a local Supabase project under [supabase](/Users/besi/Developer/ai/autobot/supabase). Local development is opt-in, so you can keep using a remote Supabase project or switch to local when you want a reproducible reset + seed flow.

Quick start:

```bash
pnpm supabase:start
pnpm supabase:status
cp .env.local.example .env.local
pnpm supabase:reset
pnpm supabase:verify
pnpm dev
```

After reset, sign in with:

- `demo@autobot.local`
- `Autobot123!`

`pnpm supabase:reset` rebuilds the local database from the migration files in [supabase/migrations](/Users/besi/Developer/ai/autobot/supabase/migrations) and then runs [supabase/seed.sql](/Users/besi/Developer/ai/autobot/supabase/seed.sql). The declarative schema source of truth remains [supabase/schemas](/Users/besi/Developer/ai/autobot/supabase/schemas); the matching migration files exist so the Supabase CLI can apply that schema during local reset and push workflows. `pnpm supabase:verify` prints the local table inventory so you can confirm tables such as `profiles`, `runs`, `intake_drafts`, `projects`, and `memory_records` were created.

The schema files under [supabase/schemas](/Users/besi/Developer/ai/autobot/supabase/schemas) are ordered with numbered `NN-kebab-name.sql` filenames. Each table owns its own schema file, including indexes, update triggers, RLS, and policies.

## Database setup

1. If you are using a hosted Supabase project instead of local Supabase, use the SQL files in [supabase/schemas](/Users/besi/Developer/ai/autobot/supabase/schemas) as the source of truth and keep the matching files in [supabase/migrations](/Users/besi/Developer/ai/autobot/supabase/migrations) in sync for Supabase CLI workflows.

2. Generate new timestamped Supabase migrations from the numbered schema files with `pnpm supabase:migration:sync <name>`. This resets local Supabase, applies the ordered schema files, creates a diff migration, and regenerates local types.

3. Use `pnpm supabase:migration:new <name>` only when you intentionally want an empty migration file.

4. Set these additional environment variables:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4.1-mini
ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_MODEL=claude-sonnet-4-5
```

5. Sign in before creating a run. Run state, telemetry, and clarification history are stored per authenticated user.

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
pnpm supabase:start
pnpm supabase:status
pnpm supabase:reset
pnpm supabase:db:diff
pnpm supabase:db:lint
pnpm supabase:migration:sync add_feature_name
pnpm supabase:migration:new add_feature_name
pnpm supabase:verify
pnpm supabase:stop
pnpm supabase:typegen
```
