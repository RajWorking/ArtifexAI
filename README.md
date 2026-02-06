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

## SIEM MCP (Splunk)
Point the API to your local Splunk MCP server by providing a command path in the request body or setting `SPLUNK_MCP_COMMAND` in `.env`.

Sample connect:
```bash
curl -s http://localhost:4000/api/siem/connect \\
  -H 'Content-Type: application/json' \\
  -d '{
    "siemType": "splunk",
    "transport": "stdio",
    "command": "splunk-mcp-server",
    "env": {
      "SPLUNK_HOST": "https://localhost:8089",
      "SPLUNK_TOKEN": "YOUR_TOKEN",
      "SPLUNK_VERIFY_SSL": "false"
    },
    "timeoutMs": 10000
  }'
```

Sample query:
```bash
curl -s http://localhost:4000/api/siem/query \\
  -H 'Content-Type: application/json' \\
  -d '{
    "transport": "stdio",
    "command": "splunk-mcp-server",
    "spl": "search index=_internal | head 5",
    "timeoutMs": 20000
  }'
```

Security note: tokens are never logged and remain backend-only.

## Notes
- The web app directory is a placeholder. Drop your existing React app into `apps/web`.
- Backend endpoints are intentionally minimal with TODOs for future work.
