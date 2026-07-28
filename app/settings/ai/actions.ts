"use server";

import { z } from "zod";
import { getAIConfig, publicAIConfig } from "@/lib/ai-config";
import { createLLMClient } from "@/services/ai/provider-factory";

const testSchema = z.object({
  ok: z.literal(true),
  message: z.string().min(1),
});

export type AITestResult = {
  ok: boolean;
  message: string;
  details?: string;
};

async function runMinimalTest(): Promise<AITestResult> {
  const config = getAIConfig();
  const publicConfig = publicAIConfig(config);
  if (publicConfig.provider === "mock") {
    return { ok: true, message: "当前为 Mock 模式；未向外部模型发送请求。" };
  }
  if (publicConfig.configurationIssues.length) {
    return {
      ok: false,
      message: "真实模型配置无效。",
      details: publicConfig.configurationIssues.join("；"),
    };
  }

  try {
    const result = await createLLMClient(config).structuredCompletion({
      schemaName: "ai_settings_test",
      schema: testSchema,
      maxOutputTokens: 64,
      messages: [
        { role: "system", content: "Return a minimal JSON health-check result." },
        { role: "user", content: 'Return {"ok":true,"message":"connection healthy"}.' },
      ],
    });
    return {
      ok: true,
      message: "真实模型连接与结构化输出均正常。",
      details: `requestId=${result.metadata.requestId}，latency=${result.metadata.latencyMs}ms，tokens=${result.usage?.total_tokens ?? "未返回"}`,
    };
  } catch (error) {
    return {
      ok: false,
      message: "真实模型测试失败。",
      details: error instanceof Error ? error.message : "未知错误",
    };
  }
}

export async function testAIConnectionAction() {
  return runMinimalTest();
}

export async function testAIStructuredOutputAction() {
  return runMinimalTest();
}
