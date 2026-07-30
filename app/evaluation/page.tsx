import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCareerProfiles } from "@/services/career-profile-service";
import { getCurrentUser } from "@/services/auth/current-user";
import {
  getEvaluationSummary,
  listEvaluationRecords,
  type SafeLLMCallMetadata,
} from "@/services/evaluation-service";
import { createEvaluationAction } from "./actions";

const typeLabels = {
  jd_parsing: "岗位描述解析准确性",
  match_scoring: "岗位匹配评分合理性",
  resume_suggestion: "简历建议质量",
} as const;

const pipelineFields: Array<[keyof SafeLLMCallMetadata, string]> = [
  ["planJsonStatus", "Plan JSON"],
  ["planSchemaStatus", "Plan Schema"],
  ["planValidationStatus", "Plan Validation"],
  ["compilerStatus", "Compiler"],
  ["schemaStatus", "Grounded Schema"],
  ["factualityStatus", "Factuality"],
];

function statusLabel(value: unknown) {
  if (value === "passed" || value === "pass") return "Passed";
  if (value === "failed" || value === "fail") return "Failed";
  return "Not reached";
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number | string | undefined;
}) {
  if (value === undefined) return null;
  return (
    <div className="rounded-md bg-muted px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

export default async function EvaluationPage() {
  const user = await getCurrentUser();
  const profiles = await getCareerProfiles(user.id);
  const currentProfile = profiles[0];
  const [records, summary] = await Promise.all([
    currentProfile
      ? listEvaluationRecords(currentProfile.id)
      : Promise.resolve([]),
    getEvaluationSummary(currentProfile?.id),
  ]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">质量评估与 Provider Observability</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          展示人工评估和经过安全白名单过滤的模型调用指标，不保存 Prompt、原始响应或推理正文。
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">人工评估</div><div className="mt-2 text-2xl font-semibold">{records.length}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">大模型调用</div><div className="mt-2 text-2xl font-semibold">{summary.llm.calls}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">平均耗时</div><div className="mt-2 text-2xl font-semibold">{summary.llm.averageLatencyMs} 毫秒</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">累计 Token</div><div className="mt-2 text-2xl font-semibold">{summary.llm.totalTokens}</div></CardContent></Card>
      </section>

      <Card data-portfolio-evaluation-calls>
        <CardHeader>
          <CardTitle>安全调用记录</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {summary.recentCalls.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无大模型调用记录。</p>
          ) : null}
          {summary.recentCalls.map((call) => {
            const metadata = call.safeMetadata;
            return (
              <article key={call.id} className="space-y-4 rounded-md border p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{call.operation}</span>
                      {metadata.demo ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                          Demo
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      {call.provider} · {call.model} · {call.createdAt.toLocaleString("zh-CN")}
                    </div>
                  </div>
                  <div className="rounded-full border px-3 py-1 font-medium">
                    {call.status}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  <Metric label="Latency" value={`${call.durationMs} ms`} />
                  <Metric label="Prompt Tokens" value={call.promptTokens ?? 0} />
                  <Metric label="Completion Tokens" value={call.completionTokens ?? 0} />
                  <Metric label="Total Tokens" value={call.totalTokens ?? 0} />
                  <Metric label="Fallback" value={call.fallbackUsed ? "Yes" : "No"} />
                </div>

                {call.operation === "tailored_resume_result" ? (
                  <>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                      {pipelineFields.map(([field, label]) => (
                        <Metric
                          key={field}
                          label={label}
                          value={statusLabel(metadata[field])}
                        />
                      ))}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <Metric label="Selected facts" value={metadata.selectedFactCount} />
                      <Metric label="Rendered facts" value={metadata.renderedFactCount} />
                      <Metric label="Omitted facts" value={metadata.omittedFactCount} />
                      <Metric label="Section line counts" value={metadata.sectionLineCounts?.join(" / ")} />
                      <Metric label="Maximum line length" value={metadata.maximumLineLength} />
                      <Metric label="Maximum sourceFactIds" value={metadata.maximumSourceFactIds} />
                      <Metric label="Factuality violations" value={metadata.factualityViolationCount} />
                    </div>
                  </>
                ) : null}
                {metadata.demo ? (
                  <p className="text-xs text-muted-foreground">
                    Seeded demonstration metrics; not a live request or benchmark.
                  </p>
                ) : null}
              </article>
            );
          })}
        </CardContent>
      </Card>

      {currentProfile ? (
        <Card>
          <CardHeader><CardTitle>新增人工评估</CardTitle></CardHeader>
          <CardContent>
            <form action={createEvaluationAction} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="profileId" value={currentProfile.id} />
              <div className="rounded-md border px-3 py-2 text-sm">
                当前档案：{currentProfile.basicInfo?.realName ?? "未命名档案"}
              </div>
              <select name="type" className="h-10 rounded-md border px-3" required>
                {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <Input name="entityId" placeholder="被评估记录编号" required />
              <select name="humanScore" className="h-10 rounded-md border px-3" required defaultValue="4">
                {[5, 4, 3, 2, 1].map((score) => <option key={score} value={score}>{score} 分</option>)}
              </select>
              <textarea name="reviewerNotes" className="min-h-28 rounded-md border px-3 py-2 md:col-span-2" placeholder="记录准确项、错误项和改进意见" />
              <Button type="submit" className="md:col-span-2">保存评估</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>最近人工评估</CardTitle></CardHeader>
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
