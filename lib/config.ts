export type AppConfig = {
  databaseUrl: string;
  appMode: string;
  demoUserEmail: string;
  searchProvider: string;
  searchApiKey: string;
  searchApiBaseUrl: string;
  searchBaseUrl: string;
  jobSearchDefaultLimit: number;
  jobFetchTimeoutMs: number;
  enableRealWebSearch: boolean;
  enableCompanyPageFetch: boolean;
  userAgent: string;
};

function bool(value: string | undefined, fallback = false) {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

function intValue(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAppConfig(env: Partial<NodeJS.ProcessEnv> = process.env): AppConfig {
  return {
    databaseUrl: env.DATABASE_URL ?? "",
    appMode: env.APP_MODE ?? "development",
    demoUserEmail: env.DEMO_USER_EMAIL ?? "demo@example.com",
    searchProvider: env.SEARCH_PROVIDER ?? "fixture",
    searchApiKey: env.SEARCH_API_KEY ?? "",
    searchApiBaseUrl: env.SEARCH_API_BASE_URL ?? "",
    searchBaseUrl: env.SEARCH_BASE_URL ?? env.SEARCH_API_BASE_URL ?? "",
    jobSearchDefaultLimit: intValue(env.JOB_SEARCH_DEFAULT_LIMIT, 20),
    jobFetchTimeoutMs: intValue(env.JOB_FETCH_TIMEOUT_MS, 15000),
    enableRealWebSearch: bool(env.ENABLE_REAL_WEB_SEARCH),
    enableCompanyPageFetch: bool(env.ENABLE_COMPANY_PAGE_FETCH),
    userAgent: env.USER_AGENT ?? "PersonalJobAgent/0.1 (+https://localhost)",
  };
}

export function hasDatabaseUrl(env: Partial<NodeJS.ProcessEnv> = process.env) {
  return Boolean(getAppConfig(env).databaseUrl.trim());
}

export const appConfig = getAppConfig();
