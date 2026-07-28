import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { publicAIConfig } from "@/lib/ai-config";
import { AITestControls } from "./ai-test-controls";

function providerLabel(value: string) {
  if (value === "llm_provider") return "真实模型服务";
  if (value === "mock") return "本地规则 Mock";
  if (value === "configuration_error") return "配置错误";
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
          <div>实际状态：{providerLabel(config.effectiveProvider)}</div>
          <div>模型名称：{config.model}</div>
          <div>兼容接口：{config.baseUrl || "(未配置)"}</div>
          <div>模型密钥：{config.hasApiKey ? "已配置（值已隐藏）" : "未配置"}</div>
          <div>
            JSON 模式：{config.jsonMode ? "开启" : "关闭"}；失败回退 Mock：
            {config.fallbackToMock ? "开启" : "关闭"}
          </div>
          <div>成本估算：{config.hasCostEstimation ? "已配置" : "未配置"}</div>
          <div>
            超时：{config.timeoutMs}ms；额外重试：{config.retryCount} 次；最大输出：
            {config.maxOutputTokens} tokens
          </div>
          {config.configurationIssues.length ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive">
              配置错误：{config.configurationIssues.join("；")}
            </div>
          ) : null}
          {config.provider === "mock" ? (
            <p className="text-muted-foreground">
              当前为 Mock 模式，测试按钮不会向外部服务发送请求。
            </p>
          ) : null}
          <AITestControls />
        </CardContent>
      </Card>
    </main>
  );
}
