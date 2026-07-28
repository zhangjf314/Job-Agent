import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppConfig, hasDatabaseUrl } from "@/lib/config";
import { DatabaseNotConfiguredError } from "@/lib/errors";

type DbClient = PrismaClient;

export async function getCurrentUser(db: DbClient = prisma) {
  if (db === prisma && !hasDatabaseUrl()) throw new DatabaseNotConfiguredError();
  const email = getAppConfig().demoUserEmail;
  return db.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Demo User" },
  });
}

export async function getCurrentUserOrNull(db: DbClient = prisma) {
  try {
    return await getCurrentUser(db);
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) return null;
    throw error;
  }
}
