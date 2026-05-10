-- Debug-only: reset both account-level and install-level free usage for today.
-- This is intended for development/debug panels only.

create or replace function public.reset_free_access_debug(p_install_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_install_id uuid := public.require_install_id(p_install_id);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform public.ensure_profile_row(v_user_id);
  perform public.ensure_installation(v_install_id);

  -- Account-level: live minutes + feature quotas.
  update public.profiles
     set daily_minutes_used = 0,
         daily_minutes_reset_at = current_date,
         updated_at = now()
   where id = v_user_id;

  delete from public.feature_usage_daily
   where user_id = v_user_id
     and usage_date = current_date;

  -- Install-level: live minutes + feature quotas.
  delete from public.live_minutes_usage_daily_install
   where install_id = v_install_id
     and usage_date = current_date;

  delete from public.feature_usage_daily_install
   where install_id = v_install_id
     and usage_date = current_date;

  return true;
end;
$$;

revoke all on function public.reset_free_access_debug(uuid) from public;
grant execute on function public.reset_free_access_debug(uuid) to authenticated;
grant execute on function public.reset_free_access_debug(uuid) to service_role;

