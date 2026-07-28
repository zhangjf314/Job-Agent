import { describe, expect, it } from "vitest";
import { parseJobSearchFormData } from "@/app/jobs/form-parsers";

describe("job actions", () => {
  it("parses search form", () => {
    const form = new FormData();
    form.set("profileId", "p1");
    form.set("query", "Java 后端");
    form.set("city", "杭州");
    expect(parseJobSearchFormData(form)).toMatchObject({ profileId: "p1", query: "Java 后端", city: "杭州" });
  });
});
