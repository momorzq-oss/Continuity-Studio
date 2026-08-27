# Continuity Studio architecture

## Runtime shape

```text
Electron desktop shell
  └─ Express + Vite production server (in-process, localhost only)
      └─ React production workspace
          └─ ProductionAgent / phase controller
              └─ BrainRouter
                  ├─ Built-in offline provider
                  ├─ OpenAI-compatible local provider
                  ├─ Codex App Server provider
                  └─ Existing OpenAI API provider
                      └─ Shared eight-phase production pipeline
                          ├─ ReferenceManager / protected source library
                          ├─ AssetMaker / image jobs / dependency graph
                          ├─ PlatformPromptCompiler / ReferenceTaggingEngine
                          └─ Markdown, JSON, generated PNG media, ZIP export
```

The transformation keeps the existing pipeline as the single source of truth. Brain providers implement the same `BrainProvider` contract and feed the existing `PhaseEngine`; no provider owns a duplicate production pipeline.

## Desktop lifecycle

`desktop/main.ts` owns the Windows window and backend lifecycle. It:

1. Acquires an Electron single-instance lock.
2. Shows `desktop/loading.html`.
3. Starts the backend in the Electron process on `127.0.0.1:8787`.
4. Falls back to an OS-selected port only for `EADDRINUSE`.
5. Loads the local UI in the app window.
6. Saves bounded window position, size, and maximized state.
7. Closes active generation, Codex App Server, and the HTTP listener before quitting.

Renderer isolation is enabled (`contextIsolation`, sandbox, no Node integration). Untrusted navigation is blocked. ChatGPT authentication opens only approved `chatgpt.com` or `auth.openai.com` pages in a separate isolated Electron window.

## Brain Router

`server/brains/router.ts` is the only selection boundary. Providers expose:

- `generate`
- `continue`
- `inspect`
- `plan`
- `execute`
- `healthCheck`
- `cancel`

Local selection uses the configured OpenAI-compatible provider when enabled and the existing built-in engine otherwise. This fallback is explicit configuration, not a hidden response to failure. If an enabled provider fails, the pipeline stops, saves state, and shows recovery actions.

Hybrid phase routing lives only in `server/brains/routing-policy.ts`. The balanced policy uses Codex for film-bible supervision, sequence architecture, and continuity; repeatable production artifacts use Local. `local_first` and `codex_first` are alternative editable policies.

## Supervised film agents

`server/agents/definitions.ts` defines Story, Film Bible, Character, Creature, Location, Prop, Asset, Sequence, Frame Planning, Prompt, Continuity, Inspection, Video, Audio, Editing, and Export agents. Each definition records its responsibility, allowed context, expected input, and expected output. The `ProductionAgent` remains the supervisor; specialist agents cannot run uncontrolled or bypass phase status, persistence, approval, regeneration, or logging.

## Project persistence and memory

`ProjectStore` retains `data/projects/<project-id>/` in development and uses `Documents\Continuity Studio\Projects\<project-id>` when installed. Writes are queued and atomic. Schema version 4 includes:

- selected brain and provider health;
- Codex thread/turn references and model;
- approved and locked assets;
- character, wardrobe, creature, location, and prop locks;
- sequence start/mid/end continuity state;
- generation, regeneration, and approval history;
- high-level Brain Activity and explicit recovery state.
- protected project references, analysis metadata, story requirements, lineage, and continuity sheets;
- image job records, real result/thumbnail paths, scenes, storyboards, and dependency edges;
- editable model profiles, canonical prompts, provider-reference mappings, exclusions, and blocking compiler issues.

Older projects migrate when opened. `project.json` is copied to a timestamped `project.json.backup-v<version>-<time>` before replacement.

## Continuity and frame planning

Sequence memory locks identity, face, age/body/hair, wardrobe/accessories, counts, creatures, location, props, time/lighting/weather/color, camera and screen direction, positions, damage/wounds, carried objects, vehicles, animals, and previous/current boundary states. The agent runs a continuity preflight before sequence-sensitive phases and records issues rather than discarding state.

Each sequence stores separate START, MID, and END frame objects containing description, cast/state, location, props, camera, lens, composition, lighting, movement, locks, prompt, and references. The previous END informs the next START through transition guidance; it is not copied mechanically.

## Visual generation and prompt compilation

`AssetMaker` owns the provider-neutral image queue. The built-in `LocalReferenceImageProvider` creates deterministic real PNG files without a network call or provider charge. External adapters implement the same interface; a paid adapter must receive explicit spend approval before execution. An asset is never treated as generated solely because a prompt or database row exists.

Scene assets depend on real asset/reference images and store master, START, MID, and END files. Storyboard frames are separate derivative entities. Every job, source, version, and dependency remains inspectable in project JSON.

`PlatformPromptCompiler` builds one canonical representation before provider formatting. `ReferenceTaggingEngine` assigns upload positions and provider tags from editable profiles while preserving stable internal IDs. When a limit would remove identity or another critical reference, the compiler returns a blocking issue and an explicit excluded-reference record.

## Tools and logs

`server/tools/providers.ts` defines replaceable text, image, video, audio, image-inspection, and video-inspection provider boundaries. Unconfigured future media services are not presented as working connections.

Structured JSONL logs are separated by category. Sensitive keys and credential-shaped values are redacted. Diagnostics returns versions, provider states, project directory, selected brain, platform, and recent errors—not raw RPC payloads or secrets.
