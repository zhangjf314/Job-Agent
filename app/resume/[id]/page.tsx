import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy, Download, FileText, Save, Star } from "lucide-react";
import { ErrorPanel } from "@/components/error-panel";
import { ResumeDocument } from "@/components/resume-document";
import { ResumeTemplateSelector } from "@/components/resume-template-selector";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { listApplicationsByResumeId } from "@/services/applications/application-service";
import { getTailoredResumeByResumeId } from "@/services/jd-service";
import { getResumeById } from "@/services/resume-service";
import { getApplicationMaterials } from "@/services/resume-application-materials";
import { renderResumeMarkdown, type RenderedResumeMarkdown } from "@/services/resume-templates/renderer";
import {
  archiveResumeAction,
  deleteResumeAction,
  duplicateResumeAction,
  saveResumeContentAction,
  saveResumeTemplateAction,
  setDefaultResumeAction,
} from "../actions";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ResumeDetailPage({ params }: Props) {
  const { id } = await params;
  const resume = await getResumeById(id);
  if (!resume) notFound();
  const tailored = await getTailoredResumeByResumeId(id);
  const applications = await listApplicationsByResumeId(id);
  const applicationMaterials = getApplicationMaterials(resume.contentJson);
  let rendered: RenderedResumeMarkdown | null = null;
  let renderError = "";
  try {
    rendered = renderResumeMarkdown(resume);
  } catch (error) {
    renderError = error instanceof Error ? error.message : "未知模板渲染错误";
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{resume.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {resume.targetRole ?? "通用简历"} · {resume.targetCity ?? "不限城市"} · 质量分 {resume.qualityScore ?? 0} / 100
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/resume">返回</Link></Button>
          <Button asChild variant="outline"><Link href={`/resume/${resume.id}/download`}><Download className="size-4" />下载原文</Link></Button>
          <Button asChild variant="outline"><Link href={`/resume/${resume.id}/pdf`}><FileText className="size-4" />导出 PDF</Link></Button>
          <form action={duplicateResumeAction.bind(null, resume.id)}><Button type="submit" variant="outline"><Copy className="size-4" />复制版本</Button></form>
          <form action={setDefaultResumeAction.bind(null, resume.id)}><Button type="submit" variant="outline"><Star className="size-4" />设为默认</Button></form>
          <form action={archiveResumeAction.bind(null, resume.id)}><Button type="submit" variant="outline">归档</Button></form>
          <form action={deleteResumeAction.bind(null, resume.id)}><Button type="submit" variant="destructive">删除</Button></form>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-4">
          {tailored ? (
            <Card>
              <CardHeader><CardTitle>岗位定制信息</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>匹配分：{tailored.jdAnalysis.matchScore} / 100</div>
                <div>岗位：{tailored.jdAnalysis.targetRole}</div>
                <Button asChild variant="outline" className="w-full"><Link href={`/jd/${tailored.jdAnalysisId}`}>查看岗位分析</Link></Button>
                <div className="pt-2 font-medium">改写说明</div>
                {tailored.rewriteExplanation.map((item) => <div key={item}>- {item}</div>)}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader><CardTitle>简历信息</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>状态：<StatusBadge value={resume.status} /></div>
              <div>类型：{resume.type === "jd_tailored" ? "岗位定制" : "通用简历"}</div>
              <div>默认：{resume.isDefault ? "是" : "否"}</div>
              <div>模板：{rendered?.template.name ?? "渲染失败"}</div>
              <div>更新时间：{resume.updatedAt.toLocaleString("zh-CN")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>简历模板</CardTitle></CardHeader>
            <CardContent>
              <form action={saveResumeTemplateAction.bind(null, resume.id)} className="space-y-4">
                <ResumeTemplateSelector defaultValue={resume.templateKey} />
                <Button type="submit" className="w-full">保存模板并刷新预览</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>关联投递</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {applications.length === 0 ? <p className="text-muted-foreground">暂无投递记录使用该简历。</p> : null}
              {applications.map((application) => (
                <Button key={application.id} asChild variant="outline" className="w-full justify-start">
                  <Link href={`/applications/${application.id}`}>{application.company} · {application.jobTitle}</Link>
                </Button>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>缺失字段</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {resume.missingFields.length === 0 ? <p className="text-muted-foreground">暂无明显缺失项。</p> : resume.missingFields.map((item) => <div key={item}>- {item}</div>)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>改进问题</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {resume.improvementQuestions.length === 0 ? <p className="text-muted-foreground">暂无补充问题。</p> : resume.improvementQuestions.map((item) => <div key={item}>- {item}</div>)}
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-6">
          {applicationMaterials ? (
            <Card>
              <CardHeader><CardTitle>岗位投递材料</CardTitle></CardHeader>
              <CardContent className="grid gap-5 text-sm">
                <div><div className="mb-2 font-medium">自我介绍</div><pre className="whitespace-pre-wrap rounded-md bg-muted p-4">{applicationMaterials.selfIntroduction}</pre></div>
                <div><div className="mb-2 font-medium">投递邮件</div><pre className="whitespace-pre-wrap rounded-md bg-muted p-4">{applicationMaterials.applicationEmail}</pre></div>
                <div><div className="mb-2 font-medium">招聘沟通话术</div><pre className="whitespace-pre-wrap rounded-md bg-muted p-4">{applicationMaterials.recruiterMessage}</pre></div>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader><CardTitle>编辑简历原文</CardTitle></CardHeader>
            <CardContent>
              <form action={saveResumeContentAction.bind(null, resume.id)} className="space-y-4">
                <Textarea name="contentMarkdown" defaultValue={resume.contentMarkdown} className="min-h-[520px] font-mono" />
                <Button type="submit"><Save className="size-4" />保存内容</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>简历预览</CardTitle></CardHeader>
            <CardContent>
              {rendered ? (
                <ResumeDocument
                  markdown={rendered.markdown}
                  templateKey={rendered.template.key}
                  className="max-h-[900px] overflow-auto rounded-md border p-8 text-sm"
                />
              ) : (
                <ErrorPanel title="简历模板渲染失败" message="正文仍可编辑，请检查模板配置后重试。" details={renderError} />
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
