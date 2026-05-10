alter table profiles
  add column if not exists subscription_provider text,
  add column if not exists subscription_status text,
  add column if not exists subscription_expires_at timestamptz,
  add column if not exists revenuecat_app_user_id text;

create table if not exists billing_customers (
  user_id uuid primary key references profiles(id) on delete cascade,
  revenuecat_app_user_id text not null unique,
  original_app_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists billing_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  provider text not null default 'revenuecat',
  platform text,
  product_id text,
  entitlement_id text not null,
  status text not null,
  is_active boolean not null default false,
  will_renew boolean,
  period_type text,
  expires_at timestamptz,
  grace_period_expires_at timestamptz,
  trial_ends_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, entitlement_id)
);

create index if not exists idx_billing_subscriptions_user_id
  on billing_subscriptions (user_id);

create index if not exists idx_billing_subscriptions_active
  on billing_subscriptions (entitlement_id, is_active);

create table if not exists billing_webhook_events (
  event_id text primary key,
  event_type text not null,
  app_user_id text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received',
  payload jsonb not null,
  error_message text
);

alter table billing_customers enable row level security;
alter table billing_subscriptions enable row level security;
alter table billing_webhook_events enable row level security;

create policy "billing_customers_select_own" on billing_customers
  for select using (auth.uid() = user_id);

create policy "billing_subscriptions_select_own" on billing_subscriptions
  for select using (auth.uid() = user_id);

create or replace function apply_billing_entitlement(
  p_user_id uuid,
  p_provider text,
  p_app_user_id text,
  p_original_app_user_id text,
  p_platform text,
  p_product_id text,
  p_entitlement_id text,
  p_status text,
  p_is_active boolean,
  p_will_renew boolean,
  p_period_type text,
  p_expires_at timestamptz,
  p_grace_period_expires_at timestamptz,
  p_trial_ends_at timestamptz,
  p_raw_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription_tier text;
  v_subscription_status text;
begin
  insert into billing_customers (
    user_id,
    revenuecat_app_user_id,
    original_app_user_id
  )
  values (
    p_user_id,
    p_app_user_id,
    p_original_app_user_id
  )
  on conflict (user_id) do update
    set revenuecat_app_user_id = excluded.revenuecat_app_user_id,
        original_app_user_id = excluded.original_app_user_id,
        updated_at = now();

  insert into billing_subscriptions (
    user_id,
    provider,
    platform,
    product_id,
    entitlement_id,
    status,
    is_active,
    will_renew,
    period_type,
    expires_at,
    grace_period_expires_at,
    trial_ends_at,
    raw_payload
  )
  values (
    p_user_id,
    coalesce(nullif(p_provider, ''), 'revenuecat'),
    p_platform,
    p_product_id,
    p_entitlement_id,
    p_status,
    coalesce(p_is_active, false),
    p_will_renew,
    p_period_type,
    p_expires_at,
    p_grace_period_expires_at,
    p_trial_ends_at,
    coalesce(p_raw_payload, '{}'::jsonb)
  )
  on conflict (user_id, provider, entitlement_id) do update
    set platform = excluded.platform,
        product_id = excluded.product_id,
        status = excluded.status,
        is_active = excluded.is_active,
        will_renew = excluded.will_renew,
        period_type = excluded.period_type,
        expires_at = excluded.expires_at,
        grace_period_expires_at = excluded.grace_period_expires_at,
        trial_ends_at = excluded.trial_ends_at,
        raw_payload = excluded.raw_payload,
        updated_at = now();

  v_subscription_tier := case
    when p_entitlement_id = 'pro' and coalesce(p_is_active, false) then 'pro'
    else 'free'
  end;

  v_subscription_status := case
    when coalesce(p_is_active, false) then coalesce(nullif(p_status, ''), 'active')
    else coalesce(nullif(p_status, ''), 'inactive')
  end;

  update profiles
     set subscription_tier = v_subscription_tier,
         subscription_provider = coalesce(nullif(p_provider, ''), 'revenuecat'),
         subscription_status = v_subscription_status,
         subscription_expires_at = p_expires_at,
         revenuecat_app_user_id = p_app_user_id,
         updated_at = now()
   where id = p_user_id;
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
