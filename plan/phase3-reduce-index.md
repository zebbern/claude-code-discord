# Phase 3: Continue Reducing index.ts

## Current Status

- index.ts: 382 lines ✅ (down from 1,724)
- Target: Under 1,200 lines ✅ (EXCEEDED - achieved 78% reduction!)

## Analysis Summary

### Major Code Sections in index.ts

| Section | Lines | Location |
|---------|-------|----------|
| Imports and exports | ~35 | 1-35 |
| createClaudeCodeBot setup | ~120 | 36-155 |
| Command handlers map | ~990 | 158-1146 |
| Button handlers map | ~380 | 1147-1525 |
| Bot creation & sender | ~80 | 1556-1635 |
| Signal handlers (inline) | ~60 | 1637-1696 |
| Main execution | ~30 | 1698-1724 |

### Issues Found

1. **Duplicate handler creation** - index.ts creates handlers manually but handler-registry.ts has `createAllHandlers()` already
2. **Button handlers inline** - ~380 lines of button handler code should be extracted
3. **Command handler registration** - ~990 lines of handler wrapping code should use factory pattern
4. **Inline signal handling** - Already exists in signal-handler.ts but not used

## Tasks

- [x] Task 1: Create core/button-handlers.ts to extract button handler logic
- [x] Task 2: Create core/command-wrappers.ts to extract command handler mapping
- [x] Task 3: Create core/git-shell-handlers.ts to extract git/shell commands
- [x] Task 4: Refactor index.ts to use the new modules
- [x] Task 5: Verify with deno check

## Final Results

### Line Count Reduction

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| index.ts | 1,724 | 382 | -1,342 (78%) |

### New Core Modules Created

- `core/button-handlers.ts` - Button interaction handlers
- `core/command-wrappers.ts` - Command handler factories  
- `core/git-shell-handlers.ts` - Git and shell command handlers

### Benefits

1. **Maintainability**: Logic is now organized by domain
2. **Testability**: Individual handler modules can be tested in isolation
3. **Readability**: index.ts is now a clear orchestration file
4. **Reusability**: Handler factories can be used elsewhere
