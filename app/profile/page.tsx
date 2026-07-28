import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCareerProfiles, getOrCreateDemoUser } from "@/services/career-profile-service";
import { createMockProfileAction } from "./actions";

export default async function ProfilePage() {
  const user = await getOrCreateDemoUser();
  const profiles = await getCareerProfiles(user.id);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">职业档案</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            管理基本信息、教育经历、技能、项目、实习、证书、获奖和补充材料。
          </p>
        </div>
        <div className="flex gap-2">
          <form action={createMockProfileAction}>
            <Button type="submit" variant="outline">
              <Sparkles className="size-4" />
              添加演示档案
            </Button>
          </form>
          <Button asChild>
            <Link href="/profile/new">
              <Plus className="size-4" />
              新建档案
            </Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-4">
        {profiles.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              暂无职业档案，可以新建档案或添加演示数据。
            </CardContent>
          </Card>
        ) : (
          profiles.map((profile) => (
            <Card key={profile.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>{profile.basicInfo?.realName ?? "未命名档案"}</CardTitle>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {profile.targetRoles.join(" / ")} · {profile.targetCities.join(" / ")}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold">{profile.profileCompletenessScore} / 100</div>
                  <div className="text-muted-foreground">完整度</div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm md:grid-cols-4">
                <div>教育：{profile.educationItems.length}</div>
                <div>技能：{profile.skillItems.length}</div>
                <div>项目：{profile.projectItems.length}</div>
                <div>经历：{profile.experienceItems.length}</div>
                <Button asChild variant="outline" className="md:col-span-4">
                  <Link href={`/profile/${profile.id}`}>查看和编辑</Link>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </main>
  );
}
