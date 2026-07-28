/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { updateActionPlanItemStatus } from "@/services/strategy-service";

describe("strategy service", () => {
  it("updates action plan item status", async () => {
    const db = {
      actionPlanItem: {
        update: async ({ where, data }: any) => ({ id: where.id, ...data }),
      },
    } as any;
    const item = await updateActionPlanItemStatus("action_1", "done", db);
    expect(item).toMatchObject({ id: "action_1", status: "done" });
  });
});
