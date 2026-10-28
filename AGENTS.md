# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## Project Overview

Passport Reel is an app that visualizes the countries the user has visited in chronological order and renders it as a video.

## Project Structure

- `apps/web`: The frontend-only web app (Vite + React + TypeScript). The world map is drawn on Canvas with d3-geo. Build output is static files only (no server-side components).
  - `pnpm --filter ./apps/web build` builds it into `apps/web/dist`.
- When adding a workspace package, register it in `pnpm-workspace.yaml` and `vitest.config.ts` (`test.projects`), and update this section and `README.md`.

## Communication

- Write responses to the user, progress updates, and questions in Japanese.

## Developing Workflow and Strategy

- Keep implementations simple and make routine implementation decisions within the requested scope. Ask the user to decide when a choice changes the agreed specification, public contract, or scope of work.
- When adding or semantically changing any hand-maintained artifact, check nearby artifacts (implementation, tests, docs, public exports, fixtures) and decide for each whether to update, delete, or keep it with a reason.
- Changes that a command run for the task writes as a side effect (lockfiles, generated code, formatter output) belong to the task's changes. Keep them, report them, and ask the user before reverting any of them.
- Write Japanese comments for responsibilities, constraints, design reasons, or side effects that are not clear from the function's name, types, and implementation.
- Direct commits/pushes to the `main` branch are prohibited.

## Spec-Driven Development

- Specs and change proposals are managed with OpenSpec under `openspec/` (`specs/` for current behavior, `changes/` for proposed changes).
- Start feature work and behavior changes with an OpenSpec change (`/opsx:propose` in Claude Code, `$openspec-propose` in Codex), then implement with `openspec-apply-change` and finish with `openspec-archive-change`.
- Write OpenSpec artifacts in Japanese, keeping OpenSpec structural headings and SHALL/MUST keywords in English (configured in `openspec/config.yaml`).

## Investigation Policy

- When investigating and explaining problems caused by library version upgrades, always check the changelog/release notes and state your findings based on facts, rather than making assumptions.

## Lint Policy

- The completion condition for lint compliance is not "removing warnings/errors," but "fulfilling the intent of the rule."
- Modifications that cannot explain the intent of the rule (ad-hoc typing/mechanical substitution) are prohibited.
- User approval is always required when using rule suppression comments (disable).

## Issue Management

- Issues are managed in the repository `retore404/passport-reel`.
- Create issues with the `new-issue` skill and work on them with the `issue-driven` skill. Use the `gh-stack` skill when splitting work into stacked PRs.
- Do not add coding agent attribution lines (e.g. `Co-Authored-By: Claude`, `Generated with Claude Code`) to commit messages or PR bodies.

## Commands

**Use pnpm. npm/npx are prohibited.**
**DO NOT USE `tsc` command directly. Use `pnpm check` or `pnpm typecheck`.**
**DO NOT USE `pnpm dlx vitest` or `pnpm exec vitest` directly to run test. Use `pnpm test` or `pnpm check`.**
**DO NOT START DEV SERVER BY YOUR SELF. Ask user to start dev server. This is because to avoid port confliction.**

```bash
pnpm check   # lint + format:check + typecheck + knip + test
pnpm fix     # lint:fix + format
```
