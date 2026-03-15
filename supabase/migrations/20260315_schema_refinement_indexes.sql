create index if not exists intake_drafts_run_id_idx
on public.intake_drafts(run_id);

create index if not exists objectives_user_id_idx
on public.objectives(user_id, updated_at desc);

create index if not exists objectives_source_run_id_idx
on public.objectives(source_run_id);

create index if not exists objectives_source_draft_id_idx
on public.objectives(source_draft_id);

create index if not exists project_assets_user_id_idx
on public.project_assets(user_id, updated_at desc);

create index if not exists memory_records_user_id_idx
on public.memory_records(user_id, created_at desc);

create index if not exists project_chat_threads_user_id_idx
on public.project_chat_threads(user_id, updated_at desc);

create index if not exists project_chat_messages_project_id_idx
on public.project_chat_messages(project_id, created_at asc);

create index if not exists project_chat_messages_objective_id_idx
on public.project_chat_messages(objective_id, created_at asc);

create index if not exists project_chat_messages_user_id_idx
on public.project_chat_messages(user_id, created_at asc);
