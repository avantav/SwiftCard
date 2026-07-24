import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const containerName = `swiftwallet-rls-${process.pid}`;
const databaseName = "swiftwallet_rls_test";
const postgresImage = process.env.POSTGRES_TEST_IMAGE ?? "postgres:16-alpine";
const projectRoot = resolve(import.meta.dirname, "..");

const migrationFiles = readdirSync(resolve(projectRoot, "supabase/migrations"))
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => `supabase/migrations/${file}`);
const verificationFiles = readdirSync(resolve(projectRoot, "supabase/tests"))
  .filter((file) => file.endsWith(".sql") && file !== "auth_bootstrap.sql")
  .sort()
  .map((file) => `supabase/tests/${file}`);
const sqlFiles = [
  "supabase/tests/auth_bootstrap.sql",
  ...migrationFiles,
  ...verificationFiles
];

function runDocker(args, options = {}) {
  const result = spawnSync("docker", args, {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    ...options
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`docker ${args.join(" ")} failed${details ? `:\n${details}` : ""}`);
  }

  return result;
}

function applySql(relativePath) {
  const absolutePath = resolve(projectRoot, relativePath);
  const sql = readFileSync(absolutePath, "utf8");

  runDocker(
    [
      "exec",
      "-i",
      containerName,
      "psql",
      "--username",
      "postgres",
      "--dbname",
      databaseName,
      "--set",
      "ON_ERROR_STOP=1",
      "--no-psqlrc"
    ],
    { input: sql }
  );

  console.log(`PASS ${relativePath}`);
}

async function waitForPostgres() {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    const result = spawnSync(
      "docker",
      [
        "exec",
        containerName,
        "pg_isready",
        "--username",
        "postgres",
        "--dbname",
        databaseName
      ],
      { cwd: projectRoot, encoding: "utf8" }
    );

    if (result.status === 0) {
      const databaseCheck = spawnSync(
        "docker",
        [
          "exec",
          containerName,
          "psql",
          "--username",
          "postgres",
          "--dbname",
          databaseName,
          "--command",
          "select 1",
          "--no-psqlrc"
        ],
        { cwd: projectRoot, encoding: "utf8" }
      );

      if (databaseCheck.status === 0) {
        return;
      }
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }

  throw new Error("PostgreSQL did not become ready within 30 seconds");
}

async function main() {
  let containerStarted = false;

  try {
    runDocker([
      "run",
      "--detach",
      "--name",
      containerName,
      "--env",
      "POSTGRES_PASSWORD=postgres",
      "--env",
      `POSTGRES_DB=${databaseName}`,
      postgresImage
    ]);
    containerStarted = true;

    await waitForPostgres();

    for (const sqlFile of sqlFiles) {
      applySql(sqlFile);
    }

    console.log("RLS verification passed");
  } finally {
    if (containerStarted) {
      const cleanup = spawnSync("docker", ["rm", "--force", containerName], {
        cwd: projectRoot,
        encoding: "utf8"
      });

      if (cleanup.status !== 0) {
        console.error(`Unable to remove temporary container ${containerName}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
