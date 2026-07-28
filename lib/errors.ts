export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly technicalDetail?: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "资源不存在") {
    super(message, "NOT_FOUND");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "无权访问该资源") {
    super(message, "FORBIDDEN");
  }
}

export class ValidationError extends AppError {
  constructor(message = "输入校验失败") {
    super(message, "VALIDATION_ERROR");
  }
}

export class DatabaseNotConfiguredError extends AppError {
  constructor(message = "请先配置 DATABASE_URL 并运行 migration。", technicalDetail?: string) {
    super(message, "DATABASE_NOT_CONFIGURED", technicalDetail);
  }
}

export class DatabaseConnectionError extends AppError {
  constructor(message = "数据库连接失败：应用已启动，但无法连接 PostgreSQL。", technicalDetail?: string) {
    super(message, "DATABASE_CONNECTION_FAILED", technicalDetail);
  }
}

export class ExternalServiceDisabledError extends AppError {
  constructor(message = "外部服务未启用。") {
    super(message, "EXTERNAL_SERVICE_DISABLED");
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function isDatabaseNotConfiguredError(error: unknown) {
  if (error instanceof DatabaseNotConfiguredError) return true;
  const message = errorMessage(error);
  return message.includes("DATABASE_URL") || message.includes("Environment variable not found");
}

export function isDatabaseConnectionError(error: unknown) {
  if (error instanceof DatabaseConnectionError) return true;
  const message = errorMessage(error);
  return (
    message.includes("P1001") ||
    message.includes("Can't reach database server") ||
    message.includes("ECONNREFUSED") ||
    message.includes("connect ECONNREFUSED") ||
    message.includes("Connection refused")
  );
}

export function toFriendlyError(error: unknown) {
  const detail = errorMessage(error);
  if (isDatabaseNotConfiguredError(error)) return new DatabaseNotConfiguredError("请先配置 DATABASE_URL 并运行 migration。", detail);
  if (isDatabaseConnectionError(error)) return new DatabaseConnectionError("数据库连接失败：应用已启动，但无法连接 PostgreSQL。", detail);
  if (error instanceof AppError) return error;
  return new AppError("系统暂时无法完成该操作，请稍后重试或查看服务日志。", "UNKNOWN_ERROR", detail);
}
