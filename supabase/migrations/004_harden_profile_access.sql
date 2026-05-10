create or replace function ensure_profile_row(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id)
  values (p_user_id)
  on conflict (id) do nothing;
end;
$$;

create or replace function check_daily_usage(p_user_id uuid)
returns table(minutes_used integer, minutes_remaining integer, is_limit_reached boolean)
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
    from profiles
   where id = p_user_id;

  if v_reset_at < current_date then
    update profiles
       set daily_minutes_used = 0,
           daily_minutes_reset_at = current_date,
           updated_at = now()
     where id = p_user_id;
    v_used := 0;
  end if;

  case v_tier
    when 'free' then v_limit := 10;
    when 'pro' then v_limit := 120;
    when 'unlimited' then v_limit := 99999;
    else v_limit := 10;
  end case;

  minutes_used := coalesce(v_used, 0);
  minutes_remaining := greatest(v_limit - minutes_used, 0);
  is_limit_reached := minutes_used >= v_limit;
  return next;
end;
$$;

create or replace function check_feature_access(
  p_user_id uuid,
  p_feature_key text
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
  v_tier text;
  v_used integer := 0;
  v_limit integer;
begin
  perform ensure_profile_row(p_user_id);

  select subscription_tier
    into v_tier
    from profiles
   where id = p_user_id;

  if v_tier is null then
    v_tier := 'free';
  end if;

  v_limit := get_feature_daily_limit(v_tier, p_feature_key);

  select fud.used_count
    into v_used
    from feature_usage_daily fud
   where fud.user_id = p_user_id
     and fud.feature_key = p_feature_key
     and fud.usage_date = current_date;

  v_used := coalesce(v_used, 0);

  feature_key := p_feature_key;
  tier := v_tier;
  used_count := v_used;
  limit_count := v_limit;
  reset_at := date_trunc('day', now()) + interval '1 day';

  if v_limit is null then
    allowed := true;
    reason := 'ok';
    remaining_count := null;
  else
    remaining_count := greatest(v_limit - v_used, 0);
    allowed := v_used < v_limit;
    reason := case when allowed then 'ok' else 'limit_reached' end;
  end if;

  return next;
end;
$$;

create or replace function consume_feature_access(
  p_user_id uuid,
  p_feature_key text
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
  v_tier text;
  v_limit integer;
  v_new_used integer;
  v_existing_used integer := 0;
begin
  perform ensure_profile_row(p_user_id);

  select subscription_tier
    into v_tier
    from profiles
   where id = p_user_id;

  if v_tier is null then
    v_tier := 'free';
  end if;

  v_limit := get_feature_daily_limit(v_tier, p_feature_key);

  feature_key := p_feature_key;
  tier := v_tier;
  limit_count := v_limit;
  reset_at := date_trunc('day', now()) + interval '1 day';

  if v_limit is null then
    allowed := true;
    reason := 'ok';
    used_count := 0;
    remaining_count := null;
    return next;
    return;
  end if;

  insert into feature_usage_daily (
    user_id,
    feature_key,
    usage_date,
    used_count,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    p_feature_key,
    current_date,
    1,
    now(),
    now()
  )
  on conflict (user_id, feature_key, usage_date)
  do update
    set used_count = feature_usage_daily.used_count + 1,
        updated_at = now()
  where feature_usage_daily.used_count < v_limit
  returning feature_usage_daily.used_count into v_new_used;

  if found then
    allowed := true;
    reason := 'ok';
    used_count := v_new_used;
    remaining_count := greatest(v_limit - v_new_used, 0);
    return next;
    return;
  end if;

  select fud.used_count
    into v_existing_used
    from feature_usage_daily fud
   where fud.user_id = p_user_id
     and fud.feature_key = p_feature_key
     and fud.usage_date = current_date;

  v_existing_used := coalesce(v_existing_used, v_limit);

  allowed := false;
  reason := 'limit_reached';
  used_count := v_existing_used;
  remaining_count := 0;
  return next;
end;
$$;
