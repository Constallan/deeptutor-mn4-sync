# Repository Guidelines

## Project Structure & Module Organization

This repository contains a dependency-free MarginNote add-on. `main.js` is the ES5 runtime entry point and is organized into labeled sections for utilities, networking, dialogs, synchronization, timers, configuration, and add-on lifecycle hooks. `mnaddon.json` defines package metadata, while `logo_44x44.png` is the toolbar asset. Keep executable checks in `tests/`, design and attribution notes in `docs/`, and release-ready `.mnaddon` archives in `dist/`. Consult `docs/ARCHITECTURE.md` before changing synchronization or bridge behavior.

## Build, Test, and Development Commands

No dependency installation or bundler is required. Run checks from the repository root:

```bash
node --check main.js
node tests/syntax-check.js
tests/sensitive-scan.sh
```

The first two commands parse `main.js` without executing MarginNote APIs. The final command scans tracked text for credentials, private paths, and other sensitive data. For a release, package `main.js`, `mnaddon.json`, and `logo_44x44.png` at the archive root, give the ZIP a `.mnaddon` extension, and verify it manually in a supported MarginNote installation.

## Coding Style & Naming Conventions

Preserve ES5 compatibility with MarginNote's JSCore environment: use `var`, function expressions, and existing native bridge APIs; do not introduce imports or external libraries. Follow the current two-space indentation and semicolon-free style. Use `camelCase` for functions and variables, `UPPER_SNAKE_CASE` for constants, and leading underscores for instance state such as `_syncing`. Keep bridge-specific error handling explicit and retain the labeled section separators in `main.js`. Use two-space indentation in JSON.

## Testing Guidelines

There is no coverage target or full unit-test framework. Every change must pass all three local checks above. Name new Node checks `tests/<area>-check.js` and shell scans `tests/<area>-scan.sh`. Runtime or networking changes also require manual validation in MarginNote; record the tested MarginNote and DeepTutor versions in the pull request.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commit-style subjects such as `feat:`, `docs:`, and `chore:`. Keep subjects imperative, concise, and scoped to one logical change. Pull requests should explain behavior and compatibility impact, link related issues, list automated and manual verification, and include screenshots for configuration or toolbar changes. When metadata changes, update `mnaddon.json`, relevant documentation, and the committed release archive together.
