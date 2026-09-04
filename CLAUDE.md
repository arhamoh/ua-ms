# Project memory

## Workflow
- **Commit and push everything directly to `main`.** No feature branches, no PRs
  unless explicitly asked. `main` auto-deploys to Railway (native GitHub
  integration) on every push, so each commit to `main` goes live to production.

## Docs
- **`FEATURES.md` is the living feature + pitch doc.** When you add or change a
  user-facing feature, update `FEATURES.md` in the same change (module list,
  comparison table, and/or roadmap), and bump its "Last updated" date.
