import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResumeTemplateSelector } from "@/components/resume-template-selector";
import { getCareerProfiles, getOrCreateDemoUser } from "@/services/career-profile-service";
import { generateGeneralResumeFromFormAction } from "../actions";

export default async function NewResumePage() {
  const user = await getOrCreateDemoUser();
  const profiles = await getCareerProfiles(user.id);

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">生成通用简历</h1>
          <p className="mt-2 text-sm text-muted-foreground">选择一个职业档案，系统会基于事实源生成中文简历。</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/resume">返回</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>选择职业档案</CardTitle>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>暂无职业档案，请先创建职业档案。</p>
              <Button asChild>
                <Link href="/profile/new">创建职业档案</Link>
              </Button>
            </div>
          ) : (
            <form action={generateGeneralResumeFromFormAction} className="space-y-4">
              <select name="profileId" className="h-10 w-full rounded-md border px-3 text-sm" required>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.basicInfo?.realName ?? "未命名档案"} · {profile.targetRoles.join(" / ")}
                  </option>
                ))}
              </select>
              <ResumeTemplateSelector />
              <Button type="submit">生成通用简历</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
