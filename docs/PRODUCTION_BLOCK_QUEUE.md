# Continuity Studio production block queue

The approved implementation order is fixed as follows:

1. **Sequence Workspace v3 and Final Prompt Pipeline** — implemented and verified for v1.1.0. Includes the integrated filmmaking knowledge source and optional Storyboard Grid support.
2. **Generated Video Import and Generation History** — next queued block.
3. **Video Continuity Inspection and Targeted Regeneration** — queued.
4. **Sequence Approval and Automatic Continuity Transfer** — queued; rejected attempts must never update permanent continuity.
5. **Production Dashboard** — queued.
6. **Final Project Export** — queued.
7. **Full End-to-End Movie Verification** — final queued block using a completely fresh movie.

The queue preserves Full and Phases modes, local project storage, Markdown and JSON records, approval gates, downstream invalidation, and ZIP export.
