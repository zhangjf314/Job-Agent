import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { publicAIConfig } from "@/lib/ai-config";
import { testAIConnectionAction, testAIStructuredOutputAction } from "./actions";

function providerLabel(value: string) {
  if (value === "llm_provider") return "真实模型服务";
  if (value === "mock") return "本地规则模拟";
  return value;
}

export default function AISettingsPage() {
  const config = publicAIConfig();
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <h1 className="text-2xl font-semibold">智能服务设置</h1>
      <Card>
        <CardHeader>
          <CardTitle>运行状态</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>配置模式：{providerLabel(config.provider)}</div>
          <div>实际使用：{providerLabel(config.effectiveProvider)}</div>
          <div>模型名称：{config.model}</div>
          <div>模型密钥：{config.hasApiKey ? "已配置" : "未配置"}</div>
          {!config.hasApiKey ? (
            <p className="text-muted-foreground">
              当前未配置模型密钥，系统会继续使用本地规则模拟，不影响基础演示。
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <form action={async () => {
              "use server";
              await testAIConnectionAction();
            }}>
              <Button type="submit" variant="outline">测试配置</Button>
            </form>
            <form action={async () => {
              "use server";
              await testAIStructuredOutputAction();
            }}>
              <Button type="submit">测试结构化输出</Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
