import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listCareerStrategyPlans } from "@/services/strategy-service";

export default async function StrategyPage() {
  const plans = await listCareerStrategyPlans();
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">职业方向与求职策略</h1>
          <p className="mt-2 text-sm text-muted-foreground">基于职业档案、简历和历史 JD 匹配记录生成策略计划。</p>
        </div>
        <Button asChild>
          <Link href="/strategy/new">生成策略</Link>
        </Button>
      </div>
      {plans.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">暂无策略计划，请先生成。</CardContent></Card>
      ) : (
        <section className="grid gap-4">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle>{plan.title}</CardTitle>
                  <p className="mt-2 text-sm text-muted-foreground">{plan.profile.basicInfo?.realName ?? plan.profileId} · {plan.recommendedPrimaryDirection}</p>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold">{plan.overallReadinessScore} / 100</div>
                  <div className="text-muted-foreground">准备度</div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>创建时间：{plan.createdAt.toLocaleString("zh-CN")}</div>
                <div>城市：{plan.recommendedCities.join(" / ")}</div>
                <Button asChild variant="outline"><Link href={`/strategy/${plan.id}`}>查看详情</Link></Button>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </main>
  );
}
