do $$
begin
  create extension if not exists pg_cron;
exception
  when others then
    raise notice 'pg_cron is unavailable in this environment: %', sqlerrm;
end
$$;

alter table sessions
  add column if not exists last_activity_at timestamptz not null default now();

update sessions
set last_activity_at = coalesce(ended_at, started_at, created_at, now());

create index if not exists idx_sessions_status_last_activity
  on sessions (status, last_activity_at);

create or replace function public.sync_session_last_activity_from_turn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sessions
  set last_activity_at = greatest(coalesce(last_activity_at, new.created_at), new.created_at)
  where id = new.session_id;

  return new;
end;
$$;

drop trigger if exists trg_turns_touch_session_activity on public.turns;

create trigger trg_turns_touch_session_activity
after insert on public.turns
for each row
execute function public.sync_session_last_activity_from_turn();

create or replace function public.touch_session_activity(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  did_touch boolean;
begin
  update public.sessions
  set last_activity_at = now()
  where id = p_session_id
    and user_id = auth.uid()
    and ended_at is null
    and status in ('active', 'paused')
  returning true into did_touch;

  return coalesce(did_touch, false);
end;
$$;

revoke all on function public.touch_session_activity(uuid) from public;
grant execute on function public.touch_session_activity(uuid) to authenticated;
grant execute on function public.touch_session_activity(uuid) to service_role;

create or replace function public.close_stale_sessions(
  stale_after interval default interval '20 minutes'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  closed_count integer := 0;
begin
  update public.sessions
  set
    status = 'ended',
    ended_at = coalesce(ended_at, last_activity_at, now()),
    duration_seconds = coalesce(
      duration_seconds,
      greatest(
        0,
        floor(
          extract(
            epoch from (
              coalesce(last_activity_at, now()) - started_at
            )
          )
        )::integer
      )
    )
  where status = 'active'
    and ended_at is null
    and last_activity_at < now() - stale_after;

  get diagnostics closed_count = row_count;
  return closed_count;
end;
$$;

revoke all on function public.close_stale_sessions(interval) from public;
grant execute on function public.close_stale_sessions(interval) to service_role;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    begin
      perform cron.unschedule('talkpilot-close-stale-sessions');
    exception
      when others then
        null;
    end;

    perform cron.schedule(
      'talkpilot-close-stale-sessions',
      '*/5 * * * *',
      $job$select public.close_stale_sessions(interval '20 minutes');$job$
    );
  else
    raise notice 'cron schema not found; schedule talkpilot-close-stale-sessions manually after enabling Supabase Cron.';
  end if;
end
$$;
