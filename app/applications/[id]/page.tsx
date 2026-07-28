import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getApplicationById, generateApplicationInsight } from "@/services/applications/application-service";
import {
  addInterviewFeedbackAction,
  createApplicationTaskAction,
  createInterviewRoundAction,
  createOfferRecordAction,
  updateApplicationStatusAction,
  updateApplicationTaskStatusAction,
  updateOfferStatusAction,
} from "../actions";

type Props = { params: Promise<{ id: string }> };

const applicationStatuses = [
  ["planned", "计划中"],
  ["applied", "已投递"],
  ["resume_screen", "简历筛选"],
  ["written_test", "笔试"],
  ["interviewing", "面试中"],
  ["offer", "已获录用机会"],
  ["rejected", "已拒绝"],
  ["withdrawn", "已撤回"],
  ["no_response", "暂无回复"],
  ["archived", "已归档"],
] as const;

const taskStatuses = [
  ["todo", "待办"],
  ["in_progress", "进行中"],
  ["done", "已完成"],
  ["skipped", "已跳过"],
] as const;

export default async function ApplicationDetailPage({ params }: Props) {
  const { id } = await params;
  const application = await getApplicationById(id);
  if (!application) notFound();
  const insight = await generateApplicationInsight(id);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{application.company} · {application.jobTitle}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{application.city ?? "城市未填写"}</span>
            <StatusBadge value={application.status} />
            <StatusBadge value={application.priority} />
          </p>
        </div>
        <Button asChild variant="outline"><Link href="/applications">返回工作台</Link></Button>
      </div>

      <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <Card>
            <CardHeader><CardTitle>状态流转</CardTitle></CardHeader>
            <CardContent>
              <form action={updateApplicationStatusAction} className="flex gap-2">
                <input type="hidden" name="applicationId" value={application.id} />
                <select name="status" defaultValue={application.status} className="h-10 flex-1 rounded-md border px-3">
                  {applicationStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <Button type="submit" variant="outline">更新</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>求职洞察</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>{insight.summary}</div>
              <div>风险：<StatusBadge value={insight.currentRiskLevel} /></div>
              <div className="font-medium">下一步</div>
              {insight.nextBestActions.map((item) => <div key={item}>- {item}</div>)}
              <div className="font-medium">简历建议</div>
              {(insight.resumeSuggestions.length ? insight.resumeSuggestions : ["暂无"]).map((item) => <div key={item}>- {item}</div>)}
              <div className="font-medium">面试准备</div>
              {(insight.interviewPrepSuggestions.length ? insight.interviewPrepSuggestions : ["暂无"]).map((item) => <div key={item}>- {item}</div>)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>关联信息</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {application.jobPostId ? <Button asChild variant="outline" className="w-full"><Link href={`/jobs/${application.jobPostId}`}>查看岗位</Link></Button> : null}
              {application.resumeId ? <Button asChild variant="outline" className="w-full"><Link href={`/resume/${application.resumeId}`}>查看投递简历</Link></Button> : null}
              {application.jdAnalysisId ? <Button asChild variant="outline" className="w-full"><Link href={`/jd/${application.jdAnalysisId}`}>查看岗位分析</Link></Button> : null}
              {application.jobMatch ? <div>匹配分：{application.jobMatch.matchScore} / 100</div> : null}
              {application.jobMatch?.gaps?.length ? <div>差距：{application.jobMatch.gaps.join("、")}</div> : null}
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>任务</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              {application.tasks.map((task) => (
                <form key={task.id} action={updateApplicationTaskStatusAction} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                  <input type="hidden" name="applicationId" value={application.id} />
                  <input type="hidden" name="taskId" value={task.id} />
                  <div><div className="font-medium">{task.title}</div><div className="text-muted-foreground">{task.description}</div></div>
                  <select name="status" defaultValue={task.status} className="h-9 rounded-md border px-2">
                    {taskStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <Button type="submit" variant="outline">保存</Button>
                </form>
              ))}
              <form action={createApplicationTaskAction} className="grid gap-3 rounded-md border p-3">
                <input type="hidden" name="applicationId" value={application.id} />
                <input type="hidden" name="profileId" value={application.profileId} />
                <input name="title" placeholder="新增任务" className="h-10 rounded-md border px-3" />
                <textarea name="description" placeholder="任务说明" className="min-h-20 rounded-md border p-3" />
                <Button type="submit" variant="outline">新增任务</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>面试轮次与反馈</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              {application.interviewRounds.map((round) => (
                <div key={round.id} className="space-y-3 rounded-md border p-3">
                  <div className="font-medium">{round.roundName} · {round.roundType} · {round.status}</div>
                  {round.feedback.map((feedback) => (
                    <div key={feedback.id} className="rounded-md bg-muted p-3">
                      知识缺口：{feedback.knowledgeGaps.join("、") || "暂无"}<br />
                      行动：{feedback.improvementActions.join("、") || "暂无"}
                    </div>
                  ))}
                  <form action={addInterviewFeedbackAction} className="grid gap-3">
                    <input type="hidden" name="applicationId" value={application.id} />
                    <input type="hidden" name="roundId" value={round.id} />
                    <textarea name="feedbackText" placeholder="粘贴本轮面试反馈或复盘" className="min-h-24 rounded-md border p-3" />
                    <div className="flex gap-2">
                      <input name="selfRating" placeholder="自评 1-5" className="h-10 w-32 rounded-md border px-3" />
                      <select name="result" className="h-10 rounded-md border px-3">
                        <option value="unknown">未知</option>
                        <option value="passed">通过</option>
                        <option value="failed">未通过</option>
                        <option value="pending">等待结果</option>
                      </select>
                      <Button type="submit" variant="outline">保存反馈</Button>
                    </div>
                  </form>
                </div>
              ))}
              <form action={createInterviewRoundAction} className="grid gap-3 rounded-md border p-3">
                <input type="hidden" name="applicationId" value={application.id} />
                <div className="grid gap-3 md:grid-cols-3">
                  <input name="roundName" placeholder="一面 / HR 面 / 笔试" className="h-10 rounded-md border px-3" />
                  <select name="roundType" className="h-10 rounded-md border px-3">
                    <option value="technical">技术面</option>
                    <option value="hr">HR 面</option>
                    <option value="written_test">笔试</option>
                    <option value="video">视频面试</option>
                    <option value="other">其他</option>
                  </select>
                  <select name="status" className="h-10 rounded-md border px-3">
                    <option value="scheduled">已安排</option>
                    <option value="completed">已完成</option>
                    <option value="unknown">未知</option>
                  </select>
                </div>
                <Button type="submit" variant="outline">新增面试轮次</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>录用机会</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              {application.offers.map((offer) => (
                <form key={offer.id} action={updateOfferStatusAction} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                  <input type="hidden" name="applicationId" value={application.id} />
                  <input type="hidden" name="offerId" value={offer.id} />
                  <div>{offer.company} · {offer.jobTitle} · {offer.salaryText ?? "薪资未填写"}</div>
                  <select name="status" defaultValue={offer.status} className="h-9 rounded-md border px-2">
                    <option value="pending">待决定</option>
                    <option value="accepted">已接受</option>
                    <option value="declined">已拒绝</option>
                    <option value="expired">已过期</option>
                    <option value="negotiating">沟通中</option>
                  </select>
                  <Button type="submit" variant="outline">更新</Button>
                </form>
              ))}
              <form action={createOfferRecordAction} className="grid gap-3 rounded-md border p-3">
                <input type="hidden" name="applicationId" value={application.id} />
                <div className="grid gap-3 md:grid-cols-3">
                  <input name="company" defaultValue={application.company} className="h-10 rounded-md border px-3" />
                  <input name="jobTitle" defaultValue={application.jobTitle} className="h-10 rounded-md border px-3" />
                  <input name="salaryText" placeholder="18k*14 / 15-25k" className="h-10 rounded-md border px-3" />
                </div>
                <textarea name="pros" placeholder="优势，逗号或换行分隔" className="min-h-20 rounded-md border p-3" />
                <textarea name="cons" placeholder="风险或顾虑，逗号或换行分隔" className="min-h-20 rounded-md border p-3" />
                <Button type="submit" variant="outline">创建录用机会</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
