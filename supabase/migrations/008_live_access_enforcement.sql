alter table public.sessions
  add column if not exists billed_live_minutes integer not null default 0
    check (billed_live_minutes >= 0);

alter table public.sessions
  add column if not exists live_minutes_recorded_at timestamptz;

create or replace function public.get_live_minutes_limit(p_tier text)
returns integer
language plpgsql
immutable
as $$
begin
  case p_tier
    when 'pro' then
      return 120;
    when 'unlimited' then
      return 99999;
    else
      return 10;
  end case;
end;
$$;

create or replace function public.get_live_minutes_access(p_user_id uuid)
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
  v_tier text;
  v_used integer;
  v_reset_at date;
  v_limit integer;
begin
  perform ensure_profile_row(p_user_id);

  select subscription_tier, daily_minutes_used, daily_minutes_reset_at
    into v_tier, v_used, v_reset_at
    from public.profiles
   where id = p_user_id
   for update;

  if v_tier is null then
    v_tier := 'free';
  end if;

  if v_reset_at < current_date then
    update public.profiles
       set daily_minutes_used = 0,
           daily_minutes_reset_at = current_date,
           updated_at = now()
     where id = p_user_id;
    v_used := 0;
  end if;

  v_limit := public.get_live_minutes_limit(v_tier);

  feature_key := 'live_minutes';
  tier := v_tier;
  used_count := coalesce(v_used, 0);
  limit_count := v_limit;
  remaining_count := greatest(v_limit - used_count, 0);
  allowed := used_count < v_limit;
  reason := case when allowed then 'ok' else 'limit_reached' end;
  reset_at := date_trunc('day', now()) + interval '1 day';
  return next;
end;
$$;

create or replace function public.consume_live_session_access(
  p_session_id uuid,
  p_duration_seconds integer
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
  v_session_user_id uuid;
  v_profile_tier text;
  v_profile_used integer;
  v_profile_reset_at date;
  v_limit integer;
  v_recorded_at timestamptz;
  v_minutes_to_consume integer :=
    greatest(ceil(greatest(coalesce(p_duration_seconds, 0), 0)::numeric / 60.0)::integer, 0);
begin
  select
    s.user_id,
    s.live_minutes_recorded_at
    into v_session_user_id, v_recorded_at
    from public.sessions s
   where s.id = p_session_id
     and s.user_id = auth.uid();

  if not found then
    raise exception 'Session not found or not owned by current user';
  end if;

  perform ensure_profile_row(v_session_user_id);

  select subscription_tier, daily_minutes_used, daily_minutes_reset_at
    into v_profile_tier, v_profile_used, v_profile_reset_at
    from public.profiles
   where id = v_session_user_id
   for update;

  if v_profile_tier is null then
    v_profile_tier := 'free';
  end if;

  if v_profile_reset_at < current_date then
    update public.profiles
       set daily_minutes_used = 0,
           daily_minutes_reset_at = current_date,
           updated_at = now()
     where id = v_session_user_id;
    v_profile_used := 0;
  end if;

  v_limit := public.get_live_minutes_limit(v_profile_tier);

  if v_recorded_at is null then
    update public.profiles
       set daily_minutes_used = least(
             v_limit,
             greatest(coalesce(daily_minutes_used, 0), 0) + v_minutes_to_consume
           ),
           updated_at = now()
     where id = v_session_user_id
     returning daily_minutes_used into v_profile_used;

    update public.sessions
       set billed_live_minutes = v_minutes_to_consume,
           live_minutes_recorded_at = now()
     where id = p_session_id;
  else
    v_profile_used := coalesce(v_profile_used, 0);
  end if;

  feature_key := 'live_minutes';
  tier := v_profile_tier;
  used_count := coalesce(v_profile_used, 0);
  limit_count := v_limit;
  remaining_count := greatest(v_limit - used_count, 0);
  allowed := used_count < v_limit;
  reason := case when allowed then 'ok' else 'limit_reached' end;
  reset_at := date_trunc('day', now()) + interval '1 day';
  return next;
end;
$$;

create or replace function public.reset_free_access_debug()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform ensure_profile_row(v_user_id);

  update public.profiles
     set daily_minutes_used = 0,
         daily_minutes_reset_at = current_date,
         updated_at = now()
   where id = v_user_id;

  delete from public.feature_usage_daily
   where user_id = v_user_id
     and usage_date = current_date;

  return true;
end;
$$;

revoke all on function public.get_live_minutes_access(uuid) from public;
grant execute on function public.get_live_minutes_access(uuid) to authenticated;
grant execute on function public.get_live_minutes_access(uuid) to service_role;

revoke all on function public.consume_live_session_access(uuid, integer) from public;
grant execute on function public.consume_live_session_access(uuid, integer) to authenticated;
grant execute on function public.consume_live_session_access(uuid, integer) to service_role;

revoke all on function public.reset_free_access_debug() from public;
grant execute on function public.reset_free_access_debug() to authenticated;
grant execute on function public.reset_free_access_debug() to service_role;
