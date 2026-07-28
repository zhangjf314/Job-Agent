import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ModuleCard } from "@/components/module-card";
import { StatusBadge } from "@/components/status-badge";
import { ErrorPanel } from "@/components/error-panel";
import { getCurrentUser } from "@/services/auth/current-user";
import { getDashboardSummary } from "@/services/dashboard-service";
import { toFriendlyError } from "@/lib/errors";

export default async function DashboardPage() {
  try {
    const user = await getCurrentUser();
    const summary = await getDashboardSummary(user.id);
    return (
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">总览</h1>
            <p className="mt-2 text-sm text-muted-foreground">从职业档案、简历、岗位到投递反馈的求职闭环概览。</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link href="/resume/new">生成简历</Link></Button>
            <Button asChild><Link href="/applications/new">新建投递</Link></Button>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <ModuleCard title="职业档案" href="/profile" description="个人事实源" metric={summary.profileCount} />
          <ModuleCard title="简历中心" href="/resume" description="多版本简历" metric={summary.resumeCount} />
          <ModuleCard title="岗位描述" href="/jd" description="岗位要求分析" metric={summary.jdAnalysisCount} />
          <ModuleCard title="求职策略" href="/strategy" description="方向与行动计划" metric={summary.strategyPlanCount} />
          <ModuleCard title="岗位匹配" href="/jobs/matches" description="人岗匹配结果" metric={summary.jobMatchCount} />
          <ModuleCard title="投递记录" href="/applications" description="投递与面试进展" metric={summary.applicationCount} />
        </section>

        <Card>
          <CardHeader><CardTitle>求职漏斗</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-5">
            {Object.entries(summary.funnel).map(([status, count]) => (
              <div key={status} className="rounded-md border p-3">
                <StatusBadge value={status} />
                <div className="mt-3 text-2xl font-semibold">{count}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>最近行动</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[...summary.applicationTasks, ...summary.strategyActions].length === 0 ? (
                <EmptyState title="暂无待办" description="创建投递、记录面试反馈或生成求职策略后，这里会显示下一步行动。" />
              ) : null}
              {summary.applicationTasks.map((task) => (
                <div key={task.id} className="rounded-md border p-3">
                  {task.title}<div className="mt-2"><StatusBadge value={task.status} /></div>
                </div>
              ))}
              {summary.strategyActions.map((item) => (
                <div key={item.id} className="rounded-md border p-3">
                  {item.title}<div className="mt-2"><StatusBadge value={item.status} /></div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>推荐下一步</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {summary.nextSteps.length === 0 ? (
                <EmptyState title="主流程已打通" description="可以继续复盘投递结果、补充面试反馈或更新简历版本。" />
              ) : null}
              {summary.nextSteps.map((step) => (
                <Button key={step.href} asChild variant="outline" className="w-full justify-start">
                  <Link href={step.href}>{step.label}</Link>
                </Button>
              ))}
              <div className="grid gap-2 pt-2 md:grid-cols-2">
                <Button asChild variant="outline"><Link href="/resume/tailor">岗位定制简历</Link></Button>
                <Button asChild variant="outline"><Link href="/strategy/new">生成求职策略</Link></Button>
                <Button asChild variant="outline"><Link href="/jobs/search">搜索岗位</Link></Button>
                <Button asChild variant="outline"><Link href="/applications/new">新建投递</Link></Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  } catch (error) {
    const friendly = toFriendlyError(error);
    return <main className="mx-auto max-w-3xl px-6 py-8"><ErrorPanel title="总览暂不可用" message={friendly.message} /></main>;
  }
}
