# artifexai

ArtifexAI is a lightweight agentic system that automates cybersecurity due diligence for mergers and acquisitions by running curated hunt templates against a SIEM and generating evidence-backed audit reports. It delivers fast, repeatable risk assessments with minimal human intervention.

Minimal monorepo scaffold for a fast MVP demo.

## Requirements
- Node >= 18
- pnpm (recommended)

## Quick start
```bash
pnpm install
pnpm --filter api dev
```

## Run apps
- API: `pnpm --filter api dev`
- Web (placeholder): `pnpm --filter web dev`

## Env
Copy `.env.example` to `.env` at the repo root.

## Notes
- The web app directory is a placeholder. Drop your existing React app into `apps/web`.
- Backend endpoints are intentionally minimal with TODOs for future work.
