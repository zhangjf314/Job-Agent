import Link from "next/link";
import { notFound } from "next/navigation";
import { generateGeneralResumeAction } from "@/app/resume/actions";
import { generateCareerStrategyAction } from "@/app/strategy/actions";
import { CareerProfileForm } from "@/components/career-profile-form";
import { ProfilePhotoEditor } from "@/components/profile-photo-editor";
import { ProjectFactAtomEditor } from "@/components/project-fact-atom-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCareerProfileById } from "@/services/career-profile-service";
import { getLatestCareerStrategyPlanByProfileId } from "@/services/strategy-service";
import { deleteCareerProfileAction, updateCareerProfileAction } from "../actions";
import { toCareerProfileFormValues } from "../form-values";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProfileDetailPage({ params }: Props) {
  const { id } = await params;
  const profile = await getCareerProfileById(id);
  if (!profile) notFound();
  const latestStrategy = await getLatestCareerStrategyPlanByProfileId(id);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">编辑职业档案</h1>
          <p className="mt-2 text-sm text-muted-foreground">完整度：{profile.profileCompletenessScore} / 100</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/profile">返回</Link>
          </Button>
          <form action={generateGeneralResumeAction.bind(null, id)}>
            <Button type="submit" variant="outline">生成通用简历</Button>
          </form>
          <form action={generateCareerStrategyAction.bind(null, id)}>
            <Button type="submit" variant="outline">生成求职策略</Button>
          </form>
          {latestStrategy ? (
            <Button asChild variant="outline">
              <Link href={`/strategy/${latestStrategy.id}`}>最近策略</Link>
            </Button>
          ) : null}
          <form action={deleteCareerProfileAction.bind(null, id)}>
            <Button type="submit" variant="destructive">删除档案</Button>
          </form>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>证件照</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfilePhotoEditor
            profileId={profile.id}
            initialHasPhoto={Boolean(profile.photoAsset)}
          />
        </CardContent>
      </Card>
      <ProjectFactAtomEditor profileId={profile.id} projects={profile.projectItems} />
      <CareerProfileForm
        mode="edit"
        defaultValues={toCareerProfileFormValues(profile)}
        onSubmit={updateCareerProfileAction.bind(null, id)}
      />
    </main>
  );
}
