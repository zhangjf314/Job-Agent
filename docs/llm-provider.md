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
LLM_THINKING_MODE=provider_default
LLM_FALLBACK_TO_MOCK=false
```

`LLM_RETRY_COUNT` is the number of additional attempts after the initial
request. Network errors, HTTP 408, 429, and 5xx responses are retried with
bounded exponential backoff and jitter. HTTP 400, 401, 403, 404, and 422 are not
retried. Each request is cancelled with `AbortController` at the configured
timeout.

When `LLM_JSON_MODE=true`, the client sends
`response_format: {"type":"json_object"}`. Set it to `false` if a compatible
provider rejects that option; prompts and Zod validation remain active.

`LLM_THINKING_MODE=provider_default` is the safe, compatible default and omits
the optional `thinking` request field. Use `enabled` or `disabled` only when the
configured provider explicitly supports that parameter. For concise,
strictly-structured JSON tasks with DeepSeek V4, `LLM_THINKING_MODE=disabled`
can prevent reasoning output from consuming the final-output token budget.
Disabling thinking does not disable JSON mode. Any returned
`reasoning_content` is discarded and is never used as business output.

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

### Grounded tailored-resume normalization

Tailored-resume JSON passes through a narrow allowlisted normalizer before the
strict Grounded Zod schema. The production output contract, topology
diagnostics, and normalizer share one fixed section definition:
`type,title,lines,order`. Section `type` and `order` are assigned from the fixed
output position, and string-only `sourceFactIds` arrays are deduplicated in
original order. Shared Grounded limits require `changedSections` to contain at
most two unique canonical section types representing only the most materially
changed sections. Each `GroundedText.sourceFactIds` contains at most eight
unique candidate `F_*` IDs and only the minimum sufficient evidence. A claim
that needs more evidence must be split into independently understandable
lines; evidence is never truncated. Every ID is still checked against the
candidate fact registry, while unknown and `J_REQ_*` IDs fail the factuality
gate. Unknown object fields are rejected rather than recursively coerced or
passed through.

`rewriteExplanation` is a strict JSON string array with zero to two concise,
non-empty items. A single string, `null`, an object, or more than two items
fails the Grounded schema; the normalizer never wraps, splits, truncates, or
otherwise rewrites this field. Safe observation stores only its received type,
count when it is an array, and the shared limit—never explanation text.

The three application-material arrays remain required and non-empty because
the unchanged public business schema requires non-empty strings. Missing,
`null`, or wrongly typed material arrays are not synthesized or coerced and
continue to fail schema validation. Safe observation stores only stage statuses,
cardinality counts, fixed limits, and fixed schema paths—never generated text
or fact-ID values.

If the deterministic factuality gate rejects an otherwise valid Grounded
result, violations are grouped by their fixed `GroundedText` path into stable
temporary targets (`T1`, `T2`, ...). The single allowed factuality-repair
request receives only the candidate fact registry, JD-only requirements, and
the targeted claims. It returns one strict `replace` patch per target rather
than regenerating the full resume. The application validates exact target
coverage and candidate `F_*` IDs, applies patches to a deep copy, verifies that
only targeted `text`, `sourceFactIds`, and `kind` values changed, then reruns
the complete Grounded schema and factuality gate. Unknown paths, missing,
duplicate, or extra targets, scope changes, incomplete repairs, and newly
introduced violations all remain blocking failures. Safe observation records
only target paths, fixed categories, counts, and before/after status; target
text, replacement text, fact-ID values, prompts, and responses are never
stored.

Patch validation also emits bounded, value-free diagnostics. It distinguishes
JSON, envelope, target coverage, per-patch structure, per-patch semantics,
scope, application, post-repair schema, and post-repair factuality stages.
Coverage records expected and received counts, missing system-generated `T*`
IDs, duplicate legal `T*` IDs, an unknown-target count, and whether provider
order matched system order. Per-target issues contain only fixed categories,
fixed target IDs and paths, safe value types, cardinalities, and fixed kind
classes. At most 30 stably sorted issues are reported. Any issue atomically
rejects the complete patch, accepts zero replacements, and leaves the initial
Grounded object unchanged. No target or replacement text, fact-ID value,
candidate/JD text, prompt, response, hash, or encoded fragment is observed.

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
- `400` or `422` mentioning `thinking`: verify provider support or set
  `LLM_THINKING_MODE=provider_default`; the client never removes the parameter
  and retries silently.
- malformed JSON: one repair is attempted, then a structured-output error is returned.
- schema failure: compare provider capability with the selected business schema;
  invalid data is never cast into the business layer.

Never commit `.env`, credentials, smoke output, or private job-search data.
