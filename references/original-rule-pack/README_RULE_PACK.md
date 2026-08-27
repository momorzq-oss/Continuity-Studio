# Continuity Studio Film Brain Rule Pack

This pack turns the established Burabeeh filmmaking workflow into repository rules Codex can implement.

## Copy Into Your Project

Copy the contents of this pack into the root of Continuity Studio.

The target structure should look like:

```text
Continuity Studio/
├─ AGENTS.md
├─ film_rules/
│  ├─ BURABEEH_FILM_ENGINE.md
│  ├─ CONTINUITY_RULES.md
│  ├─ ASSET_RULES.md
│  ├─ SEQUENCE_RULES.md
│  └─ FRAME_RULES.md
├─ model_rules/
│  ├─ SEEDANCE_2_5.md
│  └─ MINIMAX_H3.md
├─ templates/
│  ├─ SEEDANCE_SEQUENCE_TEMPLATE.md
│  └─ MINIMAX_H3_TEMPLATE.md
└─ docs/
   └─ CODEX_INTEGRATION_PROMPT.md
```

## Then

Open Codex in the Continuity Studio repository.

Tell Codex:

`Read AGENTS.md and then execute docs/CODEX_INTEGRATION_PROMPT.md. Inspect the existing application first. Integrate the film rules into the real pipeline. Do not rebuild working parts from scratch.`

## Important

The MiniMax H3 adapter in this pack defines Continuity Studio's production behaviour and prompt contract.

It intentionally does not invent undocumented provider API parameters.

Connection-specific settings should be added when the actual provider or local server is connected.

