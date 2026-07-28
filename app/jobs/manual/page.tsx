import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getCareerProfiles, getOrCreateDemoUser } from "@/services/career-profile-service";
import { createManualJobPostAction } from "../actions";

export default async function ManualJobPage() {
  const user = await getOrCreateDemoUser();
  const profiles = await getCareerProfiles(user.id);
  return <main className="mx-auto max-w-4xl space-y-6 px-6 py-8"><h1 className="text-2xl font-semibold">手动粘贴岗位</h1><Card><CardHeader><CardTitle>岗位文本</CardTitle></CardHeader><CardContent><form action={createManualJobPostAction} className="grid gap-4"><select name="profileId" className="h-10 rounded-md border px-3">{profiles.map((p) => <option key={p.id} value={p.id}>{p.basicInfo?.realName ?? "未命名"}</option>)}</select><Input name="sourceUrl" placeholder="来源 URL，可选" /><Textarea name="rawText" className="min-h-[280px]" placeholder="粘贴岗位 JD 文本" required /><Button type="submit">结构化并匹配</Button></form></CardContent></Card></main>;
}
