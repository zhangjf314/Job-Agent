import { LLMClientError } from "../services/ai/llm-client";

export function createSmokeRequestLimiter(
  fetcher: typeof fetch,
  maximum: number,
  onRequest?: () => void,
): typeof fetch {
  let requestCount = 0;
  return async (request, init) => {
    if (requestCount >= maximum) {
      throw new LLMClientError(
        "SMOKE_EXTERNAL_REQUEST_LIMIT_REACHED",
        `Smoke request budget of ${maximum} external calls was exhausted.`,
      );
    }
    requestCount += 1;
    onRequest?.();
    return fetcher(request, init);
  };
}
