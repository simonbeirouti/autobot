# Supabase Database

## Schema Organization

Schemas live in `schemas/` with numbered `NN-kebab-name.sql` prefixes for dependency ordering.
Each table should own its own schema file, including:
- table definition
- foreign-key indexes
- update trigger attachment
- RLS enablement
- table policies

Keep shared helpers in a small number of numbered files ahead of dependent tables, such as:
- `00-extensions.sql`
- `01-shared-functions.sql`
- `18-profile-hooks-and-storage.sql`

## Skills

For database implementation:
- `/postgres-expert` - Schema design, RLS, migrations, testing

## Migration Workflow

### New Entities

```bash
# Create schema file
touch schemas/20-feature.sql

# Generate a matching migration from the numbered schema files
pnpm supabase:migration:sync feature_name

# Review the generated migration if needed
pnpm supabase migrations list
```

### Modify Existing

```bash
# Edit the relevant numbered schema file and generate a matching migration
pnpm supabase:migration:sync update_feature

# Review the generated migration if needed
pnpm supabase migrations list
```

### How Sync Works

`pnpm supabase:migration:sync <name>` does the full local sync workflow:

1. resets local Supabase from timestamped migrations
2. applies every numbered file in `schemas/` to the local database in order
3. generates a new timestamped migration with `supabase db diff -f <name>`
4. regenerates local TypeScript types

Use `pnpm supabase:migration:new <name>` only when you explicitly want an empty migration file.

## Security Rules

- **ALWAYS enable RLS** on new tables
- **NEVER use SECURITY DEFINER** without explicit access controls
- Use existing helper functions (see `/postgres-expert` skill)

## Table Template

```sql
create table if not exists public.feature (
  id uuid unique not null default extensions.uuid_generate_v4(),
  account_id uuid references public.accounts(id) on delete cascade not null,
  created_at timestamp with time zone default now(),
  primary key (id)
);

alter table "public"."feature" enable row level security;
revoke all on public.feature from authenticated, service_role;
grant select, insert, update, delete on table public.feature to authenticated;

-- Use helper functions for policies
create policy "feature_read" on public.feature for select
  to authenticated using (
    account_id = (select auth.uid()) or
    public.has_role_on_account(account_id)
  );
```

## Commands

```bash
pnpm supabase:reset                # Reset database
pnpm supabase:db:diff             # Diff local DB against migrations
pnpm supabase:db:lint             # Lint local database
pnpm supabase:typegen             # Generate TypeScript types
pnpm supabase:migration:sync name # Sync schemas into a generated migration
pnpm supabase:migration:new name  # Create a timestamped migration
pnpm supabase migrations list     # View migrations
```
