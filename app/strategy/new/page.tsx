import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCareerProfiles, getOrCreateDemoUser } from "@/services/career-profile-service";
import { generateCareerStrategyFromFormAction } from "../actions";

export default async function NewStrategyPage() {
  const user = await getOrCreateDemoUser();
  const profiles = await getCareerProfiles(user.id);
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">生成职业方向与求职策略</h1>
          <p className="mt-2 text-sm text-muted-foreground">选择一个职业档案生成新的策略版本。</p>
        </div>
        <Button asChild variant="outline"><Link href="/strategy">返回</Link></Button>
      </div>
      <Card>
        <CardHeader><CardTitle>选择职业档案</CardTitle></CardHeader>
        <CardContent>
          <form action={generateCareerStrategyFromFormAction} className="space-y-4">
            <select name="profileId" className="h-10 w-full rounded-md border px-3 text-sm" required>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.basicInfo?.realName ?? "未命名档案"} · {profile.targetRoles.join(" / ")}</option>
              ))}
            </select>
            <Button type="submit">生成职业方向与求职策略</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
