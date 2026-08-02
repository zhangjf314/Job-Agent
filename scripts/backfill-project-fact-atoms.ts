import { PrismaClient } from "@prisma/client";
import { backfillProjectFactAtoms } from "../services/project-facts/project-fact-service";

function option(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const db = new PrismaClient();
  try {
    const summary = await backfillProjectFactAtoms({
      profileId: option("profile"),
      dryRun: process.argv.includes("--dry-run"),
      db,
    });
    process.stdout.write(`${JSON.stringify({
      dryRun: process.argv.includes("--dry-run"),
      ...summary,
    })}\n`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
