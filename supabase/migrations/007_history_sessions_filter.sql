create or replace function public.list_history_sessions()
returns table (
  id uuid,
  title text,
  scene_preset text,
  scene_description text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  status text,
  recap jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    s.id,
    s.title,
    s.scene_preset,
    s.scene_description,
    s.started_at,
    s.ended_at,
    s.duration_seconds,
    s.status,
    s.recap
  from public.sessions s
  where s.user_id = auth.uid()
    and s.status = 'ended'
    and exists (
      select 1
      from public.turns t_self
      where t_self.session_id = s.id
        and t_self.speaker = 'self'
    )
    and exists (
      select 1
      from public.turns t_other
      where t_other.session_id = s.id
        and t_other.speaker = 'other'
    )
  order by s.started_at desc;
$$;

revoke all on function public.list_history_sessions() from public;
grant execute on function public.list_history_sessions() to authenticated;
grant execute on function public.list_history_sessions() to service_role;
