import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCareerProfiles } from "@/services/career-profile-service";
import { getCurrentUser } from "@/services/auth/current-user";
import { listApplicationsByProfileId } from "@/services/applications/application-service";

const statuses = ["planned", "applied", "resume_screen", "written_test", "interviewing", "offer", "rejected", "no_response", "review"] as const;

export default async function ApplicationPipelinePage() {
  const user = await getCurrentUser();
  const profiles = await getCareerProfiles(user.id);
  const applications = (await Promise.all(profiles.map((profile) => listApplicationsByProfileId(profile.id)))).flat();

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">投递看板</h1>
        <Button asChild variant="outline"><Link href="/applications">返回工作台</Link></Button>
      </div>
      <section className="grid gap-4 lg:grid-cols-4">
        {statuses.map((status) => {
          const group = applications.filter((application) => application.status === status);
          return (
            <Card key={status}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <StatusBadge value={status} />
                  <span>{group.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {group.length === 0 ? <div className="text-muted-foreground">暂无</div> : null}
                {group.map((application) => (
                  <div key={application.id} className="rounded-md border p-3">
                    <div className="font-medium">{application.company}</div>
                    <div>{application.jobTitle}</div>
                    <Button asChild variant="outline" className="mt-3 w-full"><Link href={`/applications/${application.id}`}>详情</Link></Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </section>
    </main>
  );
}
