import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hasDatabaseUrl } from "@/lib/config";
import { seedDemoData } from "@/services/demo-seed-service";
import { generateApplicationInsight } from "@/services/applications/application-service";

const maybeDescribe = hasDatabaseUrl() ? describe : describe.skip;

async function canUseDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.warn(`Skipping MVP database smoke flow: ${(error as Error).message.split("\n")[0]}`);
    return false;
  }
}

maybeDescribe("MVP database smoke flow", () => {
  it("seeds and verifies the end-to-end job search loop", async () => {
    if (!(await canUseDatabase())) return;
    const seeded = await seedDemoData(prisma);
    expect(seeded.profile.id).toBeTruthy();
    expect(seeded.resume.type).toBe("general");
    expect(seeded.jdAnalysis.matchScore).toBeGreaterThan(0);
    expect(seeded.tailoredResume.type).toBe("jd_tailored");
    expect(seeded.strategy.recommendations.length).toBeGreaterThan(0);
    expect(seeded.jobs.length).toBeGreaterThanOrEqual(5);
    expect(seeded.matches.length).toBeGreaterThanOrEqual(5);
    expect(seeded.applications.length).toBeGreaterThanOrEqual(3);
    const insight = await generateApplicationInsight(seeded.applications[2]!.id, prisma);
    expect(insight.nextBestActions.length).toBeGreaterThan(0);
  }, 120000);
});
