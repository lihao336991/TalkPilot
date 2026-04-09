create extension if not exists "uuid-ossp";

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  native_language text not null default 'zh-CN',
  proficiency_level text not null default 'intermediate',
  subscription_tier text not null default 'free',
  daily_minutes_used integer not null default 0,
  daily_minutes_reset_at date not null default current_date,
  self_speaker_id integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  scene_preset text,
  scene_description text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table turns (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  turn_id text not null,
  speaker text not null check (speaker in ('self', 'other')),
  text text not null,
  confidence real,
  created_at timestamptz not null default now()
);

create index idx_turns_session_created on turns (session_id, created_at);

create table suggestions (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  trigger_turn_id text,
  suggestions jsonb not null,
  user_action text,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create table reviews (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  user_utterance text not null,
  overall_score text check (overall_score in ('green', 'yellow', 'red')),
  issues jsonb,
  better_expression text,
  praise text,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create table vocabulary (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  word text not null,
  context_sentence text,
  source_session_id uuid references sessions(id) on delete set null,
  mastery_level integer not null default 0,
  created_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  unique (user_id, word)
);

alter table profiles enable row level security;
alter table sessions enable row level security;
alter table turns enable row level security;
alter table suggestions enable row level security;
alter table reviews enable row level security;
alter table vocabulary enable row level security;

create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

create policy "profiles_delete_own" on profiles
  for delete using (auth.uid() = id);

create policy "sessions_select_own" on sessions
  for select using (auth.uid() = user_id);

create policy "sessions_insert_own" on sessions
  for insert with check (auth.uid() = user_id);

create policy "sessions_update_own" on sessions
  for update using (auth.uid() = user_id);

create policy "sessions_delete_own" on sessions
  for delete using (auth.uid() = user_id);

create policy "turns_select_own" on turns
  for select using (
    exists (select 1 from sessions where sessions.id = turns.session_id and sessions.user_id = auth.uid())
  );

create policy "turns_insert_own" on turns
  for insert with check (
    exists (select 1 from sessions where sessions.id = turns.session_id and sessions.user_id = auth.uid())
  );

create policy "turns_update_own" on turns
  for update using (
    exists (select 1 from sessions where sessions.id = turns.session_id and sessions.user_id = auth.uid())
  );

create policy "turns_delete_own" on turns
  for delete using (
    exists (select 1 from sessions where sessions.id = turns.session_id and sessions.user_id = auth.uid())
  );

create policy "suggestions_select_own" on suggestions
  for select using (
    exists (select 1 from sessions where sessions.id = suggestions.session_id and sessions.user_id = auth.uid())
  );

create policy "suggestions_insert_own" on suggestions
  for insert with check (
    exists (select 1 from sessions where sessions.id = suggestions.session_id and sessions.user_id = auth.uid())
  );

create policy "suggestions_update_own" on suggestions
  for update using (
    exists (select 1 from sessions where sessions.id = suggestions.session_id and sessions.user_id = auth.uid())
  );

create policy "suggestions_delete_own" on suggestions
  for delete using (
    exists (select 1 from sessions where sessions.id = suggestions.session_id and sessions.user_id = auth.uid())
  );

create policy "reviews_select_own" on reviews
  for select using (
    exists (select 1 from sessions where sessions.id = reviews.session_id and sessions.user_id = auth.uid())
  );

create policy "reviews_insert_own" on reviews
  for insert with check (
    exists (select 1 from sessions where sessions.id = reviews.session_id and sessions.user_id = auth.uid())
  );

create policy "reviews_update_own" on reviews
  for update using (
    exists (select 1 from sessions where sessions.id = reviews.session_id and sessions.user_id = auth.uid())
  );

create policy "reviews_delete_own" on reviews
  for delete using (
    exists (select 1 from sessions where sessions.id = reviews.session_id and sessions.user_id = auth.uid())
  );

create policy "vocabulary_select_own" on vocabulary
  for select using (auth.uid() = user_id);

create policy "vocabulary_insert_own" on vocabulary
  for insert with check (auth.uid() = user_id);

create policy "vocabulary_update_own" on vocabulary
  for update using (auth.uid() = user_id);

create policy "vocabulary_delete_own" on vocabulary
  for delete using (auth.uid() = user_id);

create or replace function check_daily_usage(p_user_id uuid)
returns table(minutes_used integer, minutes_remaining integer, is_limit_reached boolean)
language plpgsql security definer as $$
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
    when 'pro'  then v_limit := 120;
    when 'unlimited' then v_limit := 99999;
    else v_limit := 10;
  end case;

  minutes_used := v_used;
  minutes_remaining := greatest(v_limit - v_used, 0);
  is_limit_reached := v_used >= v_limit;
  return next;
end;
$$;
