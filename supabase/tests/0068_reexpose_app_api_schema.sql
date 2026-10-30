\set ON_ERROR_STOP on

do $$
begin
  if not has_function_privilege(
    'authenticated',
    'app.start_support_impersonation_session(uuid,text,text)',
    'execute'
  ) then
    raise exception 'Authenticated role cannot execute app RPCs';
  end if;

  if to_regprocedure('app.start_support_impersonation_session(uuid,text,text)') is null then
    raise exception 'Support RPC is unavailable after schema repair';
  end if;
end;
$$;

reset role;
