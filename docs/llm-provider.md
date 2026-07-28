# OpenAI-compatible LLM provider

The application has one LLM abstraction and two execution modes. `mock` uses the
deterministic local providers. `llm_provider` uses the existing provider factory
and `services/ai/llm-client.ts` to call an OpenAI-compatible Chat Completions
endpoint. The production JD analysis, tailored-resume, and career-strategy
services already enter through that factory.

## Configuration

Copy `.env.example` to `.env` and keep `.env` untracked. Mock mode needs no LLM
credentials:

```env
AI_PROVIDER=mock
```

Real mode requires all three endpoint values:

```env
AI_PROVIDER=llm_provider
LLM_API_KEY=
LLM_MODEL=
LLM_BASE_URL=
```

Request behavior:

```env
LLM_TIMEOUT_MS=30000
LLM_TEMPERATURE=0.2
LLM_MAX_OUTPUT_TOKENS=1600
LLM_RETRY_COUNT=2
LLM_JSON_MODE=true
LLM_FALLBACK_TO_MOCK=false
```

`LLM_RETRY_COUNT` is the number of additional attempts after the initial
request. Network errors, HTTP 408, 429, and 5xx responses are retried with
bounded exponential backoff and jitter. HTTP 400, 401, 403, and 404 are not
retried. Each request is cancelled with `AbortController` at the configured
timeout.

When `LLM_JSON_MODE=true`, the client sends
`response_format: {"type":"json_object"}`. Set it to `false` if a compatible
provider rejects that option; prompts and Zod validation remain active.

Mock fallback is deliberately off by default. With
`LLM_FALLBACK_TO_MOCK=false`, a real-provider error is surfaced. If explicitly
enabled, fallback occurs only after transport retries and at most one structured
JSON repair have failed. The business result contains a fallback warning, and a
separate observation is recorded with `providerUsed=mock` and
`fallbackUsed=true`.

## Structured output and observation

The JD, tailored-resume, and career-strategy flows use their existing Zod
schemas. The client accepts a complete JSON value or one outer `json` Markdown
fence, validates it, and performs at most one repair request after JSON or
schema failure. It never extracts an arbitrary brace substring.

The existing `LLMCallLog` stores provider, model, status, latency, token usage,
optional estimated cost, error category, and fallback state. Its JSON metadata
stores request IDs, timestamps, HTTP status, retry/repair counts, provider
requested/used, and currency. Prompts, complete responses, authorization
headers, API keys, resumes, and JDs are not stored.

Cost is estimated only when the provider returns usage and both prices are
configured:

```env
LLM_PRICE_CURRENCY=USD
LLM_INPUT_PRICE_PER_MILLION=
LLM_OUTPUT_PRICE_PER_MILLION=
```

Prices are never hard-coded. Missing prices or usage leave cost unavailable and
do not block the call.

## Local real-provider smoke test

Configure `.env`, then run:

```powershell
npm run smoke:llm
```

The script preflights configuration, uses only fictional demo content, makes at
most six external requests, and prints safe summaries for connection, JD
analysis, tailored resume, and career strategy. It does not write business data
or print prompts, model responses, credentials, or authorization headers.

This command is intentionally excluded from `npm run check` and GitHub Actions.
CI remains fully offline with Mock AI.

## Troubleshooting

- `401`: verify `LLM_API_KEY`; it is never displayed by the application.
- `404`: verify the base URL, Chat Completions endpoint, and model name.
- `429`: check provider quota/rate limits; the client performs only bounded retries.
- `timeout`: increase `LLM_TIMEOUT_MS` only after checking endpoint latency/network.
- `400` mentioning `response_format`: set `LLM_JSON_MODE=false`.
- malformed JSON: one repair is attempted, then a structured-output error is returned.
- schema failure: compare provider capability with the selected business schema;
  invalid data is never cast into the business layer.

Never commit `.env`, credentials, smoke output, or private job-search data.
