import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCareerProfiles, getOrCreateDemoUser } from "@/services/career-profile-service";
import { getEvaluationSummary, listEvaluationRecords } from "@/services/evaluation-service";
import { createEvaluationAction } from "./actions";

const typeLabels = {
  jd_parsing: "岗位描述解析准确性",
  match_scoring: "岗位匹配评分合理性",
  resume_suggestion: "简历建议质量",
} as const;

export default async function EvaluationPage() {
  const user = await getOrCreateDemoUser();
  const profiles = await getCareerProfiles(user.id);
  const records = (await Promise.all(profiles.map((item) => listEvaluationRecords(item.id)))).flat();
  const summaries = await Promise.all(profiles.map((item) => getEvaluationSummary(item.id)));
  const llm = summaries.reduce((result, item) => ({
    calls: result.calls + item.llm.calls,
    successfulCalls: result.successfulCalls + item.llm.successfulCalls,
    totalLatency: result.totalLatency + item.llm.averageLatencyMs * item.llm.calls,
    totalTokens: result.totalTokens + item.llm.totalTokens,
    estimatedCostMicros: result.estimatedCostMicros + item.llm.estimatedCostMicros,
  }), { calls: 0, successfulCalls: 0, totalLatency: 0, totalTokens: 0, estimatedCostMicros: 0 });

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">质量评估</h1>
        <p className="mt-2 text-sm text-muted-foreground">通过人工标注持续校准岗位解析、匹配评分和简历建议。</p>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">人工评估</div><div className="mt-2 text-2xl font-semibold">{records.length}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">大模型调用</div><div className="mt-2 text-2xl font-semibold">{llm.calls}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">平均耗时</div><div className="mt-2 text-2xl font-semibold">{llm.calls ? Math.round(llm.totalLatency / llm.calls) : 0} 毫秒</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">累计 Token</div><div className="mt-2 text-2xl font-semibold">{llm.totalTokens}</div></CardContent></Card>
      </section>

      <Card>
        <CardHeader><CardTitle>新增人工评估</CardTitle></CardHeader>
        <CardContent>
          <form action={createEvaluationAction} className="grid gap-4 md:grid-cols-2">
            <select name="profileId" className="h-10 rounded-md border px-3" required>
              {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.basicInfo?.realName ?? "未命名档案"}</option>)}
            </select>
            <select name="type" className="h-10 rounded-md border px-3" required>
              {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <Input name="entityId" placeholder="被评估记录编号，例如岗位分析编号" required />
            <select name="humanScore" className="h-10 rounded-md border px-3" required defaultValue="4">
              {[5, 4, 3, 2, 1].map((score) => <option key={score} value={score}>{score} 分</option>)}
            </select>
            <textarea name="reviewerNotes" className="min-h-28 rounded-md border px-3 py-2 md:col-span-2" placeholder="记录准确项、错误项和改进意见" />
            <Button type="submit" className="md:col-span-2">保存评估</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>最近评估</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {records.length === 0 ? <p className="text-sm text-muted-foreground">暂无人工评估记录。</p> : records.slice(0, 20).map((record) => (
            <div key={record.id} className="grid gap-2 rounded-md border p-4 text-sm md:grid-cols-[1fr_auto]">
              <div>
                <div className="font-medium">{typeLabels[record.type]} · {record.profile.basicInfo?.realName ?? "未命名档案"}</div>
                <div className="mt-1 text-muted-foreground">记录编号：{record.entityId}</div>
                {record.reviewerNotes ? <div className="mt-2">{record.reviewerNotes}</div> : null}
              </div>
              <div className="text-lg font-semibold">{record.humanScore ?? "-"} / 5</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
