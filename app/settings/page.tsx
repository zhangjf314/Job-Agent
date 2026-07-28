import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <h1 className="text-2xl font-semibold">设置</h1>
      <Card>
        <CardHeader>
          <CardTitle>数据与隐私</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            本地开发数据保存在 PostgreSQL。简历、面试反馈和投递记录都属于个人敏感信息，请谨慎部署和授权访问。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/settings/data">管理用户数据</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/settings/ai">智能服务设置</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
