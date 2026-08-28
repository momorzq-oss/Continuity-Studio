# Platforms and Provider Profiles

Continuity Studio By BURABEEH separates permanent production truth from temporary provider syntax. v1.1.0 includes eight versioned video Platform Profiles, but video generation remains a manual handoff.

## Shared architecture

1. Stable IDs and project image numbers live in Continuity Studio.
2. Sequence Workspace builds one canonical Prompt State.
3. Normal and JSON prompts render from that state.
4. The selected Platform Profile supplies verified duration, reference, audio, syntax, and formatting capabilities.
5. Reference Tagging maps stable IDs to temporary provider slots such as `@Image 1`.
6. Validation exposes unsupported or excluded references; critical identity references are not silently discarded.
7. The user copies the prompt and uploads the numbered package in the provider's own product.

Provider behavior is versioned inside the profile. Do not hard-code one Seedance, MiniMax, or other model's limits into global Movie DNA or shared prompt logic.

## Video Platform Profiles

| Profile | Reference presentation | v1.1.0 boundary |
| --- | --- | --- |
| Seedance | Numbered `@Image` mapping and structured timing/reference instructions | Manual prompt/reference handoff |
| Higgsfield | Named Elements and model-specific camera/motion guidance | Manual prompt/reference handoff |
| MiniMax | Image/subject-reference mapping and concise motion-first direction | Manual prompt/reference handoff |
| Veo | Reference-image mapping and structured cinematic context | Manual prompt/reference handoff |
| Kling | Numbered images and platform-specific formatting | Manual prompt/reference handoff |
| Runway | Image Guidance slots and motion/camera formatting | Manual prompt/reference handoff |
| Sora | Attached-image mapping and platform-specific formatting | Manual prompt/reference handoff |
| Custom | User-editable limits, syntax, audio support, and instructions | Manual handoff based on user configuration |

The shipped defaults are editable and versioned. Users must verify provider capabilities for the exact model/version available to their account before changing a profile.

## Text and planning providers

### Built-in local engine

Provides the default offline structured planning pipeline and deterministic PNG previsual renderer. It requires no credential and no external database.

### Codex

Provides optional supervised production work through Codex App Server. Connect through Brain Settings using the supported sign-in flow. Codex supervision does not turn a manual video Platform Profile into a direct video API.

### OpenAI API

Provides optional text-phase generation through the OpenAI Responses API when `OPENAI_API_KEY` is configured. v1.1.0 does not use this connection for direct final video generation.

### OpenAI-compatible local models

Provide optional text generation through a user-configured local server. Enter the server URL and exact model in Brain Settings. The built-in engine remains available when this optional server is disabled.

## Image generation boundary

The provider-neutral image job interface stores provider/model, prompts, source paths, dimensions, cost estimate, spend approval, attempt, status, result, thumbnail, and error. The working no-cost implementation creates deterministic PNG previsual references. A direct cloud image adapter must be registered and tested before documentation can describe it as supported.

## Video generation boundary

No direct Seedance, Higgsfield, MiniMax, Veo, Kling, Runway, Sora, or generic video adapter is registered in the current source build. Provider results can be imported and reviewed manually with preserved attempt metadata. Automated visual inspection of video pixels remains roadmap work.

Provider names identify compatible prompt formats only. They do not imply sponsorship, endorsement, ownership, or an official partnership.
