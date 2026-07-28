import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getJDAnalysisById } from "@/services/jd-service";
import { generateTailoredResumeFromAnalysisAction } from "../actions";

type Props = {
  params: Promise<{ id: string }>;
};

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {items.length === 0 ? <p className="text-muted-foreground">暂无</p> : items.map((item) => <div key={item}>- {item}</div>)}
      </CardContent>
    </Card>
  );
}

export default async function JDDetailPage({ params }: Props) {
  const { id } = await params;
  const analysis = await getJDAnalysisById(id);
  if (!analysis) notFound();
  const tailored = analysis.tailoredResumes[0];

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{analysis.targetRole || analysis.jobDescription.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {analysis.jobDescription.company ?? "未知公司"} · 匹配分 {analysis.matchScore} / 100
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/jd">返回</Link>
          </Button>
          {tailored ? (
            <Button asChild>
              <Link href={`/resume/${tailored.tailoredResumeId}`}>查看定制简历</Link>
            </Button>
          ) : (
            <form action={generateTailoredResumeFromAnalysisAction.bind(null, analysis.id)}>
              <Button type="submit">生成定制简历</Button>
            </form>
          )}
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-5 text-sm">硬技能：{analysis.hardSkillScore}</CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-sm">项目：{analysis.projectMatchScore}</CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-sm">经历：{analysis.experienceMatchScore}</CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-sm">教育：{analysis.educationMatchScore}</CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-sm">关键词：{analysis.keywordCoverageScore}</CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ListBlock title="实习周期" items={analysis.internshipDuration ? [analysis.internshipDuration] : []} />
        <ListBlock title="转正机会" items={[analysis.conversionOpportunity]} />
        <ListBlock title="候选人画像" items={analysis.candidateProfile} />
        <ListBlock title="核心职责" items={analysis.coreResponsibilities} />
        <ListBlock title="硬技能" items={analysis.hardSkills} />
        <ListBlock title="软技能" items={analysis.softSkills} />
        <ListBlock title="经验要求" items={analysis.experienceRequirements} />
        <ListBlock title="学历要求" items={analysis.educationRequirements} />
        <ListBlock title="加分项" items={analysis.bonusPoints} />
        <ListBlock title="关键词" items={analysis.keywords} />
        <ListBlock title="匹配点" items={analysis.matchedPoints} />
        <ListBlock title="差距" items={analysis.gaps} />
        <ListBlock title="风险提示" items={analysis.riskWarnings} />
        <ListBlock title="简历改写建议" items={analysis.resumeRewriteSuggestions} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>JD 原文</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm leading-6">{analysis.jobDescription.rawText}</pre>
        </CardContent>
      </Card>
    </main>
  );
}
