# Platforms and Providers

This document distinguishes working integrations from manual exports and future work.

## OpenAI

**Purpose:** optional text generation for production phases. **Setup:** set `OPENAI_API_KEY`; optional `OPENAI_MODEL`. **Working code:** OpenAI Responses API provider. **References:** structured reference metadata is supplied as project context; the API is not used for direct image generation. **Limitations:** image/video generation and external result import are not implemented.

## Codex

**Purpose:** supervise complex production phases through Codex App Server. **Setup:** connect with ChatGPT from Settings. **Working code:** bidirectional App Server lifecycle, project thread persistence, approvals, recovery, and provider routing. **References:** project memory and protected reference requirements are included in phase context. **Limitations:** Codex supervision does not itself turn manual Seedance/MiniMax/Higgsfield profiles into direct APIs.

## Seedance 2.5 — manual prompt/reference export

The compiler converts stable internal IDs into temporary request tags:

```text
CHAR_RASHID_001  → @Image 1
ANIMAL_CAMEL_001 → @Image 2
```

The internal identity never changes. Workflow: select sequence → select Seedance profile → resolve/rank references → assign `@Image` positions → compile → inspect locks/limits → manually transfer prompt and references to Seedance. START/END and timing fields are included when the editable profile supports them. **No direct Seedance API call or result import exists in v1.0.0.**

## MiniMax S2V-01 — manual subject-reference export

MiniMax uses its own adapter/profile, not Seedance syntax. The compiler selects the highest-priority subject reference, describes pose/expression/action/camera/light in text, inherits continuity locks, and exposes excluded references. The default S2V-01 profile has a single image-reference limit; multiple critical identities produce a blocking issue instead of silent removal. **No direct MiniMax API call, video settings submission, or result import exists.**

## Higgsfield — manual prompt/reference plan

Continuity Studio compiles a Higgsfield-oriented prompt with reference Elements, optional first/last frame support, camera, and motion guidance. The profile intentionally leaves numeric limits unset because Higgsfield exposes multiple models; users must edit the profile for the model they select. **Reference upload to Higgsfield, direct generation, and result import are unavailable in v1.0.0.**

## KimiBrain

KimiBrain is part of the creator’s broader experimentation but is **not integrated** into this release. It is documented as a possible future provider only.

## Generic image APIs

`ImageGenerationProvider` defines provider ID/model, paid/free status, cost estimate, and `generate`. The working implementation is the local deterministic previsual PNG renderer. A direct cloud image adapter must be added, registered, tested, and documented.

## Generic video APIs

Canonical prompts, provider mappings, result records, and video provider boundaries exist. No direct generic video generation adapter is registered. Export the prompt/references manually.

## Local models

Enable an OpenAI-compatible local text server in Settings, enter the server URL and exact model name, then test the connection. The built-in deterministic planning engine remains available when the external local server is disabled.

## Reference workflow shared by all platforms

1. Permanent assets live in Continuity Studio.
2. Source images, sheet views, scenes, and storyboard frames remain versioned local records.
3. Canonical Prompt contains provider-independent film intent.
4. The selected profile ranks references and validates limits.
5. Temporary tags/upload positions are created for that request only.
6. Blocking identity conflicts must be resolved before generation/export.
