"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  testAIConnectionAction,
  testAIStructuredOutputAction,
  type AITestResult,
} from "./actions";

export function AITestControls() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AITestResult>();

  function run(action: () => Promise<AITestResult>) {
    startTransition(async () => setResult(await action()));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={pending} onClick={() => run(testAIConnectionAction)}>
          测试连接
        </Button>
        <Button type="button" disabled={pending} onClick={() => run(testAIStructuredOutputAction)}>
          测试结构化输出
        </Button>
      </div>
      {result ? (
        <div
          role="status"
          className={`rounded-md border p-3 ${result.ok ? "border-green-600/40" : "border-destructive/40 text-destructive"}`}
        >
          <div>{result.message}</div>
          {result.details ? <div className="mt-1 text-xs text-muted-foreground">{result.details}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
