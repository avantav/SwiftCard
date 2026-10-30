-- Repair PostgREST schema exposure if the authenticator role configuration
-- drifted after the original app-schema migration was applied.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    execute 'alter role authenticator set pgrst.db_schemas = ''public, app, graphql_public''';
  end if;
end;
$$;

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
