# Security Policy

## Supported version

Security updates target the latest public release.

## Reporting a vulnerability

Use GitHub’s private vulnerability reporting feature on the repository’s **Security** tab when available. If private reporting is unavailable, open a minimal GitHub issue asking the maintainers for a private reporting channel; do not publish exploit details, tokens, credentials, private media, or personal data in a public issue.

Include the affected version, component, reproduction conditions, likely impact, and a safe proof of concept. Allow maintainers reasonable time to investigate before public disclosure.

## Local-data model

Projects, uploaded references, generated media, settings, and logs are stored locally. `.gitignore` excludes these paths from source control. Provider keys belong only in the ignored `.env` file or the provider’s own credential store. Codex authentication is handled by Codex; Continuity Studio does not request a ChatGPT password.
