drop function if exists public.list_history_sessions();

create or replace function public.list_history_sessions(
  p_limit integer default 30,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  scene_preset text,
  scene_description text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  status text,
  recap jsonb,
  total_sessions integer,
  total_duration_seconds integer,
  completed_count integer
)
language sql
security definer
set search_path = public
as $$
  with filtered_sessions as (
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
  )
  select
    fs.id,
    fs.title,
    fs.scene_preset,
    fs.scene_description,
    fs.started_at,
    fs.ended_at,
    fs.duration_seconds,
    fs.status,
    fs.recap,
    (count(*) over ())::integer as total_sessions,
    coalesce(sum(greatest(coalesce(fs.duration_seconds, 0), 0)) over (), 0)::integer
      as total_duration_seconds,
    (count(*) filter (where fs.status = 'ended') over ())::integer
      as completed_count
  from filtered_sessions fs
  order by fs.started_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 30)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.list_history_sessions(integer, integer) from public;
grant execute on function public.list_history_sessions(integer, integer) to authenticated;
grant execute on function public.list_history_sessions(integer, integer) to service_role;
