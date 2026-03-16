create type "public"."toolkit_connection_status" as enum ('not_connected', 'initiated', 'active', 'failed', 'expired', 'disabled');


  create table "public"."project_toolkit_selections" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "user_id" uuid not null,
    "toolkit_slug" text not null,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."project_toolkit_selections" enable row level security;


  create table "public"."provider_connections" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "toolkit_slug" text not null,
    "composio_session_id" text,
    "connected_account_id" text,
    "status" public.toolkit_connection_status not null default 'not_connected'::public.toolkit_connection_status,
    "redirect_url" text,
    "callback_url" text,
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."provider_connections" enable row level security;


  create table "public"."tool_invocations" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "project_id" uuid,
    "objective_id" uuid,
    "thread_id" uuid,
    "run_id" uuid,
    "toolkit_slug" text not null,
    "tool_slug" text not null,
    "status" text not null,
    "input_summary" text,
    "result_summary" text,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."tool_invocations" enable row level security;


  create table "public"."user_tool_onboarding" (
    "user_id" uuid not null,
    "selected_toolkit_slugs" text[] not null default '{}'::text[],
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."user_tool_onboarding" enable row level security;

CREATE UNIQUE INDEX project_toolkit_selections_pkey ON public.project_toolkit_selections USING btree (id);

CREATE INDEX project_toolkit_selections_project_id_idx ON public.project_toolkit_selections USING btree (project_id, created_at);

CREATE UNIQUE INDEX project_toolkit_selections_project_toolkit_unique ON public.project_toolkit_selections USING btree (project_id, toolkit_slug);

CREATE INDEX project_toolkit_selections_user_id_idx ON public.project_toolkit_selections USING btree (user_id, created_at);

CREATE UNIQUE INDEX provider_connections_pkey ON public.provider_connections USING btree (id);

CREATE INDEX provider_connections_user_id_idx ON public.provider_connections USING btree (user_id, updated_at DESC);

CREATE UNIQUE INDEX provider_connections_user_toolkit_unique ON public.provider_connections USING btree (user_id, toolkit_slug);

CREATE UNIQUE INDEX tool_invocations_pkey ON public.tool_invocations USING btree (id);

CREATE INDEX tool_invocations_project_id_idx ON public.tool_invocations USING btree (project_id, created_at DESC);

CREATE INDEX tool_invocations_user_id_idx ON public.tool_invocations USING btree (user_id, created_at DESC);

CREATE UNIQUE INDEX user_tool_onboarding_pkey ON public.user_tool_onboarding USING btree (user_id);

alter table "public"."project_toolkit_selections" add constraint "project_toolkit_selections_pkey" PRIMARY KEY using index "project_toolkit_selections_pkey";

alter table "public"."provider_connections" add constraint "provider_connections_pkey" PRIMARY KEY using index "provider_connections_pkey";

alter table "public"."tool_invocations" add constraint "tool_invocations_pkey" PRIMARY KEY using index "tool_invocations_pkey";

alter table "public"."user_tool_onboarding" add constraint "user_tool_onboarding_pkey" PRIMARY KEY using index "user_tool_onboarding_pkey";

alter table "public"."project_toolkit_selections" add constraint "project_toolkit_selections_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE not valid;

alter table "public"."project_toolkit_selections" validate constraint "project_toolkit_selections_project_id_fkey";

alter table "public"."project_toolkit_selections" add constraint "project_toolkit_selections_project_toolkit_unique" UNIQUE using index "project_toolkit_selections_project_toolkit_unique";

alter table "public"."project_toolkit_selections" add constraint "project_toolkit_selections_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."project_toolkit_selections" validate constraint "project_toolkit_selections_user_id_fkey";

alter table "public"."provider_connections" add constraint "provider_connections_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."provider_connections" validate constraint "provider_connections_user_id_fkey";

alter table "public"."provider_connections" add constraint "provider_connections_user_toolkit_unique" UNIQUE using index "provider_connections_user_toolkit_unique";

alter table "public"."tool_invocations" add constraint "tool_invocations_objective_id_fkey" FOREIGN KEY (objective_id) REFERENCES public.objectives(id) ON DELETE SET NULL not valid;

alter table "public"."tool_invocations" validate constraint "tool_invocations_objective_id_fkey";

alter table "public"."tool_invocations" add constraint "tool_invocations_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE not valid;

alter table "public"."tool_invocations" validate constraint "tool_invocations_project_id_fkey";

alter table "public"."tool_invocations" add constraint "tool_invocations_run_id_fkey" FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE SET NULL not valid;

alter table "public"."tool_invocations" validate constraint "tool_invocations_run_id_fkey";

alter table "public"."tool_invocations" add constraint "tool_invocations_thread_id_fkey" FOREIGN KEY (thread_id) REFERENCES public.project_chat_threads(id) ON DELETE SET NULL not valid;

alter table "public"."tool_invocations" validate constraint "tool_invocations_thread_id_fkey";

alter table "public"."tool_invocations" add constraint "tool_invocations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."tool_invocations" validate constraint "tool_invocations_user_id_fkey";

alter table "public"."user_tool_onboarding" add constraint "user_tool_onboarding_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."user_tool_onboarding" validate constraint "user_tool_onboarding_user_id_fkey";

grant delete on table "public"."project_toolkit_selections" to "anon";

grant insert on table "public"."project_toolkit_selections" to "anon";

grant references on table "public"."project_toolkit_selections" to "anon";

grant select on table "public"."project_toolkit_selections" to "anon";

grant trigger on table "public"."project_toolkit_selections" to "anon";

grant truncate on table "public"."project_toolkit_selections" to "anon";

grant update on table "public"."project_toolkit_selections" to "anon";

grant delete on table "public"."project_toolkit_selections" to "authenticated";

grant insert on table "public"."project_toolkit_selections" to "authenticated";

grant references on table "public"."project_toolkit_selections" to "authenticated";

grant select on table "public"."project_toolkit_selections" to "authenticated";

grant trigger on table "public"."project_toolkit_selections" to "authenticated";

grant truncate on table "public"."project_toolkit_selections" to "authenticated";

grant update on table "public"."project_toolkit_selections" to "authenticated";

grant delete on table "public"."project_toolkit_selections" to "service_role";

grant insert on table "public"."project_toolkit_selections" to "service_role";

grant references on table "public"."project_toolkit_selections" to "service_role";

grant select on table "public"."project_toolkit_selections" to "service_role";

grant trigger on table "public"."project_toolkit_selections" to "service_role";

grant truncate on table "public"."project_toolkit_selections" to "service_role";

grant update on table "public"."project_toolkit_selections" to "service_role";

grant delete on table "public"."provider_connections" to "anon";

grant insert on table "public"."provider_connections" to "anon";

grant references on table "public"."provider_connections" to "anon";

grant select on table "public"."provider_connections" to "anon";

grant trigger on table "public"."provider_connections" to "anon";

grant truncate on table "public"."provider_connections" to "anon";

grant update on table "public"."provider_connections" to "anon";

grant delete on table "public"."provider_connections" to "authenticated";

grant insert on table "public"."provider_connections" to "authenticated";

grant references on table "public"."provider_connections" to "authenticated";

grant select on table "public"."provider_connections" to "authenticated";

grant trigger on table "public"."provider_connections" to "authenticated";

grant truncate on table "public"."provider_connections" to "authenticated";

grant update on table "public"."provider_connections" to "authenticated";

grant delete on table "public"."provider_connections" to "service_role";

grant insert on table "public"."provider_connections" to "service_role";

grant references on table "public"."provider_connections" to "service_role";

grant select on table "public"."provider_connections" to "service_role";

grant trigger on table "public"."provider_connections" to "service_role";

grant truncate on table "public"."provider_connections" to "service_role";

grant update on table "public"."provider_connections" to "service_role";

grant delete on table "public"."tool_invocations" to "anon";

grant insert on table "public"."tool_invocations" to "anon";

grant references on table "public"."tool_invocations" to "anon";

grant select on table "public"."tool_invocations" to "anon";

grant trigger on table "public"."tool_invocations" to "anon";

grant truncate on table "public"."tool_invocations" to "anon";

grant update on table "public"."tool_invocations" to "anon";

grant delete on table "public"."tool_invocations" to "authenticated";

grant insert on table "public"."tool_invocations" to "authenticated";

grant references on table "public"."tool_invocations" to "authenticated";

grant select on table "public"."tool_invocations" to "authenticated";

grant trigger on table "public"."tool_invocations" to "authenticated";

grant truncate on table "public"."tool_invocations" to "authenticated";

grant update on table "public"."tool_invocations" to "authenticated";

grant delete on table "public"."tool_invocations" to "service_role";

grant insert on table "public"."tool_invocations" to "service_role";

grant references on table "public"."tool_invocations" to "service_role";

grant select on table "public"."tool_invocations" to "service_role";

grant trigger on table "public"."tool_invocations" to "service_role";

grant truncate on table "public"."tool_invocations" to "service_role";

grant update on table "public"."tool_invocations" to "service_role";

grant delete on table "public"."user_tool_onboarding" to "anon";

grant insert on table "public"."user_tool_onboarding" to "anon";

grant references on table "public"."user_tool_onboarding" to "anon";

grant select on table "public"."user_tool_onboarding" to "anon";

grant trigger on table "public"."user_tool_onboarding" to "anon";

grant truncate on table "public"."user_tool_onboarding" to "anon";

grant update on table "public"."user_tool_onboarding" to "anon";

grant delete on table "public"."user_tool_onboarding" to "authenticated";

grant insert on table "public"."user_tool_onboarding" to "authenticated";

grant references on table "public"."user_tool_onboarding" to "authenticated";

grant select on table "public"."user_tool_onboarding" to "authenticated";

grant trigger on table "public"."user_tool_onboarding" to "authenticated";

grant truncate on table "public"."user_tool_onboarding" to "authenticated";

grant update on table "public"."user_tool_onboarding" to "authenticated";

grant delete on table "public"."user_tool_onboarding" to "service_role";

grant insert on table "public"."user_tool_onboarding" to "service_role";

grant references on table "public"."user_tool_onboarding" to "service_role";

grant select on table "public"."user_tool_onboarding" to "service_role";

grant trigger on table "public"."user_tool_onboarding" to "service_role";

grant truncate on table "public"."user_tool_onboarding" to "service_role";

grant update on table "public"."user_tool_onboarding" to "service_role";


  create policy "project_toolkit_selections_owner_access"
  on "public"."project_toolkit_selections"
  as permissive
  for all
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "provider_connections_owner_access"
  on "public"."provider_connections"
  as permissive
  for all
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "tool_invocations_owner_access"
  on "public"."tool_invocations"
  as permissive
  for all
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "user_tool_onboarding_owner_access"
  on "public"."user_tool_onboarding"
  as permissive
  for all
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


CREATE TRIGGER provider_connections_set_updated_at BEFORE UPDATE ON public.provider_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER user_tool_onboarding_set_updated_at BEFORE UPDATE ON public.user_tool_onboarding FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


