import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = resolve(import.meta.dirname, "..");
const migrationsDirectory = resolve(projectRoot, "supabase/migrations");
const databaseUrl = process.env.SUPABASE_DB_URL;

if (!databaseUrl) {
  throw new Error("SUPABASE_DB_URL is required");
}

const migrationFiles = readdirSync(migrationsDirectory)
  .filter((file) => /^\d+_.+\.sql$/.test(file))
  .sort();

function runPsql(args, input) {
  const result = spawnSync(
    "psql",
    [databaseUrl, "--no-psqlrc", "--set", "ON_ERROR_STOP=1", ...args],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: { ...process.env, PGCONNECT_TIMEOUT: "15" },
      input,
      maxBuffer: 20 * 1024 * 1024
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const details = [result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n")
      .trim();
    throw new Error(`psql failed${details ? `:\n${details}` : ""}`);
  }

  return result.stdout.trim();
}

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

runPsql(
  [],
  `
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text not null primary key
);
alter table supabase_migrations.schema_migrations
  add column if not exists statements text[];
alter table supabase_migrations.schema_migrations
  add column if not exists name text;
`
);

const existingSchema = runPsql(
  ["--tuples-only", "--no-align", "--command", "select to_regclass('public.tenants') is not null"]
);
const appliedVersions = new Set(
  runPsql([
    "--tuples-only",
    "--no-align",
    "--command",
    "select version from supabase_migrations.schema_migrations order by version"
  ])
    .split("\n")
    .filter(Boolean)
);

if (existingSchema === "t" && appliedVersions.size === 0) {
  throw new Error(
    "Refusing to apply migrations: public.tenants exists but migration history is empty"
  );
}

for (const file of migrationFiles) {
  const match = /^(\d+)_(.+)\.sql$/.exec(file);

  if (!match) {
    continue;
  }

  const [, version, name] = match;

  if (appliedVersions.has(version)) {
    console.log(`SKIP supabase/migrations/${file}`);
    continue;
  }

  const migrationSql = readFileSync(resolve(migrationsDirectory, file), "utf8");
  const trackedStatement = sqlLiteral(migrationSql);
  const trackedName = sqlLiteral(name);

  runPsql(
    [],
    `begin;
${migrationSql}
insert into supabase_migrations.schema_migrations (version, statements, name)
values (${sqlLiteral(version)}, array[${trackedStatement}]::text[], ${trackedName});
commit;
`
  );

  console.log(`PASS supabase/migrations/${file}`);
}

runPsql([], "notify pgrst, 'reload schema';\n");
console.log("Remote migrations are up to date");
