import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCareerStrategyPlanById } from "@/services/strategy-service";
import { updateActionStatusAction } from "../actions";

type Props = { params: Promise<{ id: string }> };

const actionStatuses = [
  ["todo", "待办"],
  ["in_progress", "进行中"],
  ["done", "已完成"],
  ["skipped", "已跳过"],
] as const;

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="font-medium">{title}</div>
      <div className="mt-1 space-y-1 text-muted-foreground">
        {items.length ? items.map((item) => <div key={item}>- {item}</div>) : <div>暂无</div>}
      </div>
    </div>
  );
}

export default async function StrategyDetailPage({ params }: Props) {
  const { id } = await params;
  const plan = await getCareerStrategyPlanById(id);
  if (!plan) notFound();
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{plan.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{plan.summary}</p>
        </div>
        <Button asChild variant="outline"><Link href="/strategy">返回</Link></Button>
      </div>
      <section className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-5 text-sm">整体准备度：{plan.overallReadinessScore} / 100</CardContent></Card>
        <Card><CardContent className="p-5 text-sm">首推方向：{plan.recommendedPrimaryDirection}</CardContent></Card>
        <Card><CardContent className="p-5 text-sm">城市：{plan.recommendedCities.join(" / ")}</CardContent></Card>
      </section>
      <Card>
        <CardHeader><CardTitle>策略说明</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">{plan.strategyNotes.map((item) => <div key={item}>- {item}</div>)}</CardContent>
      </Card>
      <section className="grid gap-4">
        {plan.recommendations.map((item) => (
          <Card key={item.id}>
            <CardHeader className="flex flex-row items-start justify-between">
              <CardTitle>{item.directionName}</CardTitle>
              <div className="text-right text-sm">{item.matchScore} / 100<br /><span className="text-muted-foreground">可信度 {item.confidence}</span></div>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm md:grid-cols-2">
              <List title="适合岗位" items={item.suitableRoles} />
              <List title="匹配证据" items={item.matchedEvidence} />
              <List title="差距" items={item.gaps} />
              <List title="风险" items={item.risks} />
              <List title="简历重点" items={item.resumeFocus} />
              <List title="搜索关键词" items={item.searchKeywords} />
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>技能差距</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {plan.skillGaps.map((gap) => (
              <div key={gap.id} className="border-b pb-2">
                <div className="font-medium">{gap.skillName} · {gap.category} · 重要度 {gap.importance}</div>
                <List title="行动" items={gap.suggestedActions} />
                <List title="证据" items={gap.evidenceNeeded} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>搜索策略</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {plan.jobSearchStrategies.map((strategy) => (
              <div key={strategy.id} className="border-b pb-2">
                <div className="font-medium">{strategy.targetRole} · 每周 {strategy.weeklyApplicationTarget} 个</div>
                <List title="关键词" items={strategy.searchKeywords} />
                <List title="投递建议" items={strategy.applicationAdvice} />
                <List title="面试准备" items={strategy.interviewPrepAdvice} />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
      <Card>
        <CardHeader><CardTitle>行动计划</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {plan.actionPlan.map((item) => (
            <div key={item.id} className="grid gap-3 border-b pb-3 md:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2 font-medium">
                  <span>{item.title}</span>
                  <StatusBadge value={item.priority} />
                  <StatusBadge value={item.status} />
                </div>
                <p className="text-muted-foreground">{item.description}</p>
                <div className="text-muted-foreground">{item.estimatedHours} 小时 · {item.dueInDays} 天内</div>
              </div>
              <form action={updateActionStatusAction} className="flex gap-2">
                <input type="hidden" name="itemId" value={item.id} />
                <select name="status" defaultValue={item.status} className="h-9 rounded-md border px-2">
                  {actionStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <Button type="submit" variant="outline">更新</Button>
              </form>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
