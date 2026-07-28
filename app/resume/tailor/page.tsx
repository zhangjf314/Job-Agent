import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getCareerProfiles, getOrCreateDemoUser } from "@/services/career-profile-service";
import { listResumes } from "@/services/resume-service";
import { tailorResumeAction } from "@/app/jd/actions";

export default async function TailorResumePage() {
  const user = await getOrCreateDemoUser();
  const profiles = await getCareerProfiles(user.id);
  const resumes = await listResumes();

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">岗位分析与定制简历</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            粘贴目标岗位描述，基于职业档案和基础简历生成定制版。
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/resume">返回简历中心</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>生成定制简历</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={tailorResumeAction} className="grid gap-4">
            <select name="profileId" className="h-10 rounded-md border px-3 text-sm" required>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.basicInfo?.realName ?? "未命名档案"} · {profile.targetRoles.join(" / ")}
                </option>
              ))}
            </select>
            <select name="baseResumeId" className="h-10 rounded-md border px-3 text-sm" required>
              {resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.title} · {resume.targetRole ?? "通用"}
                </option>
              ))}
            </select>
            <div className="grid gap-4 md:grid-cols-3">
              <Input name="title" placeholder="岗位名称，例如 Java 后端开发实习生" required />
              <Input name="company" placeholder="公司，可选" />
              <Input name="city" placeholder="城市，可选" />
            </div>
            <Input name="sourceUrl" placeholder="岗位来源链接，可选" />
            <Textarea name="rawText" className="min-h-[260px]" placeholder="粘贴岗位描述原文" required />
            <Button type="submit">分析岗位并生成定制简历</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
