-- Local development seed for Autobot.
-- This file is executed automatically by `pnpm supabase:reset`.
-- It creates a single deterministic email/password user so the app is usable
-- immediately after a reset without preloading projects or chat data.

do $$
declare
  demo_user_id constant uuid := '9a0c7b9e-6f2c-4d4d-9b84-2a9d9f5f4c11';
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    email_change_token_new,
    email_change,
    email_change_token_current,
    email_change_confirm_status,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    demo_user_id,
    'authenticated',
    'authenticated',
    'demo@autobot.local',
    extensions.crypt('Autobot123!', extensions.gen_salt('bf')),
    timezone('utc', now()),
    '',
    timezone('utc', now()),
    '',
    '',
    '',
    '',
    0,
    '{"provider":"email","providers":["email"]}'::jsonb,
    format(
      '{"sub":"%s","email":"demo@autobot.local","email_verified":true,"phone_verified":false}',
      demo_user_id
    )::jsonb,
    timezone('utc', now()),
    timezone('utc', now()),
    false,
    false
  )
  on conflict (id) do update
  set
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = excluded.email_confirmed_at,
    updated_at = excluded.updated_at,
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data;

  insert into auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    '56abdf45-1877-4f37-bb15-6c61555c6e6d',
    demo_user_id::text,
    demo_user_id,
    format(
      '{"sub":"%s","email":"demo@autobot.local","email_verified":true,"phone_verified":false}',
      demo_user_id
    )::jsonb,
    'email',
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (id) do update
  set
    provider_id = excluded.provider_id,
    user_id = excluded.user_id,
    identity_data = excluded.identity_data,
    last_sign_in_at = excluded.last_sign_in_at,
    updated_at = excluded.updated_at;

  insert into public.profiles (id)
  values (demo_user_id)
  on conflict (id) do nothing;
end $$;
