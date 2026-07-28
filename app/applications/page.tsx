import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCareerProfiles, getOrCreateDemoUser } from "@/services/career-profile-service";
import { getApplicationPipelineSummary, listApplicationsByProfileId } from "@/services/applications/application-service";

export default async function ApplicationsPage() {
  const user = await getOrCreateDemoUser();
  const profiles = await getCareerProfiles(user.id);
  const applications = (await Promise.all(profiles.map((profile) => listApplicationsByProfileId(profile.id)))).flat();
  const summary = profiles[0] ? await getApplicationPipelineSummary(profiles[0].id) : null;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">投递工作台</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            记录投递、面试、任务和录用机会；系统不会自动投递或访问外部平台。
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href="/applications/pipeline">投递看板</Link></Button>
          <Button asChild><Link href="/applications/new">新建投递</Link></Button>
        </div>
      </div>

      {summary ? (
        <Card>
          <CardHeader><CardTitle>投递统计</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-5">
            {Object.entries(summary).map(([status, count]) => (
              <div key={status} className="rounded-md border p-3">
                <StatusBadge value={status} />
                <div className="mt-2 text-xl">{count}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-4">
        {applications.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              暂无投递记录，可以从岗位匹配或收藏岗位加入投递流程。
            </CardContent>
          </Card>
        ) : null}
        {applications.map((application) => (
          <Card key={application.id}>
            <CardHeader>
              <CardTitle>{application.company} · {application.jobTitle}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span>{application.city ?? "城市未填写"}</span>
                <StatusBadge value={application.status} />
                <StatusBadge value={application.priority} />
              </div>
              <div>任务 {application.tasks.length} · 面试 {application.interviewRounds.length} · 录用机会 {application.offers.length}</div>
              <Button asChild variant="outline"><Link href={`/applications/${application.id}`}>查看详情</Link></Button>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
