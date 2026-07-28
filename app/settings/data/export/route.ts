import { NextResponse } from "next/server";
import { getCurrentUser } from "@/services/auth/current-user";
import { exportUserData } from "@/services/user-data-service";
import { toFriendlyError } from "@/lib/errors";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const data = await exportUserData(user.id);
    return NextResponse.json(data, {
      headers: {
        "Content-Disposition": `attachment; filename="personal-job-agent-${user.email}.json"`,
      },
    });
  } catch (error) {
    const friendly = toFriendlyError(error);
    return NextResponse.json({ error: friendly.message, code: friendly.code }, { status: 500 });
  }
}
