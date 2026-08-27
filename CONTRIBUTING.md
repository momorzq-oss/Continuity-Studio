# Contributing

Thank you for helping improve Continuity Studio.

1. Fork `momorzq-oss/Continuity-Studio`.
2. Create a focused branch: `git checkout -b feature/short-name`.
3. Install with `npm run setup -- --lang en`.
4. Follow existing TypeScript types, persistent schemas, and provider-independent boundaries.
5. Add or update tests for changed behavior.
6. Run `npm run typecheck`, `npm test`, and `npm run build`.
7. Open a pull request explaining behavior, migration impact, and verification.

Never commit secrets, `.env`, personal references, local projects, generated private media, logs, or provider credentials. Do not replace permanent asset IDs with platform tags, bypass continuity gates, silently discard critical references, or claim a provider integration without working code and tests.

Provider additions should follow [Provider Development](docs/PROVIDER_DEVELOPMENT.md). By contributing, you agree that your contribution is licensed under Apache-2.0.
