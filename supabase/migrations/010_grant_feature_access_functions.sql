revoke all on function public.check_feature_access(uuid, text) from public;
grant execute on function public.check_feature_access(uuid, text) to authenticated;
grant execute on function public.check_feature_access(uuid, text) to service_role;

revoke all on function public.consume_feature_access(uuid, text) from public;
grant execute on function public.consume_feature_access(uuid, text) to authenticated;
grant execute on function public.consume_feature_access(uuid, text) to service_role;
