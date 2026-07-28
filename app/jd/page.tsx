import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listJDAnalyses } from "@/services/jd-service";

export default async function JDPage() {
  const analyses = await listJDAnalyses();

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">岗位描述分析记录</h1>
          <p className="mt-2 text-sm text-muted-foreground">查看岗位要求、匹配分、差距和定制简历关联。</p>
        </div>
        <Button asChild>
          <Link href="/resume/tailor">新建岗位定制</Link>
        </Button>
      </div>

      {analyses.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">暂无岗位描述分析记录。</CardContent>
        </Card>
      ) : (
        <section className="grid gap-4">
          {analyses.map((analysis) => (
            <Card key={analysis.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle>{analysis.targetRole || analysis.jobDescription.title}</CardTitle>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {analysis.jobDescription.company ?? "未知公司"} · {analysis.jobDescription.city ?? "城市不限"}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold">{analysis.matchScore} / 100</div>
                  <div className="text-muted-foreground">匹配分</div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>创建时间：{analysis.createdAt.toLocaleString("zh-CN")}</div>
                <div>关联简历：{analysis.tailoredResumes[0]?.tailoredResume.title ?? "未生成"}</div>
                <Button asChild variant="outline">
                  <Link href={`/jd/${analysis.id}`}>查看详情</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </main>
  );
}
