-- Expose the intentionally permission-scoped application RPC schema through PostgREST.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    execute 'alter role authenticator set pgrst.db_schemas = ''public, app, graphql_public''';
  end if;
end;
$$;

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
