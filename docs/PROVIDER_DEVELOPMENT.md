# Adding a Provider

Continuity Studio separates filmmaking state from provider syntax. A new model should not require changes to Story, Film Bible, assets, scenes, or continuity.

1. Add an editable `ModelProfile` default with verified capabilities; do not invent unknown limits.
2. For text phase generation, implement the shared brain/phase provider interface and register it in `BrainRouter`.
3. For images, implement `ImageGenerationProvider`: ID/model, paid flag, cost estimate, and generation result.
4. For prompt-only video workflows, add a compiler rendering branch or dedicated adapter from `CanonicalPrompt`.
5. Define role priority, reference handling, tag template/upload mapping, START/END support, durations, and limits.
6. Preserve stable asset IDs in storage. Put provider IDs/tags only in `ProviderReferenceMapping`.
7. Return explicit exclusions and BLOCKING issues when critical references cannot fit.
8. Require explicit spend approval before any paid job.
9. Register the provider in runtime/settings/UI only when health checks and operations work.
10. Add unit, integration, failure, limit, and migration tests.
11. Update `PLATFORMS.md` with exact setup, reference workflow, limitations, and whether support is direct or manual.

Never label a manual export as a direct API integration.
