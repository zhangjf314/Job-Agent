import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorPanel } from "@/components/error-panel";
import { getCurrentUser } from "@/services/auth/current-user";
import { getUserDataStats } from "@/services/user-data-service";
import { toFriendlyError } from "@/lib/errors";
import { deleteCurrentUserDataAction } from "../actions";

const statLabels: Record<string, string> = {
  profiles: "职业档案",
  resumes: "简历",
  jobPosts: "岗位",
  savedJobs: "收藏岗位",
  applications: "投递记录",
  interviewFeedback: "面试反馈",
};

export default async function DataSettingsPage() {
  try {
    const user = await getCurrentUser();
    const stats = await getUserDataStats(user.id);
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <h1 className="text-2xl font-semibold">数据管理</h1>
        <Card>
          <CardHeader><CardTitle>当前用户</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>{user.name} · {user.email}</div>
            <div className="grid gap-3 md:grid-cols-5">
              {Object.entries(stats).map(([key, value]) => (
                <div key={key} className="rounded-md border p-3">
                  <div className="text-muted-foreground">{statLabels[key] ?? key}</div>
                  <div className="text-2xl font-semibold">{value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="flex gap-2">
          <Button asChild><Link href="/settings/data/export">导出 JSON</Link></Button>
          <form action={deleteCurrentUserDataAction}><Button type="submit" variant="destructive">删除当前演示用户数据</Button></form>
        </div>
      </main>
    );
  } catch (error) {
    const friendly = toFriendlyError(error);
    return <main className="mx-auto max-w-3xl px-6 py-8"><ErrorPanel title="数据管理暂不可用" message={friendly.message} /></main>;
  }
}
