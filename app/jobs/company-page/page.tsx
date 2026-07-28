import { appConfig } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCareerProfiles, getOrCreateDemoUser } from "@/services/career-profile-service";
import { fetchCompanyCareerPageAction } from "../actions";

export default async function CompanyPageImportPage() {
  const user = await getOrCreateDemoUser();
  const profiles = await getCareerProfiles(user.id);
  return <main className="mx-auto max-w-4xl space-y-6 px-6 py-8"><h1 className="text-2xl font-semibold">解析企业公开招聘页</h1><Card><CardHeader><CardTitle>公开 URL</CardTitle></CardHeader><CardContent>{!appConfig.enableCompanyPageFetch ? <p className="text-sm text-muted-foreground">当前 ENABLE_COMPANY_PAGE_FETCH=false，需要开启后才能 fetch 公开页面。</p> : null}<form action={fetchCompanyCareerPageAction} className="mt-4 grid gap-4"><select name="profileId" className="h-10 rounded-md border px-3"><option value="">不匹配 Profile</option>{profiles.map((p) => <option key={p.id} value={p.id}>{p.basicInfo?.realName ?? "未命名"}</option>)}</select><Input name="url" placeholder="https://company.example/careers" required /><Button type="submit" disabled={!appConfig.enableCompanyPageFetch}>Fetch 并解析岗位</Button></form></CardContent></Card></main>;
}
