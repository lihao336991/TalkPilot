-- Dual-track access control (device/install + account/user).
-- Goal:
-- - Free tier is limited by BOTH:
--   - per-account quota (existing tables: profiles.daily_minutes_used + feature_usage_daily)
--   - per-install quota (new tables below)
-- - This makes "create new anonymous user" / "create new account" ineffective on the same device,
--   as long as the install_id is stable (e.g. stored in iOS Keychain via SecureStore).
--
-- IMPORTANT SECURITY FIX:
-- Existing RPCs accepted arbitrary p_user_id while being SECURITY DEFINER.
-- That allowed any authenticated caller to burn someone else's quota by passing their uuid.
-- This migration hardens RPCs by requiring p_user_id = auth.uid().
--
-- Rollout note:
-- This adds p_install_id parameters. Update clients/edge functions to pass install_id.
-- You may choose to allow NULL during rollout; this migration currently REQUIRES non-null.
-- If you need backwards compatibility, change `require_install_id()` to return null on null.

create table if not exists public.installations (
  -- Client-generated UUIDv4, persisted on-device (Keychain/Keystore).
  install_id uuid primary key,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  platform text,
  app_version text,
  device_model text,
  os_version text
);

create table if not exists public.installation_users (
  install_id uuid not null references public.installations(install_id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (install_id, user_id)
);

create index if not exists installation_users_user_idx
  on public.installation_users(user_id);

create table if not exists public.feature_usage_daily_install (
  install_id uuid not null references public.installations(install_id) on delete cascade,
  feature_key text not null,
  usage_date date not null default current_date,
  used_count integer not null default 0 check (used_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (install_id, feature_key, usage_date)
);

create index if not exists feature_usage_daily_install_idx
  on public.feature_usage_daily_install(install_id, usage_date desc);

create table if not exists public.live_minutes_usage_daily_install (
  install_id uuid not null references public.installations(install_id) on delete cascade,
  usage_date date not null default current_date,
  used_minutes integer not null default 0 check (used_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (install_id, usage_date)
);

alter table public.installations enable row level security;
alter table public.installation_users enable row level security;
alter table public.feature_usage_daily_install enable row level security;
alter table public.live_minutes_usage_daily_install enable row level security;

-- Default-deny: apps should not query these tables directly.
-- Access is via SECURITY DEFINER RPC only.

create or replace function public.require_install_id(p_install_id uuid)
returns uuid
language plpgsql
immutable
as $$
begin
  if p_install_id is null then
    raise exception 'install_id is required';
  end if;
  return p_install_id;
end;
$$;

create or replace function public.ensure_installation(
  p_install_id uuid,
  p_platform text default null,
  p_app_version text default null,
  p_device_model text default null,
  p_os_version text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_install_id uuid := public.require_install_id(p_install_id);
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.installations (
    install_id, last_seen_at, platform, app_version, device_model, os_version
  )
  values (
    v_install_id, now(),
    nullif(p_platform, ''), nullif(p_app_version, ''), nullif(p_device_model, ''), nullif(p_os_version, '')
  )
  on conflict (install_id) do update
    set last_seen_at = now(),
        platform = coalesce(excluded.platform, public.installations.platform),
        app_version = coalesce(excluded.app_version, public.installations.app_version),
        device_model = coalesce(excluded.device_model, public.installations.device_model),
        os_version = coalesce(excluded.os_version, public.installations.os_version);

  -- Keep an audit trail that this install has been seen with this auth user.
  perform public.ensure_profile_row(v_user_id);
  insert into public.installation_users (install_id, user_id, last_seen_at)
  values (v_install_id, v_user_id, now())
  on conflict (install_id, user_id) do update
    set last_seen_at = now();
end;
$$;

-- Returns the effective free-tier live minutes limit for installs.
-- Keep it aligned with account-level (currently 10) unless you intentionally want tighter install limits.
create or replace function public.get_live_minutes_limit_install(p_tier text)
returns integer
language plpgsql
immutable
as $$
begin
  case p_tier
    when 'pro' then return 120;
    when 'unlimited' then return 99999;
    else return 10;
  end case;
end;
$$;

create or replace function public.get_live_minutes_access(
  p_user_id uuid,
  p_install_id uuid
)
returns table(
  feature_key text,
  allowed boolean,
  reason text,
  tier text,
  used_count integer,
  remaining_count integer,
  limit_count integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_install_id uuid := public.require_install_id(p_install_id);
  v_tier text;
  v_user_used integer;
  v_user_reset_at date;
  v_user_limit integer;
  v_user_remaining integer;

  v_install_used integer;
  v_install_limit integer;
  v_install_remaining integer;

  v_effective_limit integer;
  v_effective_remaining integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- Harden against abusing SECURITY DEFINER RPCs with arbitrary ids.
  if p_user_id is distinct from v_user_id then
    raise exception 'p_user_id must match auth.uid()';
  end if;

  perform public.ensure_profile_row(v_user_id);
  perform public.ensure_installation(v_install_id);

  select subscription_tier, daily_minutes_used, daily_minutes_reset_at
    into v_tier, v_user_used, v_user_reset_at
    from public.profiles
   where id = v_user_id
   for update;

  if v_tier is null then
    v_tier := 'free';
  end if;

  -- Paid tiers bypass install-level throttling.
  if v_tier in ('pro', 'unlimited') then
    feature_key := 'live_minutes';
    tier := v_tier;
    used_count := coalesce(v_user_used, 0);
    limit_count := public.get_live_minutes_limit(v_tier);
    remaining_count := greatest(limit_count - used_count, 0);
    allowed := true;
    reason := 'ok';
    reset_at := date_trunc('day', now()) + interval '1 day';
    return next;
    return;
  end if;

  -- User-side daily reset (account-level).
  if v_user_reset_at < current_date then
    update public.profiles
       set daily_minutes_used = 0,
           daily_minutes_reset_at = current_date,
           updated_at = now()
     where id = v_user_id;
    v_user_used := 0;
  end if;

  v_user_limit := public.get_live_minutes_limit(v_tier);
  v_user_used := greatest(coalesce(v_user_used, 0), 0);
  v_user_remaining := greatest(v_user_limit - v_user_used, 0);

  -- Install-side daily usage (device-level).
  select used_minutes
    into v_install_used
    from public.live_minutes_usage_daily_install
   where install_id = v_install_id
     and usage_date = current_date;
  v_install_used := greatest(coalesce(v_install_used, 0), 0);
  v_install_limit := public.get_live_minutes_limit_install(v_tier);
  v_install_remaining := greatest(v_install_limit - v_install_used, 0);

  v_effective_limit := least(v_user_limit, v_install_limit);
  v_effective_remaining := least(v_user_remaining, v_install_remaining);

  feature_key := 'live_minutes';
  tier := v_tier;
  limit_count := v_effective_limit;
  remaining_count := v_effective_remaining;
  used_count := greatest(v_effective_limit - v_effective_remaining, 0);
  allowed := v_effective_remaining > 0;
  reason := case when allowed then 'ok' else 'limit_reached' end;
  reset_at := date_trunc('day', now()) + interval '1 day';
  return next;
end;
$$;

create or replace function public.consume_live_session_access(
  p_session_id uuid,
  p_duration_seconds integer,
  p_install_id uuid
)
returns table(
  feature_key text,
  allowed boolean,
  reason text,
  tier text,
  used_count integer,
  remaining_count integer,
  limit_count integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_install_id uuid := public.require_install_id(p_install_id);
  v_session_user_id uuid;
  v_profile_tier text;
  v_profile_used integer;
  v_profile_reset_at date;
  v_user_limit integer;
  v_recorded_at timestamptz;

  v_install_used integer;
  v_install_limit integer;

  v_minutes_to_consume integer :=
    greatest(
      ceil(greatest(coalesce(p_duration_seconds, 0), 0)::numeric / 60.0)::integer,
      0
    );

  v_user_remaining integer;
  v_install_remaining integer;
  v_effective_limit integer;
  v_effective_remaining integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform public.ensure_installation(v_install_id);

  -- Ownership is still enforced by auth.uid() (cannot bill someone else's session).
  select s.user_id, s.live_minutes_recorded_at
    into v_session_user_id, v_recorded_at
    from public.sessions s
   where s.id = p_session_id
     and s.user_id = v_user_id;

  if not found then
    raise exception 'Session not found or not owned by current user';
  end if;

  perform public.ensure_profile_row(v_session_user_id);

  select subscription_tier, daily_minutes_used, daily_minutes_reset_at
    into v_profile_tier, v_profile_used, v_profile_reset_at
    from public.profiles
   where id = v_session_user_id
   for update;

  if v_profile_tier is null then
    v_profile_tier := 'free';
  end if;

  -- User-side reset.
  if v_profile_reset_at < current_date then
    update public.profiles
       set daily_minutes_used = 0,
           daily_minutes_reset_at = current_date,
           updated_at = now()
     where id = v_session_user_id;
    v_profile_used := 0;
  end if;

  v_user_limit := public.get_live_minutes_limit(v_profile_tier);

  -- Only bill once per session (idempotent).
  if v_recorded_at is null then
    -- Account-level usage.
    update public.profiles
       set daily_minutes_used = least(
             v_user_limit,
             greatest(coalesce(daily_minutes_used, 0), 0) + v_minutes_to_consume
           ),
           updated_at = now()
     where id = v_session_user_id
     returning daily_minutes_used into v_profile_used;

    -- Install-level usage (only for free tier; paid tiers do not need install throttling).
    if v_profile_tier not in ('pro', 'unlimited') then
      insert into public.live_minutes_usage_daily_install (
        install_id, usage_date, used_minutes, created_at, updated_at
      )
      values (
        v_install_id, current_date, v_minutes_to_consume, now(), now()
      )
      on conflict (install_id, usage_date)
      do update
        set used_minutes = public.live_minutes_usage_daily_install.used_minutes + excluded.used_minutes,
            updated_at = now();
    end if;

    update public.sessions
       set billed_live_minutes = v_minutes_to_consume,
           live_minutes_recorded_at = now()
     where id = p_session_id;
  else
    v_profile_used := coalesce(v_profile_used, 0);
  end if;

  -- Compute effective view to return (same logic as get_live_minutes_access()).
  if v_profile_tier in ('pro', 'unlimited') then
    feature_key := 'live_minutes';
    tier := v_profile_tier;
    used_count := v_profile_used;
    limit_count := v_user_limit;
    remaining_count := greatest(limit_count - used_count, 0);
    allowed := true;
    reason := 'ok';
    reset_at := date_trunc('day', now()) + interval '1 day';
    return next;
    return;
  end if;

  v_user_remaining := greatest(v_user_limit - greatest(coalesce(v_profile_used, 0), 0), 0);

  select used_minutes
    into v_install_used
    from public.live_minutes_usage_daily_install
   where install_id = v_install_id
     and usage_date = current_date;
  v_install_used := greatest(coalesce(v_install_used, 0), 0);
  v_install_limit := public.get_live_minutes_limit_install(v_profile_tier);
  v_install_remaining := greatest(v_install_limit - v_install_used, 0);

  v_effective_limit := least(v_user_limit, v_install_limit);
  v_effective_remaining := least(v_user_remaining, v_install_remaining);

  feature_key := 'live_minutes';
  tier := v_profile_tier;
  used_count := greatest(v_effective_limit - v_effective_remaining, 0);
  limit_count := v_effective_limit;
  remaining_count := v_effective_remaining;
  allowed := v_effective_remaining > 0;
  reason := case when allowed then 'ok' else 'limit_reached' end;
  reset_at := date_trunc('day', now()) + interval '1 day';
  return next;
end;
$$;

-- Harden + extend feature quota RPCs: they now require install_id and enforce both user + install quotas for free.
create or replace function public.check_feature_access(
  p_user_id uuid,
  p_feature_key text,
  p_install_id uuid
)
returns table(
  feature_key text,
  allowed boolean,
  reason text,
  tier text,
  used_count integer,
  remaining_count integer,
  limit_count integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_install_id uuid := public.require_install_id(p_install_id);
  v_tier text;

  v_user_used integer := 0;
  v_user_limit integer;
  v_user_remaining integer;

  v_install_used integer := 0;
  v_install_limit integer;
  v_install_remaining integer;

  v_effective_limit integer;
  v_effective_remaining integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_user_id is distinct from v_user_id then
    raise exception 'p_user_id must match auth.uid()';
  end if;

  perform public.ensure_profile_row(v_user_id);
  perform public.ensure_installation(v_install_id);

  select subscription_tier
    into v_tier
    from public.profiles
   where id = v_user_id;

  if v_tier is null then
    v_tier := 'free';
  end if;

  v_user_limit := public.get_feature_daily_limit(v_tier, p_feature_key);

  feature_key := p_feature_key;
  tier := v_tier;
  reset_at := date_trunc('day', now()) + interval '1 day';

  -- Paid tiers have unlimited review/suggestion.
  if v_user_limit is null then
    allowed := true;
    reason := 'ok';
    used_count := 0;
    remaining_count := null;
    limit_count := null;
    return next;
    return;
  end if;

  -- User-side usage.
  select fud.used_count
    into v_user_used
    from public.feature_usage_daily fud
   where fud.user_id = v_user_id
     and fud.feature_key = p_feature_key
     and fud.usage_date = current_date;
  v_user_used := greatest(coalesce(v_user_used, 0), 0);
  v_user_remaining := greatest(v_user_limit - v_user_used, 0);

  -- Install-side usage (device-level), only for free tier.
  if v_tier = 'free' then
    v_install_limit := v_user_limit;
    select fud.used_count
      into v_install_used
      from public.feature_usage_daily_install fud
     where fud.install_id = v_install_id
       and fud.feature_key = p_feature_key
       and fud.usage_date = current_date;
    v_install_used := greatest(coalesce(v_install_used, 0), 0);
    v_install_remaining := greatest(v_install_limit - v_install_used, 0);

    v_effective_limit := least(v_user_limit, v_install_limit);
    v_effective_remaining := least(v_user_remaining, v_install_remaining);

    limit_count := v_effective_limit;
    remaining_count := v_effective_remaining;
    used_count := greatest(v_effective_limit - v_effective_remaining, 0);
    allowed := v_effective_remaining > 0;
    reason := case when allowed then 'ok' else 'limit_reached' end;
    return next;
    return;
  end if;

  -- Non-free but still limited tiers (if ever introduced): fall back to user-only.
  limit_count := v_user_limit;
  remaining_count := v_user_remaining;
  used_count := v_user_used;
  allowed := v_user_remaining > 0;
  reason := case when allowed then 'ok' else 'limit_reached' end;
  return next;
end;
$$;

create or replace function public.consume_feature_access(
  p_user_id uuid,
  p_feature_key text,
  p_install_id uuid
)
returns table(
  feature_key text,
  allowed boolean,
  reason text,
  tier text,
  used_count integer,
  remaining_count integer,
  limit_count integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_install_id uuid := public.require_install_id(p_install_id);
  v_tier text;
  v_limit integer;

  v_user_new_used integer;
  v_user_existing_used integer := 0;

  v_install_new_used integer;
  v_install_existing_used integer := 0;

  v_user_remaining integer;
  v_install_remaining integer;
  v_effective_limit integer;
  v_effective_remaining integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_user_id is distinct from v_user_id then
    raise exception 'p_user_id must match auth.uid()';
  end if;

  perform public.ensure_profile_row(v_user_id);
  perform public.ensure_installation(v_install_id);

  select subscription_tier
    into v_tier
    from public.profiles
   where id = v_user_id;

  if v_tier is null then
    v_tier := 'free';
  end if;

  v_limit := public.get_feature_daily_limit(v_tier, p_feature_key);

  feature_key := p_feature_key;
  tier := v_tier;
  reset_at := date_trunc('day', now()) + interval '1 day';
  limit_count := v_limit;

  if v_limit is null then
    allowed := true;
    reason := 'ok';
    used_count := 0;
    remaining_count := null;
    return next;
    return;
  end if;

  -- 1) Consume user-side quota atomically.
  insert into public.feature_usage_daily (
    user_id, feature_key, usage_date, used_count, created_at, updated_at
  )
  values (
    v_user_id, p_feature_key, current_date, 1, now(), now()
  )
  on conflict (user_id, feature_key, usage_date)
  do update
    set used_count = public.feature_usage_daily.used_count + 1,
        updated_at = now()
  where public.feature_usage_daily.used_count < v_limit
  returning public.feature_usage_daily.used_count into v_user_new_used;

  if not found then
    select fud.used_count
      into v_user_existing_used
      from public.feature_usage_daily fud
     where fud.user_id = v_user_id
       and fud.feature_key = p_feature_key
       and fud.usage_date = current_date;
    v_user_existing_used := coalesce(v_user_existing_used, v_limit);

    allowed := false;
    reason := 'limit_reached';
    used_count := v_user_existing_used;
    remaining_count := 0;
    return next;
    return;
  end if;

  -- 2) For free tier, also consume install-side quota.
  if v_tier = 'free' then
    insert into public.feature_usage_daily_install (
      install_id, feature_key, usage_date, used_count, created_at, updated_at
    )
    values (
      v_install_id, p_feature_key, current_date, 1, now(), now()
    )
    on conflict (install_id, feature_key, usage_date)
    do update
      set used_count = public.feature_usage_daily_install.used_count + 1,
          updated_at = now()
    where public.feature_usage_daily_install.used_count < v_limit
    returning public.feature_usage_daily_install.used_count into v_install_new_used;

    if not found then
      -- Install quota already reached; do not roll back user consumption here to keep logic simple.
      -- If you want strict "both-or-none", wrap both updates in a single transactional gate.
      select fud.used_count
        into v_install_existing_used
        from public.feature_usage_daily_install fud
       where fud.install_id = v_install_id
         and fud.feature_key = p_feature_key
         and fud.usage_date = current_date;
      v_install_existing_used := coalesce(v_install_existing_used, v_limit);

      allowed := false;
      reason := 'limit_reached';
      v_effective_limit := v_limit;
      v_user_remaining := greatest(v_limit - v_user_new_used, 0);
      v_install_remaining := 0;
      v_effective_remaining := least(v_user_remaining, v_install_remaining);
      used_count := v_effective_limit - v_effective_remaining;
      remaining_count := v_effective_remaining;
      return next;
      return;
    end if;

    v_user_remaining := greatest(v_limit - v_user_new_used, 0);
    v_install_remaining := greatest(v_limit - v_install_new_used, 0);
    v_effective_limit := v_limit;
    v_effective_remaining := least(v_user_remaining, v_install_remaining);

    allowed := v_effective_remaining > 0;
    reason := case when allowed then 'ok' else 'limit_reached' end;
    used_count := v_effective_limit - v_effective_remaining;
    remaining_count := v_effective_remaining;
    return next;
    return;
  end if;

  -- Non-free but limited tiers: user-only.
  allowed := true;
  reason := 'ok';
  used_count := v_user_new_used;
  remaining_count := greatest(v_limit - v_user_new_used, 0);
  return next;
end;
$$;

-- Tighten grants for updated signatures.
revoke all on function public.ensure_installation(uuid, text, text, text, text) from public;
grant execute on function public.ensure_installation(uuid, text, text, text, text) to authenticated;
grant execute on function public.ensure_installation(uuid, text, text, text, text) to service_role;

revoke all on function public.get_live_minutes_access(uuid, uuid) from public;
grant execute on function public.get_live_minutes_access(uuid, uuid) to authenticated;
grant execute on function public.get_live_minutes_access(uuid, uuid) to service_role;

revoke all on function public.consume_live_session_access(uuid, integer, uuid) from public;
grant execute on function public.consume_live_session_access(uuid, integer, uuid) to authenticated;
grant execute on function public.consume_live_session_access(uuid, integer, uuid) to service_role;

revoke all on function public.check_feature_access(uuid, text, uuid) from public;
grant execute on function public.check_feature_access(uuid, text, uuid) to authenticated;
grant execute on function public.check_feature_access(uuid, text, uuid) to service_role;

revoke all on function public.consume_feature_access(uuid, text, uuid) from public;
grant execute on function public.consume_feature_access(uuid, text, uuid) to authenticated;
grant execute on function public.consume_feature_access(uuid, text, uuid) to service_role;

