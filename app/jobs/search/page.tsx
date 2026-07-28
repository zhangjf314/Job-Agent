import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCareerProfiles, getOrCreateDemoUser } from "@/services/career-profile-service";
import { appConfig } from "@/lib/config";
import { searchJobsAction } from "../actions";

export default async function JobSearchPage() {
  const user = await getOrCreateDemoUser();
  const profiles = await getCareerProfiles(user.id);
  const searchMode = appConfig.enableRealWebSearch && appConfig.searchApiKey
    ? "真实搜索已开启。"
    : "未配置搜索密钥或未开启真实搜索，将使用本地示例结果。";

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <h1 className="text-2xl font-semibold">搜索岗位</h1>
      <Card>
        <CardHeader>
          <CardTitle>搜索条件</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={searchJobsAction} className="grid gap-4">
            <select name="profileId" className="h-10 rounded-md border px-3">
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.basicInfo?.realName ?? "未命名"} - {profile.targetRoles.join("/")}
                </option>
              ))}
            </select>
            <select name="source" className="h-10 rounded-md border px-3">
              <option value="mock">模拟岗位源</option>
              <option value="web_search">通用网络搜索</option>
              <option value="manual_jd">手动粘贴岗位描述</option>
              <option value="manual_url">手动输入公开链接</option>
              <option value="company_career_page">企业公开招聘页</option>
            </select>
            <p className="text-sm text-muted-foreground">{searchMode}</p>
            <Input name="query" defaultValue="Java 后端开发" placeholder="目标岗位，例如 Java 后端开发" />
            <Input name="city" placeholder="城市，例如杭州" />
            <Input name="education" placeholder="学历要求，例如本科" />
            <Input name="experience" placeholder="经验要求，例如应届生、实习、1-3 年" />
            <Input name="keywords" placeholder="关键词，例如 Spring Boot、MySQL、AI 应用" />
            <Input name="limit" type="number" min="1" max="100" defaultValue="20" placeholder="结果数量" />
            <Input name="url" placeholder="可选：公开岗位链接或企业招聘页链接" />
            <textarea
              name="rawText"
              className="min-h-36 rounded-md border px-3 py-2 text-sm"
              placeholder="可选：粘贴岗位描述或企业招聘页正文"
            />
            <Button type="submit">搜索并生成人岗匹配</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
