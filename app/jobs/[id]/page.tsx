import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createManualApplicationAction } from "@/app/applications/actions";
import { getCareerProfiles, getOrCreateDemoUser } from "@/services/career-profile-service";
import { getJobPostById } from "@/services/jobs/job-service";
import { classifyJobSource } from "@/services/jobs/job-source-classifier";
import { createJDFromJobPostAction, matchJobAction, saveJobAction } from "../actions";

type Props = { params: Promise<{ id: string }> };

export default async function JobDetailPage({ params }: Props) {
  const { id } = await params;
  const job = await getJobPostById(id);
  if (!job) notFound();
  const user = await getOrCreateDemoUser();
  const classified = classifyJobSource({ url: job.sourceUrl ?? "", title: job.title, snippet: job.description });
  const profiles = await getCareerProfiles(user.id);
  const profileId = profiles[0]?.id ?? "";

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div className="flex justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{job.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{job.company} · {job.city} · {job.salaryText ?? "薪资面议"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={saveJobAction}><input type="hidden" name="profileId" value={profileId} /><input type="hidden" name="jobPostId" value={job.id} /><Button type="submit" variant="outline">收藏岗位</Button></form>
          <form action={matchJobAction}><input type="hidden" name="profileId" value={profileId} /><input type="hidden" name="jobPostId" value={job.id} /><Button type="submit" variant="outline">重新匹配</Button></form>
          <form action={createJDFromJobPostAction}><input type="hidden" name="profileId" value={profileId} /><input type="hidden" name="jobPostId" value={job.id} /><Button type="submit" variant="outline">转 JD 分析</Button></form>
          <form action={createManualApplicationAction}>
            <input type="hidden" name="profileId" value={profileId} />
            <input type="hidden" name="jobPostId" value={job.id} />
            <input type="hidden" name="company" value={job.company} />
            <input type="hidden" name="jobTitle" value={job.normalizedTitle || job.title} />
            <input type="hidden" name="city" value={job.city} />
            <input type="hidden" name="sourceUrl" value={job.sourceUrl ?? ""} />
            <input type="hidden" name="channel" value="online_platform" />
            <Button type="submit">创建投递记录</Button>
          </form>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>岗位信息</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div>学历：{job.educationRequirement ?? "未说明"}</div>
          <div>经验：{job.experienceRequirement ?? "未说明"}</div>
          <div>实习周期：{job.internshipDuration ?? "未说明"}</div>
          <div>转正机会：{job.conversionOpportunity === "unknown" ? "未说明" : job.conversionOpportunity}</div>
          <div>类型：{job.jobType}</div>
          <div>工作模式：{job.workMode}</div>
          <div>来源：{job.source} {job.sourceUrl ?? ""}</div>
          <div>来源可信度：{classified.sourceTrustLevel}</div>
          <div>来源平台：{classified.sourcePlatform}</div>
          <div>质量分：{job.qualityScore}</div>
          <div className="md:col-span-2">来源提示：{classified.sourceWarnings.join("、") || "暂无"}</div>
          <div className="md:col-span-2">技能：{job.skills.join("、")}</div>
          <div className="md:col-span-2">候选人画像：{job.candidateProfile.join("；") || "未说明"}</div>
          <div className="md:col-span-2">风险：{job.riskFlags.join("、") || "暂无明显风险"}</div>
          {job.description.length < 120 ? <div className="text-muted-foreground md:col-span-2">该岗位信息可能不完整，建议打开来源确认。</div> : null}
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>描述</CardTitle></CardHeader><CardContent className="whitespace-pre-wrap text-sm">{job.description}</CardContent></Card>
      <Card><CardHeader><CardTitle>要求</CardTitle></CardHeader><CardContent className="whitespace-pre-wrap text-sm">{job.requirements}</CardContent></Card>
    </main>
  );
}
