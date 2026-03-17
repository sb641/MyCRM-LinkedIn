# Phase 00 Plan: UX Baseline And Redesign Guardrails

Status: completed baseline

## Goal
Define the redesign contract before implementation so layout work stays aligned with operator workflows and does not drift into decorative UI changes.

## Why This Phase Exists
The Intercom-style redesign touches multiple CRM surfaces. Without a compact baseline document, implementation work will keep pulling the entire application structure into context and increase the chance of regressions or design drift.

## In Scope
- audit current shell, inbox, drafts, and accounts surfaces
- define target desktop layout patterns
- define density targets for typography, row heights, and panel spacing
- define critical workflows that must remain stable during redesign
- define the visual and behavioral guardrails for later phases

## Out Of Scope
- production UI implementation
- backend contract changes
- business-rule changes
- route rewrites beyond what is needed for documentation clarity

## Target UX Outcome
- redesign goals are explicit and testable
- shell, inbox, drafts, and accounts target structures are documented
- critical workflows are frozen before visual changes continue
- later phases can be executed with narrow context windows

## Key Constraints To Carry Forward
- no full rewrite
- reuse existing backend, APIs, worker, and tested flows wherever possible
- preserve current business rules
- manual approval remains required for every outgoing message
- Delete and Ignore remain soft-delete plus suppression plus restore
- desktop-first UX
- one LinkedIn account per workspace
- future compatibility with Vercel plus Postgres-like deployment

## Deliverables
- master redesign brief
- inventory of current UI pain points
- target desktop wireframe descriptions for Inbox, Drafts, and Accounts
- density and typography direction
- regression-critical workflow list

## Critical Workflows Frozen In This Phase
- route navigation
- inbox load and selection
- conversation preview
- draft generation
- bulk draft generation
- queue send
- settings save
- backup export
- workspace restore confirmation guard
- ignore forever
- restore ignored person
- assign contact to account
- merge accounts

## Implementation Checklist
- [x] document redesign goals and constraints
- [x] document target shell structure
- [x] document target workspace structures
- [x] document density and typography direction
- [x] document regression-critical workflows
- [x] define phase exit gates

## Acceptance Criteria
- redesign goals are explicit and testable
- target shell structure is documented
- critical workflows are listed and prioritized
- typography and spacing direction is documented before code changes begin

## Validation
Manual review only:
- verify the redesign brief covers Inbox, Drafts, Accounts, Settings, and shared shell behavior
- verify the critical workflow list includes queue selection, preview, draft generation, send queueing, ignore and restore, account assignment, and account merge
- verify collapse behavior and density goals are explicitly documented

## Exit Gate
Phase 01 must not proceed as new implementation work unless the shell target and regression-critical workflows remain documented and current.

## Dependencies For Later Phases
Every later phase inherits this phase as its design and regression contract.