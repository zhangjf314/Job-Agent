"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/services/auth/current-user";
import { deleteUserData } from "@/services/user-data-service";

export async function deleteCurrentUserDataAction() {
  const user = await getCurrentUser();
  await deleteUserData(user.id);
  revalidatePath("/");
  redirect("/dashboard");
}
