alter table "public"."provider_connections" add column "api_key_last_four" text;

alter table "public"."provider_connections" add column "api_key_updated_at" timestamp with time zone;

alter table "public"."provider_connections" add column "auth_scheme" text;

alter table "public"."provider_connections" add column "encrypted_api_key" bytea;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.save_provider_connection_api_key(p_toolkit_slug text, p_api_key text, p_auth_scheme text, p_encryption_secret text)
 RETURNS public.provider_connections
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_result public.provider_connections;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_api_key is null or btrim(p_api_key) = '' then
    raise exception 'API key is required';
  end if;

  insert into public.provider_connections (
    user_id,
    toolkit_slug,
    auth_scheme,
    encrypted_api_key,
    api_key_last_four,
    api_key_updated_at,
    status,
    last_synced_at
  )
  values (
    v_user_id,
    p_toolkit_slug,
    p_auth_scheme,
    pgp_sym_encrypt(p_api_key, p_encryption_secret),
    right(p_api_key, 4),
    timezone('utc', now()),
    'active',
    timezone('utc', now())
  )
  on conflict (user_id, toolkit_slug)
  do update set
    auth_scheme = excluded.auth_scheme,
    encrypted_api_key = excluded.encrypted_api_key,
    api_key_last_four = excluded.api_key_last_four,
    api_key_updated_at = excluded.api_key_updated_at,
    status = excluded.status,
    last_synced_at = excluded.last_synced_at,
    updated_at = timezone('utc', now())
  returning * into v_result;

  return v_result;
end;
$function$
;


