"use server";

import { z } from "zod";
import { publicAIConfig } from "@/lib/ai-config";
import { LLMClient, LLMClientError } from "@/services/ai/llm-client";

const testSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
});

export async function testAIConnectionAction() {
  const config = publicAIConfig();
  if (!config.hasApiKey || config.effectiveProvider === "mock") {
    return { ok: true, message: "未配置模型密钥，当前使用本地规则模拟。" };
  }
  return { ok: true, message: `真实模型服务已配置，当前模型：${config.model}。` };
}

export async function testAIStructuredOutputAction() {
  try {
    const result = await new LLMClient().structuredCompletion({
      schemaName: "ai_settings_test",
      schema: testSchema,
      messages: [
        { role: "system", content: "返回一个最小 JSON 健康检查结果。" },
        { role: "user", content: "返回 {\"ok\":true,\"message\":\"结构化输出正常\"}。" },
      ],
    });
    return { ok: true, message: result.data.message };
  } catch (error) {
    if (error instanceof LLMClientError && error.code === "missing_api_key") {
      return { ok: true, message: "未配置模型密钥，仍可使用本地规则模拟。" };
    }
    return { ok: false, message: error instanceof Error ? error.message : "结构化输出测试失败。" };
  }
}
