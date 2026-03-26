# Contributing

## Sanitization Policy

This repository enforces a strict sanitization policy to remove all references to:
- Copilot / github-copilot
- Gemini
- OpenAI
- Claude
- ChatGPT
- Antigravity
- AI

**Automatic Enforcement:** Git hooks will automatically prevent commits and pushes containing these terms.

### Setup

After cloning, enable the git hooks:

```bash
git config core.hooksPath .githooks
```

### What Happens

- **Pre-commit hook:** Blocks commits containing prohibited terms in code
- **Pre-push hook:** Blocks pushes containing prohibited terms

If a hook blocks your changes:
1. Remove the prohibited terms from your code
2. Re-stage and commit/push

### Hook Details

Hooks are stored in `.githooks/` and configured via `core.hooksPath`. They automatically exclude themselves from scanning to allow the enforcement mechanism to exist.

---

For other contribution guidelines, see the main README.
