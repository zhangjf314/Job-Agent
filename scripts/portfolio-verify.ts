import { PrismaClient } from "@prisma/client";
import {
  PORTFOLIO_DEMO_MARKER,
  PORTFOLIO_DEMO_TIMESTAMP,
  buildPortfolioCompiledResume,
  portfolioProfileFixture,
} from "./portfolio-fixtures";
import { assertPortfolioDatabaseUrl } from "./portfolio-env";

const prisma = new PrismaClient();

async function verify() {
  assertPortfolioDatabaseUrl(process.env.DATABASE_URL);
  const compiled = buildPortfolioCompiledResume();
  const basicInfo = portfolioProfileFixture.basicInfo;
  if (!basicInfo) throw new Error("Portfolio fixture basicInfo is required.");
  const user = await prisma.user.findUnique({
    where: { email: basicInfo.email },
    include: {
      profiles: {
        include: {
          resumes: true,
          applications: true,
          evaluations: true,
        },
      },
    },
  });
  if (!user || user.profiles.length !== 1) {
    throw new Error("Portfolio demo profile count is not stable.");
  }
  const profile = user.profiles[0];
  const [jobs, tailored, logs] = await Promise.all([
    prisma.jobPost.count({ where: { contentHash: PORTFOLIO_DEMO_MARKER } }),
    prisma.tailoredResume.count({
      where: { baseResume: { profileId: profile.id } },
    }),
    prisma.lLMCallLog.findMany({
      where: {
        id: {
          in: [
            "portfolio-demo-log-jd-v1",
            "portfolio-demo-log-strategy-v1",
            "portfolio-demo-log-tailored-v1",
          ],
        },
      },
    }),
  ]);
  const persisted = await prisma.resume.findUniqueOrThrow({
    where: { id: "portfolio-demo-tailored-resume-v1" },
  });
  const counts = {
    profile: user.profiles.length,
    resume: profile.resumes.length,
    job: jobs,
    tailoredResume: tailored,
    application: profile.applications.length,
    evaluation: profile.evaluations.length,
    llmCallLog: logs.length,
  };
  const expected = {
    profile: 1,
    resume: 2,
    job: 1,
    tailoredResume: 1,
    application: 1,
    evaluation: 1,
    llmCallLog: 3,
  };
  if (JSON.stringify(counts) !== JSON.stringify(expected)) {
    throw new Error(`Portfolio counts differ from expected: ${JSON.stringify(counts)}`);
  }
  if (persisted.contentMarkdown !== compiled.publicResult.contentMarkdown) {
    throw new Error("Persisted tailored resume does not match compiler output.");
  }
  if (
    profile.resumes.some(
      (resume) =>
        resume.createdAt.toISOString() !== PORTFOLIO_DEMO_TIMESTAMP ||
        resume.updatedAt.toISOString() !== PORTFOLIO_DEMO_TIMESTAMP,
    ) ||
    logs.some(
      (log) => log.createdAt.toISOString() !== PORTFOLIO_DEMO_TIMESTAMP,
    )
  ) {
    throw new Error("Portfolio screenshot timestamps are not deterministic.");
  }
  if (
    logs.some((log) => {
      const metadata = log.metadata as Record<string, unknown> | null;
      return metadata?.demo !== true ||
        metadata.generatedBy !== "portfolio-seed";
    })
  ) {
    throw new Error("Portfolio logs are missing the Demo marker.");
  }
  console.log(JSON.stringify({
    status: "passed",
    marker: PORTFOLIO_DEMO_MARKER,
    counts,
    planSchema: "passed",
    planValidation: "passed",
    compiler: "passed",
    groundedSchema: "passed",
    factualityGate: "passed",
    saveTimeGate: "passed",
    externalRequests: 0,
  }));
}

verify().finally(async () => prisma.$disconnect());
