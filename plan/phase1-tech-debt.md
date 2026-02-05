# Phase 1: Critical Tech Debt Fixes

## Objective

Fix critical code quality issues to establish a solid foundation for future development.

## Tasks

- [x] Task 1: Extract `killProcessCrossPlatform` to util/process.ts (deduplicate)
- [x] Task 2: Remove duplicate handlers from system/index.ts  
- [x] Task 3: Fix duplicate export in util/index.ts
- [x] Task 4: Pin @anthropic-ai/claude-code version in deno.json
- [x] Task 5: Consolidate BotSettings interface to single source of truth
- [x] Task 6: Create shared types file (types/shared.ts)
- [x] Task 7: Update all imports to use new consolidated modules

## Status: ✅ COMPLETED

## Results

- Created util/process.ts with consolidated killProcessCrossPlatform
- Removed ~475 lines of duplicate code from system/commands.ts
- Pinned claude-code SDK to version 1.0.95
- Created types/shared.ts with BotSettings interface
- All imports verified correct
- Deno not installed - TypeScript check pending
