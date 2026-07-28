/* eslint-disable @typescript-eslint/no-require-imports */
const { spawnSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const legacyMigrations = [
  "20260615080000_initial_career_profile",
  "20260615092000_add_resume_center",
  "20260615103000_add_jd_tailoring",
  "20260615113000_add_career_strategy",
  "20260615123000_add_jobs_module",
  "20260615133000_add_applications_workbench",
];

function resolveApplied(name) {
  const prismaCli = require.resolve("prisma/build/index.js");
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "resolve", "--applied", name], {
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) throw new Error(`Unable to baseline migration ${name}.`);
}

async function main() {
  const tables = await prisma.$queryRaw`
    SELECT to_regclass('public."CareerProfile"')::text AS name
  `;
  if (!tables[0]?.name) {
    console.log("No legacy CareerProfile table found; a clean database will use the full migration chain.");
    return;
  }

  const migrationTable = await prisma.$queryRaw`
    SELECT to_regclass('public._prisma_migrations')::text AS name
  `;
  let applied = new Set();
  if (migrationTable[0]?.name) {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
    );
    applied = new Set(rows.map((row) => row.migration_name));
  }

  for (const migration of legacyMigrations) {
    if (!applied.has(migration)) resolveApplied(migration);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Unable to baseline existing database.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
