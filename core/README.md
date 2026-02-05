# Core Module Architecture

This directory contains the core infrastructure modules for the Claude Code Discord Bot.
These modules follow a factory pattern approach for better testability and maintainability.

## Module Overview

| Module | Lines | Purpose |
|--------|-------|---------|
| `index.ts` | 109 | Barrel export for all core modules |
| `config-loader.ts` | 221 | Configuration loading and CLI argument parsing |
| `signal-handler.ts` | 213 | Cross-platform signal handling for graceful shutdown |
| `bot-factory.ts` | 416 | Factory for creating bot managers and contexts |
| `handler-registry.ts` | 429 | Registry for creating all command handlers |
| `button-handlers.ts` | 415 | Factory for Discord button interaction handlers |
| `command-wrappers.ts` | 524 | Wrapper factories for command handlers |
| `git-shell-handlers.ts` | 610 | Git and shell command handler factories |

## Architecture Principles

### 1. Factory Pattern
All handler creation uses factory functions that accept dependencies:

```typescript
const handlers = createAllHandlers(deps, claudeSession, settings);
const buttons = createButtonHandlers(deps, expandableContent);
const commands = createAllCommandHandlers(wrapperDeps);
```

### 2. Dependency Injection
Handlers receive their dependencies through typed interfaces:

```typescript
interface HandlerRegistryDeps {
  workDir: string;
  shellManager: ShellManager;
  crashHandler: ProcessCrashHandler;
  // ...
}
```

### 3. Separation of Concerns
- **config-loader**: Environment and CLI configuration only
- **signal-handler**: Shutdown coordination only
- **bot-factory**: Manager instantiation only
- **handler-registry**: Handler wiring only
- **button-handlers**: Button interaction logic only
- **command-wrappers**: Command execution wrappers only
- **git-shell-handlers**: Git/shell specific commands only

### 4. Testability
Factory functions can be tested in isolation:

```typescript
// Test example
const mockDeps = createMockDeps();
const handlers = createAllHandlers(mockDeps, mockSession, mockSettings);
expect(handlers.claude).toBeDefined();
```

## Usage

Import from the barrel export:

```typescript
import {
  createBotManagers,
  createAllHandlers,
  createButtonHandlers,
  createAllCommandHandlers,
  parseArgs,
  setupSignalHandlers,
} from "./core/index.ts";
```

## Module Dependencies

```
index.ts (main)
    └── core/
        ├── config-loader.ts
        ├── bot-factory.ts
        │   └── handler-registry.ts
        │       ├── button-handlers.ts
        │       └── command-wrappers.ts
        │           └── git-shell-handlers.ts
        └── signal-handler.ts
```

## Adding New Handlers

1. Create handler factory in appropriate module
2. Export from module's index
3. Add to `createAllHandlers` or `createAllCommandHandlers`
4. Register commands in `getAllCommands()`

## Migration Notes

Prior to refactoring, all handlers were defined inline in `index.ts` (1,724 lines).
The refactoring achieved a 78% reduction by extracting handlers to dedicated modules.
