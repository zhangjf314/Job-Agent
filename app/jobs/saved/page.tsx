import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createApplicationFromSavedJobAction } from "@/app/applications/actions";
import { getCareerProfiles, getOrCreateDemoUser } from "@/services/career-profile-service";
import { listSavedJobsByProfileId } from "@/services/jobs/job-service";
import { updateSavedJobStatusAction } from "../actions";

const savedStatuses = [
  ["saved", "已收藏"],
  ["applied", "已投递"],
  ["interviewing", "面试中"],
  ["offer", "已获录用机会"],
  ["rejected", "已拒绝"],
  ["ignored", "已忽略"],
] as const;

export default async function SavedJobsPage() {
  const user = await getOrCreateDemoUser();
  const profiles = await getCareerProfiles(user.id);
  const profileId = profiles[0]?.id ?? "";
  const saved = profileId ? await listSavedJobsByProfileId(profileId) : [];

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <h1 className="text-2xl font-semibold">收藏岗位</h1>
      {saved.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">暂无收藏岗位。</CardContent></Card>
      ) : null}
      {saved.map((item) => (
        <Card key={item.id}>
          <CardHeader><CardTitle>{item.jobPost.title}</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span>{item.jobPost.company} · {item.jobPost.city}</span>
              <StatusBadge value={item.status} />
            </div>
            <form action={updateSavedJobStatusAction} className="flex gap-2">
              <input type="hidden" name="savedJobId" value={item.id} />
              <select name="status" defaultValue={item.status} className="h-9 rounded-md border px-2">
                {savedStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <Button type="submit" variant="outline">更新</Button>
            </form>
            <form action={createApplicationFromSavedJobAction}>
              <input type="hidden" name="profileId" value={profileId} />
              <input type="hidden" name="savedJobId" value={item.id} />
              <Button type="submit">加入投递流程</Button>
            </form>
            <Button asChild variant="outline"><Link href={`/jobs/${item.jobPostId}`}>详情</Link></Button>
          </CardContent>
        </Card>
      ))}
    </main>
  );
}
