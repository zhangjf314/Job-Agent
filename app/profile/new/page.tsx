import Link from "next/link";
import { CareerProfileForm } from "@/components/career-profile-form";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/services/auth/current-user";
import { createMockGraduateProfile } from "@/services/mock-profile";
import { createCareerProfileAction } from "../actions";
import { toCareerProfileFormValues } from "../form-values";

export default async function NewProfilePage() {
  const user = await getCurrentUser();
  const defaultValues = toCareerProfileFormValues(createMockGraduateProfile(user.id));

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">创建职业档案</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            默认填入一份中国大陆计算机应届生样例，可直接修改。
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/profile">返回</Link>
        </Button>
      </div>
      <CareerProfileForm mode="create" defaultValues={defaultValues} onSubmit={createCareerProfileAction} />
    </main>
  );
}
