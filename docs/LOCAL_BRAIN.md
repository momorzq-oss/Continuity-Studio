# Local Brain

Local Brain has two deliberately separate implementations behind one provider boundary.

## Built-in offline engine

The existing deterministic production engine requires no network, API key, model download, or local server. It remains the default implementation when the external local-model toggle is off. It supports all existing phases, Full/Phases control, Markdown/JSON artifacts, continuity checks, regeneration, and export.

## OpenAI-compatible local server

Enable **Settings → Local → Connect an OpenAI-compatible local server** to use a model server that exposes:

- `GET /v1/models`
- `POST /v1/chat/completions`

Configure:

- Server URL (default example `http://127.0.0.1:11434`)
- Exact model name
- Context length
- Temperature
- Request timeout

The URL may include `/v1`; Continuity Studio normalizes it. The provider is not tied to a single local-model vendor.

## Health states

Before generation, the provider checks the configured model list. The UI distinguishes loading, connected, disconnected, model unavailable, generating, and error states. If the external server is enabled but unreachable or its model is absent, generation stops with explicit Retry, Continue Codex, Switch Brain, or Cancel options. It does not silently use the built-in engine after such a failure.

To intentionally return to fully offline operation, disable the external server toggle. Project browsing, editing, approvals, history, and export never require Codex or internet access.

## Hybrid behavior

Hybrid's balanced policy sends repeatable story/asset/frame/prompt/export production to Local and project-wide bible/sequence/continuity supervision to Codex. If the external local server is disabled, Local means the built-in offline engine. Change the policy only in Settings; the routing table itself is centralized in `server/brains/routing-policy.ts`.

## Troubleshooting

1. Confirm the model server is running.
2. Open its `/v1/models` endpoint and verify the configured model ID exactly matches.
3. Check that a firewall is not blocking localhost.
4. Increase timeout for large local models.
5. Use Diagnostics and `Documents\Continuity Studio\Logs\local-model.jsonl` for sanitized errors.
6. Disable the external server if you want the built-in offline engine.
