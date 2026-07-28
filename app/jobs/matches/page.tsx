import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createApplicationFromJobMatchAction } from "@/app/applications/actions";
import { getCareerProfiles, getOrCreateDemoUser } from "@/services/career-profile-service";
import { listJobMatchesByProfileId } from "@/services/jobs/job-service";

export default async function JobMatchesPage() {
  const user = await getOrCreateDemoUser();
  const profiles = await getCareerProfiles(user.id);
  const matches = profiles[0] ? await listJobMatchesByProfileId(profiles[0].id) : [];

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <h1 className="text-2xl font-semibold">岗位匹配结果</h1>
      {matches.map((match) => (
        <Card key={match.id}>
          <CardHeader>
            <CardTitle>{match.jobPost.title} · {match.matchScore}/100 · {match.recommendation}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-3">
            <div>匹配点：{match.matchedPoints.join("、") || "暂无"}</div>
            <div>差距：{match.gaps.join("、") || "暂无"}</div>
            <div>风险：{match.riskWarnings.join("、") || "暂无"}</div>
            <div className="flex flex-wrap gap-2 md:col-span-3">
              <Button asChild variant="outline"><Link href={`/jobs/${match.jobPostId}`}>岗位详情</Link></Button>
              <form action={createApplicationFromJobMatchAction}>
                <input type="hidden" name="profileId" value={match.profileId} />
                <input type="hidden" name="jobMatchId" value={match.id} />
                <Button type="submit">加入投递流程</Button>
              </form>
            </div>
          </CardContent>
        </Card>
      ))}
    </main>
  );
}
