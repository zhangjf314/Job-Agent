import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listJobPosts } from "@/services/jobs/job-service";

export default async function JobsPage() {
  const jobs = await listJobPosts();
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">岗位库</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            管理模拟岗位、搜索结果、公开岗位描述和手动导入岗位，并完成人岗匹配与风险识别。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild><Link href="/jobs/search">搜索岗位</Link></Button>
          <Button asChild variant="outline"><Link href="/jobs/import">导入岗位描述或链接</Link></Button>
          <Button asChild variant="outline"><Link href="/jobs/manual">手动粘贴</Link></Button>
          <Button asChild variant="outline"><Link href="/jobs/saved">收藏岗位</Link></Button>
        </div>
      </div>
      <section className="grid gap-4">
        {jobs.slice(0, 10).map((job) => (
          <Card key={job.id}>
            <CardHeader><CardTitle>{job.title}</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap justify-between gap-3 text-sm">
              <div>{job.company} - {job.city} - {job.salaryText ?? "薪资面议"}</div>
              <div>质量分 {job.qualityScore} - 风险项 {job.riskFlags.length}</div>
              <Button asChild variant="outline"><Link href={`/jobs/${job.id}`}>查看详情</Link></Button>
            </CardContent>
          </Card>
        ))}
        {jobs.length === 0 ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">暂无岗位。请先搜索岗位，或导入岗位描述/链接。</CardContent></Card>
        ) : null}
      </section>
    </main>
  );
}
