# Test Plan

Phase 0 coverage focuses on engineering guardrails.

## Automated

- lint
- typecheck
- unit tests for env validation and logger output
- smoke tests for app shell and worker bootstrap

## Manual

- start web app locally
- start worker locally
- verify `/api/health` returns OK
- verify feature flags render in settings panel
