"use client";

import { ErrorPanel } from "@/components/error-panel";
import { toFriendlyError } from "@/lib/errors";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const friendly = toFriendlyError(error);
  const isDbConnection = friendly.code === "DATABASE_CONNECTION_FAILED";
  const isDbMissing = friendly.code === "DATABASE_NOT_CONFIGURED";
  const title = isDbConnection ? "数据库连接失败" : isDbMissing ? "数据库还没有配置好" : "页面加载失败";
  const message = isDbConnection
    ? "应用已启动，但无法连接 PostgreSQL。可能原因：PostgreSQL 没有启动、Docker 镜像拉取失败、DATABASE_URL 配置错误，或端口 5432 被占用/未映射。建议运行 npm run doctor；使用 Docker 时运行 npm run db 和 npm run setup；也可以修改 .env 使用本机或云 PostgreSQL。"
    : friendly.message;

  return (
    <html lang="zh-CN">
      <body>
        <main className="mx-auto max-w-3xl px-6 py-12">
          <ErrorPanel
            title={title}
            message={message}
            details={process.env.NODE_ENV === "development" ? friendly.technicalDetail : undefined}
            actionLabel="重试"
            onAction={reset}
          />
        </main>
      </body>
    </html>
  );
}
