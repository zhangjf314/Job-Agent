import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCareerProfiles, getOrCreateDemoUser } from "@/services/career-profile-service";
import { createManualApplicationAction } from "../actions";

export default async function NewApplicationPage() {
  const user = await getOrCreateDemoUser();
  const profiles = await getCareerProfiles(user.id);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <h1 className="text-2xl font-semibold">手动创建投递记录</h1>
      <Card>
        <CardHeader><CardTitle>投递信息</CardTitle></CardHeader>
        <CardContent>
          <form action={createManualApplicationAction} className="grid gap-4">
            <label className="grid gap-2 text-sm">职业档案
              <select name="profileId" className="h-10 rounded-md border px-3">
                {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.basicInfo?.realName ?? profile.id}</option>)}
              </select>
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm">公司<input name="company" className="h-10 rounded-md border px-3" required /></label>
              <label className="grid gap-2 text-sm">岗位<input name="jobTitle" className="h-10 rounded-md border px-3" required /></label>
              <label className="grid gap-2 text-sm">城市<input name="city" className="h-10 rounded-md border px-3" /></label>
              <label className="grid gap-2 text-sm">来源链接<input name="sourceUrl" className="h-10 rounded-md border px-3" /></label>
              <label className="grid gap-2 text-sm">渠道
                <select name="channel" className="h-10 rounded-md border px-3">
                  <option value="online_platform">在线平台</option>
                  <option value="company_website">企业官网</option>
                  <option value="referral">内推</option>
                  <option value="email">邮件</option>
                  <option value="campus_event">校园活动</option>
                  <option value="wechat">微信</option>
                  <option value="other">其他</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm">优先级
                <select name="priority" className="h-10 rounded-md border px-3">
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </label>
            </div>
            <label className="grid gap-2 text-sm">薪资期望<input name="salaryExpectation" className="h-10 rounded-md border px-3" /></label>
            <label className="grid gap-2 text-sm">备注<textarea name="notes" className="min-h-28 rounded-md border p-3" /></label>
            <Button type="submit">创建投递</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
