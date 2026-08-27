# Codex App Server integration

Continuity Studio uses the official Codex App Server architecture; it does not emulate Codex and does not label an ordinary chat-completions request as Codex.

## Tested version and transport

- Tested and pinned npm package: `@openai/codex@0.144.4`
- Managed command: `codex app-server --stdio`
- Transport: newline-delimited bidirectional JSON-RPC over child-process stdin/stdout
- Official references: [Codex App Server](https://developers.openai.com/codex/app-server/) and [OpenAI Codex repository](https://github.com/openai/codex)

The desktop package includes the pinned Codex JavaScript launcher and Windows x64 native package. `CODEX_EXECUTABLE` is an optional development/recovery override; normal installed operation does not depend on a global `codex` command.

## Service layers

- `CodexProcessManager` resolves the pinned launcher, starts one hidden child process, and shuts it down with a bounded kill fallback.
- `CodexRpcClient` owns request IDs, timeouts, initialization, JSONL framing, notifications, server requests, and pending-request failure on exit.
- `CodexService` translates the protocol into project-level health, models, authentication, threads, turns, activities, approvals, cancellation, and reconnect behavior.
- `CodexBrainProvider` adapts the service to the shared Brain Router contract.

On startup the client sends `initialize`, then `initialized`, `model/list`, and `account/read`. Project generation starts or resumes a thread, starts a structured-output turn, receives streaming item/turn events, and persists the thread ID. A reopened project resumes that thread rather than losing its supervision context.

Version 0.144.4's generated v2 schema uses wire values `untrusted`/`on-request` and `read-only`/`workspace-write` for thread settings. Continuity Studio explicitly adapts its friendly settings to those tested values. Turn-level `sandboxPolicy` remains the structured v2 object.

## Authentication

**Connect Codex with ChatGPT** calls the App Server `account/login/start` flow. The returned official authentication URL is shown in an isolated app window. Continuity Studio never asks for, receives, prints, or manually stores the user's ChatGPT password. `account/read` and account notifications determine the real connection state; logout calls `account/logout`.

Codex authentication is distinct from `OPENAI_API_KEY`. Signing in to one does not configure the other.

## Threads, streaming, and cancellation

Each project stores `brain.codexThreadId`, the selected model, and transient active turn ID. The service:

1. Resumes the persisted thread where possible.
2. Starts a new project-scoped thread only when required.
3. Requests a small wrapper schema containing a summary and complete JSON artifact.
4. Converts item deltas/completion and turn completion into safe high-level activity.
5. Writes the artifact through the existing phase pipeline.
6. Interrupts an active turn with `turn/interrupt` on cancellation.

Raw JSON-RPC data and hidden reasoning are never rendered in the normal UI.

## Sandboxing and approvals

The current movie project directory is the Codex working directory. Trusted mode uses workspace-write scoped to that project and disables network access for turns. Untrusted mode is read-only. The configured approval policy is sent to Codex, and server approval requests become clear Allow/Deny cards in Brain Activity. Operations outside the project boundary do not receive silent broad access.

## Failure and reconnect behavior

App Server exit rejects pending requests and marks Codex disconnected. A later health check can start a fresh server; persisted project threads remain available to resume. Failure never deletes phase or project state. Codex failure presents Retry, Continue Local, Switch Brain, or Cancel. The router never silently pretends another provider produced the result.

Check connection state and the detected version in **Settings → Codex** or **Diagnostics**. Installed Codex logs are under `Documents\Continuity Studio\Logs\codex.jsonl` and are credential-sanitized.
