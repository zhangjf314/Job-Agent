import { describe, expect, it } from "vitest";
import { parseActionStatusFormData } from "@/app/strategy/form-parsers";

describe("strategy actions", () => {
  it("parses action status form data", () => {
    const form = new FormData();
    form.set("itemId", "item_1");
    form.set("status", "in_progress");
    expect(parseActionStatusFormData(form)).toEqual({ itemId: "item_1", status: "in_progress" });
  });
});
