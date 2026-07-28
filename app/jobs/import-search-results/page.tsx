import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getCareerProfiles, getOrCreateDemoUser } from "@/services/career-profile-service";
import { importSearchResultsJsonAction } from "../actions";

export default async function ImportSearchResultsPage() {
  const user = await getOrCreateDemoUser();
  const profiles = await getCareerProfiles(user.id);
  return <main className="mx-auto max-w-4xl space-y-6 px-6 py-8"><h1 className="text-2xl font-semibold">导入搜索结果 JSON</h1><Card><CardHeader><CardTitle>搜索 API 结果</CardTitle></CardHeader><CardContent><form action={importSearchResultsJsonAction} className="grid gap-4"><select name="profileId" className="h-10 rounded-md border px-3">{profiles.map((p) => <option key={p.id} value={p.id}>{p.basicInfo?.realName ?? "未命名"}</option>)}</select><Textarea name="jsonText" className="min-h-[300px] font-mono" placeholder='[{"title":"杭州 Java 后端","url":"https://example.com/job","snippet":"本科 Java Spring Boot MySQL"}]' required /><Button type="submit">导入并匹配</Button></form></CardContent></Card></main>;
}
