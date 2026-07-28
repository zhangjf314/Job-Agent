import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listResumes } from "@/services/resume-service";

export default async function ResumePage() {
  const resumes = await listResumes();

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">简历中心</h1>
          <p className="mt-2 text-sm text-muted-foreground">从职业档案派生、保存和管理多版本中文简历。</p>
        </div>
        <Button asChild>
          <Link href="/resume/new">
            <Plus className="size-4" />
            生成通用简历
          </Link>
        </Button>
      </div>

      {resumes.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            暂无简历，请先选择某个职业档案生成通用简历。
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4">
          {resumes.map((resume) => (
            <Card key={resume.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="size-5" />
                    {resume.title}
                  </CardTitle>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {resume.targetRole ?? "通用简历"} · {resume.targetCity ?? "不限城市"}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold">{resume.qualityScore ?? 0} / 100</div>
                  <div className="text-muted-foreground">质量分</div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm md:grid-cols-5">
                <div>状态：<StatusBadge value={resume.status} /></div>
                <div>默认：{resume.isDefault ? "是" : "否"}</div>
                <div>更新时间：{resume.updatedAt.toLocaleString("zh-CN")}</div>
                <div>档案：{resume.profile.basicInfo?.realName ?? resume.profileId}</div>
                <Button asChild variant="outline">
                  <Link href={`/resume/${resume.id}`}>查看和编辑</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </main>
  );
}
