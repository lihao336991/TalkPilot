-- Remove per-day usage caps for AI review and reply suggestions.
-- Live conversation minutes remain enforced by the live_minutes RPCs.

create or replace function public.get_feature_daily_limit(
  p_tier text,
  p_feature_key text
)
returns integer
language plpgsql
immutable
as $$
begin
  case p_feature_key
    when 'review' then
      return null;
    when 'suggestion' then
      return null;
    else
      raise exception 'Unsupported feature key: %', p_feature_key;
  end case;
end;
$$;
