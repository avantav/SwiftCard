\set ON_ERROR_STOP on

do $$
begin
  if to_regprocedure('app.support_set_tenant_location_validation_mode(uuid,public.location_validation_mode,text)') is null then
    raise exception 'Support branch configuration RPC is missing';
  end if;
  if not has_function_privilege(
    'authenticated',
    'app.support_set_tenant_location_validation_mode(uuid,public.location_validation_mode,text)',
    'execute'
  ) then
    raise exception 'Authenticated role cannot execute support branch configuration RPC';
  end if;
end;
$$;

reset role;
