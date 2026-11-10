# Report: PE-01 OpenRouter investigation

**Task:** PE-01 | **Agent:** E | **Date:** 2026-10-21 | **Status:** In review

## Summary
Checked what OpenRouter offers for a free, bring-your-own-key assistant: limits, free models, structured output, web search and privacy. Everything below comes from OpenRouter's documentation and third-party write-ups read on 2026-10-21. **No model was called**, so structured-output quality of any free model is untested (see "Not run").

## Findings (investigations)

| Topic | Finding | Source type |
|---|---|---|
| Free limits | Free models: 20 requests per minute, **50 requests per day**. After buying at least $10 of credit once: 1,000 per day (still 20 per minute). Another third-party page lists 200 per day per model; this conflicts with OpenRouter's own help article, so the app must not hard-code a number and should read the live quota. | OpenRouter help article; two write-ups agree on 50/1,000; one disagrees |
| Failed calls | A failed free request still counts against the daily quota (write-up, not confirmed in OpenRouter's article). So retry loops can burn the day. | Third-party, unverified |
| Live quota | `GET /api/v1/key` is said to report free-model daily usage. Field names were not confirmed; the client passes the raw object through. | Third-party, unverified |
| Errors | 429 = throttled or daily limit. 402 = no credit or spending cap (`error.metadata.limit_source` says which). 401/403 = bad key. | OpenRouter help article |
| Free models | 18 listed on 2026-10-19 (for example `google/gemma-4-31b-it:free`, `nvidia/nemotron-3-super-120b-a12b:free`, and the router `openrouter/free`). The list changes often, so the app reads it live (`GET /models`) and filters free ones. | costgoat.com list |
| Structured output | `response_format: json_schema` is supported per endpoint, not per model. Add `provider.require_parameters: true` so OpenRouter only routes to endpoints that honour it. `strict: true` is not guaranteed by every provider. A "response healing" plugin exists for non-streaming calls. | OpenRouter docs |
| Free router | `openrouter/free` picks a model at random. The reply's `model` field names the one that answered, which matters for data handling. | Write-up |
| Web search | `:online` suffix or `plugins: [{id: "web"}]`. Costs $4 per 1,000 results from credits (up to about $0.02 per request at 5 results). The docs do not say it works on free models, nor what is sent to the search provider. **Not free, so it conflicts with "the project stays free" unless the person adds credit.** | OpenRouter docs |
| Privacy | Prompt logging at OpenRouter is opt-in, but metadata is kept. Training permissions differ per model, and free models often allow the provider to train on prompts. Zero-data-retention routing exists but excludes plugins and tools. | Write-up, partly unverified |
| Free chatbot web pages | Not recommended (fragile, likely against their terms). Use the API. | Brief, unchanged |

## What the code does about it (read from `electron/ai/`)
- Structured request with `require_parameters`; if an endpoint refuses `json_schema`, one retry asks for plain JSON. The app validates every reply itself, so a model that ignores the schema still cannot do anything outside the action list.
- 429: one retry (honours `Retry-After`, capped at 10 s). 5xx and network errors: up to two retries. Then a typed error the UI can show.
- One repair attempt when a reply fails validation, so at most two calls per request.
- The model that answered is returned with every plan.

## Recommendation
1. Default model `openrouter/free` is the most convenient but random; I recommend a pinned free model chosen from the live list (filtered to "supports structured outputs") as the default, with the router as an option. Needs the owner's answer (question 3 below).
2. Treat free models as **non-private**: show that in the first-use screen (DP6).
3. Do not ship web search in the first release. It needs credit and the data sent is undocumented. Offer it later as an optional, clearly paid toggle.
4. Show the remaining daily quota in Settings so a person on 50 per day knows why requests stop.

## Not run
- No call to OpenRouter (no key, and the sandbox cannot reach it). Quality of structured output on each free model is **untested**. Before choosing a default, run the same planning prompt (the planner's system prompt) against 3 or 4 free models, 10 times each, and count replies that validate on the first try.
- Quota field names from `GET /key` not confirmed.

## Sources
- OpenRouter Rate Limits (help article): https://openrouter.zendesk.com/hc/en-us/articles/39501163636379-OpenRouter-Rate-Limits-What-You-Need-to-Know
- Structured outputs: https://openrouter.ai/docs/features/structured-outputs
- Web search: https://openrouter.ai/docs/features/web-search
- Free model list (updated 2026-10-19): https://costgoat.com/pricing/openrouter-free-models
- Limits, privacy, fallbacks write-up: https://www.llmrumors.com/news/openrouter-free-model-limits-privacy-fallbacks
