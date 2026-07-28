import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCareerProfiles, getOrCreateDemoUser } from "@/services/career-profile-service";
import { importJobFileAction, importJobPostAction } from "../actions";

export default async function ImportJobPage() {
  const user = await getOrCreateDemoUser();
  const profiles = await getCareerProfiles(user.id);

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <h1 className="text-2xl font-semibold">导入岗位</h1>
      <Card>
        <CardHeader>
          <CardTitle>粘贴岗位描述或公开链接</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={importJobPostAction} className="grid gap-4">
            <select name="profileId" className="h-10 rounded-md border px-3">
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.basicInfo?.realName ?? "未命名"} - {profile.targetRoles.join("/")}
                </option>
              ))}
            </select>
            <select name="source" className="h-10 rounded-md border px-3">
              <option value="manual_jd">手动粘贴岗位描述</option>
              <option value="manual_url">公开岗位链接</option>
              <option value="company_career_page">企业招聘页链接或正文</option>
            </select>
            <Input name="query" defaultValue="Java 后端开发" placeholder="岗位名称" />
            <Input name="city" placeholder="城市" />
            <Input name="url" placeholder="公开链接，粘贴纯文本时可不填" />
            <textarea
              name="rawText"
              className="min-h-56 rounded-md border px-3 py-2 text-sm"
              placeholder="粘贴岗位描述正文，或企业招聘页正文"
            />
            <Button type="submit">导入、结构化并匹配</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>批量导入 CSV / Excel</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={importJobFileAction} className="grid gap-4" encType="multipart/form-data">
            <select name="profileId" className="h-10 rounded-md border px-3" required>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.basicInfo?.realName ?? "未命名"} - {profile.targetRoles.join("/")}
                </option>
              ))}
            </select>
            <Input name="file" type="file" accept=".csv,.xlsx" required />
            <p className="text-sm text-muted-foreground">
              支持列：岗位名称、公司、城市、薪资、岗位职责、任职要求、来源链接；最多导入 200 条。
            </p>
            <Button type="submit">导入并生成人岗匹配</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
