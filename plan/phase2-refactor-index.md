# Phase 2: index.ts Decomposition Analysis

**File:** `index.ts` (1,828 lines → ~1,800 lines after integration)  
**Date:** 2026-02-05  
**Goal:** Break down the monolithic index.ts into focused, maintainable modules
**Status:** 🚧 In Progress - Integration Started

---

## Implementation Progress

### ✅ Created Core Modules
- [x] `core/config-loader.ts` - Configuration & CLI parsing (232 lines)
- [x] `core/signal-handler.ts` - Signal handling (169 lines)
- [x] `core/bot-factory.ts` - Manager creation (~350 lines)
- [x] `core/handler-registry.ts` - State & handler factories (~350 lines)
- [x] `core/index.ts` - Barrel exports

### 🚧 Integration into index.ts
- [x] Step 1: Replace `parseArgs` with import from core/config-loader
- [x] Step 2: Replace message history with `createMessageHistory()` from handler-registry
- [ ] Step 3: Replace manager creation with bot-factory
- [ ] Step 4: Replace settings with `createBotSettings()` from handler-registry
- [ ] Step 5: Full verification with bot test

---

## Current Problems

- ~1,760 lines in main file (reduced from 1,828)
- Multiple responsibilities mixed together
- Hard to test individual components
- Difficult to navigate and understand
- High risk of merge conflicts

## Target Architecture

```
core/
├── main.ts           # Entry point (~80 lines)
├── bot-factory.ts    # Bot creation & initialization (~250 lines)
├── handler-registry.ts # Command/handler registration (~1400 lines)
├── config-loader.ts  # Environment & config handling (~80 lines)
├── signal-handler.ts # Graceful shutdown & signals (~100 lines)
└── index.ts          # Barrel export (optional)
```

---

## 1. Section Breakdown

### Section A: Imports (Lines 1-35)
```
Line Range: 1-35
Description: All external and internal module imports
Dependencies: 
  - discord/index.ts
  - shell/index.ts
  - git/index.ts
  - claude/index.ts, claude/additional-index.ts
  - settings/index.ts
  - system/index.ts
  - help/index.ts
  - agent/index.ts
  - process/index.ts
  - util/index.ts
Proposed Destination: Will be distributed across new modules
```

### Section B: Argument Parser (Lines 37-67)
```
Line Range: 37-67
Description: parseArgs() function for CLI argument parsing
Dependencies: None (pure function)
Proposed Destination: config-loader.ts
Risk: LOW - Standalone function, easy extraction
```

### Section C: Backward Compatibility Exports (Lines 69-71)
```
Line Range: 69-71
Description: Re-exports for backward compatibility
Dependencies: git/index.ts, claude/index.ts
Proposed Destination: Keep in main.ts (or separate compat.ts)
Risk: LOW
```

### Section D: Main Bot Factory Function (Lines 73-1743)
**This is the LARGEST section and needs sub-breakdown:**

#### D1: Function Signature & Config Extraction (Lines 73-78)
```
Line Range: 73-78
Description: createClaudeCodeBot signature and config destructuring
Proposed Destination: bot-factory.ts
```

#### D2: State Initialization (Lines 79-108)
```
Line Range: 79-108
Description: Initialize internal state:
  - claudeController (AbortController)
  - claudeSessionId
  - messageHistory array
  - history navigation helpers (addToHistory, getPreviousMessage, getNextMessage)
Dependencies: None
Proposed Destination: bot-factory.ts (or session/history-manager.ts)
Risk: MEDIUM - State is captured in closure, needs careful refactoring
```

#### D3: Manager/Handler Instantiation (Lines 110-173)
```
Line Range: 110-173
Description: Creates infrastructure objects:
  - ShellManager
  - WorktreeBotManager
  - ProcessCrashHandler
  - ProcessHealthMonitor
  - ClaudeSessionManager
  - Periodic cleanup interval setup
  - Settings initialization (unifiedSettings, advancedSettings, botSettings)
  - updateUnifiedSettings, updateAdvancedSettings functions
Dependencies: 
  - shell/index.ts (ShellManager)
  - git/index.ts (WorktreeBotManager)
  - process/index.ts (ProcessCrashHandler, ProcessHealthMonitor)
  - claude/index.ts (ClaudeSessionManager)
  - settings/index.ts (DEFAULT_SETTINGS, UNIFIED_DEFAULT_SETTINGS)
Proposed Destination: bot-factory.ts (initialization section)
Risk: MEDIUM - Multiple interconnected objects
```

#### D4: Handler Creation (Lines 175-277)
```
Line Range: 175-277
Description: Creates all command handlers:
  - claudeHandlers
  - gitHandlers
  - shellHandlers
  - utilsHandlers
  - helpHandlers
  - enhancedClaudeHandlers
  - systemHandlers
  - additionalClaudeHandlers
  - advancedSettingsHandlers
  - unifiedSettingsHandlers
  - agentHandlers
Dependencies: All handler factory functions from respective modules
Proposed Destination: handler-registry.ts
Risk: MEDIUM - Many dependencies, but straightforward pattern
```

#### D5: Command Handlers Map (Lines 279-971)
```
Line Range: 279-971 (~690 lines!)
Description: The massive `handlers: CommandHandlers` Map with all command implementations:
  - 'claude' (279-361) - with button handler
  - 'continue' (361-369)
  - 'claude-cancel' (369-385)
  - 'git' (385-407)
  - 'worktree' (407-505)
  - 'worktree-list' (533-554)
  - 'worktree-remove' (554-583)
  - 'worktree-bots' (583-610)
  - 'worktree-kill' (610-642)
  - 'shell' (642-746)
  - 'shell-input' (746-843)
  - 'shell-list' (843-867)
  - 'shell-kill' (867-897)
  - 'status' (897-921)
  - 'pwd' (921-939)
  - 'shutdown' (939-972)
  - 'help' (972-978)
  - 'claude-enhanced' (978-1006)
  - 'claude-models' (1006-1011)
  - 'claude-sessions' (1011-1018)
  - 'claude-context' (1018-1028)
  - 'system-info' (1028-1042)
  - 'processes' (1042-1055)
  - 'system-resources' (1055-1068)
  - 'network-info' (1068-1081)
  - 'disk-usage' (1081-1094)
  - 'env-vars' (1094-1107)
  - 'system-logs' (1107-1121)
  - 'port-scan' (1121-1135)
  - 'service-status' (1135-1148)
  - 'uptime' (1148-1161)
  - 'claude-explain' (1161-1168)
  - 'claude-debug' (1168-1176)
  - 'claude-optimize' (1176-1183)
  - 'claude-review' (1183-1192)
  - 'claude-generate' (1192-1199)
  - 'claude-refactor' (1199-1207)
  - 'claude-learn' (1207-1215)
  - 'claude-settings' (1215-1222)
  - 'settings' (1222-1230)
  - 'todos' (1230-1239)
  - 'mcp' (1239-1247)
  - 'agent' (1247-1258)
  - 'output-settings' (1258-1264)
  - 'quick-model' (1264-1270)
Proposed Destination: handler-registry.ts
Risk: HIGH - Very large, many closures over local state
```

#### D6: Dependencies Object (Lines 971-999)
```
Line Range: 971-999
Description: BotDependencies object combining all commands
Proposed Destination: handler-registry.ts
```

#### D7: Button Handlers Map (Lines 999-1617)
```
Line Range: 999-1617 (~620 lines!)
Description: buttonHandlers: ButtonHandlers Map:
  - 'cancel-claude'
  - 'copy-session'
  - 'jump-previous'
  - 'continue'
  - 'history-previous'
  - 'history-next'
  - 'history-use'
  - 'history-close'
  - 'collapse-content'
  - 'workflow:git-status'
Proposed Destination: handler-registry.ts (button-handlers section)
Risk: HIGH - Heavy closure usage over messageHistory state
```

#### D8: Bot Creation & Discord Sender (Lines 1617-1696)
```
Line Range: 1617-1696
Description: 
  - Creates Discord bot instance
  - Creates DiscordSender implementation
  - Creates claudeSender
Dependencies: discord.js, discord/index.ts
Proposed Destination: bot-factory.ts
Risk: MEDIUM - Discord.js dynamic import
```

#### D9: Signal Handlers (Lines 1696-1752)
```
Line Range: 1696-1752
Description: OS signal handling (SIGINT, SIGTERM, SIGBREAK)
  - handleSignal async function
  - Platform-specific signal registration
Dependencies: Deno APIs
Proposed Destination: signal-handler.ts
Risk: LOW - Self-contained with clear interface
```

### Section E: Main Entry Point (Lines 1753-1828)
```
Line Range: 1753-1828
Description: 
  - Environment variable loading
  - CLI argument parsing
  - Git info retrieval
  - Bot creation and start
Proposed Destination: main.ts
Risk: LOW - Clear entry point logic
```

---

## 2. Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                         main.ts                                  │
│  (Entry point, env loading, CLI parsing, bot creation)           │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      config-loader.ts                            │
│  - parseArgs()                                                   │
│  - loadEnvironmentConfig()                                       │
│  - BotConfiguration type                                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                       bot-factory.ts                             │
│  - createClaudeCodeBot()                                         │
│  - Creates managers (ShellManager, WorktreeBotManager, etc.)     │
│  - Initializes settings                                          │
│  - Sets up cleanup intervals                                     │
└───────────┬─────────────┬────────────────────────┬──────────────┘
            │             │                        │
            ▼             ▼                        ▼
┌───────────────┐  ┌─────────────────┐  ┌──────────────────┐
│ handler-      │  │ signal-         │  │ discord/         │
│ registry.ts   │  │ handler.ts      │  │ index.ts         │
│               │  │                 │  │ (createBot)      │
│ - Command     │  │ - handleSignal  │  └──────────────────┘
│   handlers    │  │ - registerAll   │
│ - Button      │  │ - cleanup()     │
│   handlers    │  │                 │
│ - Dependencies│  │                 │
└───────────────┘  └─────────────────┘

Internal Dependencies:
├── handler-registry.ts
│   ├── claude/index.ts (claudeHandlers)
│   ├── claude/additional-index.ts (additionalClaudeHandlers)
│   ├── git/index.ts (gitHandlers)
│   ├── shell/index.ts (shellHandlers)
│   ├── util/index.ts (utilsHandlers)
│   ├── system/index.ts (systemHandlers)
│   ├── settings/index.ts (settingsHandlers)
│   ├── help/index.ts (helpHandlers)
│   └── agent/index.ts (agentHandlers)
│
├── bot-factory.ts
│   ├── shell/index.ts (ShellManager)
│   ├── git/index.ts (WorktreeBotManager)
│   ├── process/index.ts (CrashHandler, HealthMonitor)
│   ├── claude/index.ts (ClaudeSessionManager)
│   ├── settings/index.ts (DEFAULT_SETTINGS)
│   └── discord/index.ts (formatting utilities)
│
└── signal-handler.ts
    └── (No external dependencies, uses Deno APIs)
```

---

## 3. Extraction Order (Dependency-Based)

### Phase 2A: Foundation Modules (No dependencies on other new modules)

1. **config-loader.ts** - FIRST
   - Extract `parseArgs()` function
   - Add `loadEnvironmentConfig()` function
   - Define `BotConfiguration` interface
   - **Lines to extract:** 37-67, part of 1753-1780
   - **Risk:** LOW

2. **signal-handler.ts** - SECOND  
   - Extract signal handling logic
   - Create `SignalHandler` class or functions
   - **Lines to extract:** 1696-1752
   - **Risk:** LOW

### Phase 2B: State & Handler Management

3. **handler-registry.ts** - THIRD
   - This is the largest extraction (~1300 lines)
   - Extract command handlers creation (D4)
   - Extract command handlers Map (D5)
   - Extract button handlers Map (D7)
   - Export factory function that takes dependencies and returns handlers
   - **Lines to extract:** 175-277, 279-971, 999-1617
   - **Risk:** HIGH - Complex closures, needs careful state management

### Phase 2C: Bot Assembly

4. **bot-factory.ts** - FOURTH
   - Depends on config-loader, signal-handler, handler-registry
   - Manager instantiation logic
   - Settings initialization
   - Bot assembly and sender creation
   - **Lines to extract:** 73-173, 1617-1696
   - **Risk:** MEDIUM

5. **main.ts** - LAST
   - Entry point only
   - Uses config-loader and bot-factory
   - **Lines to keep:** 1753-1828
   - **Risk:** LOW

---

## 4. Proposed Module Contents

### 4.1 config-loader.ts (~80 lines)
```typescript
// Types
export interface BotConfiguration {
  discordToken: string;
  applicationId: string;
  workDir: string;
  repoName: string;
  branchName: string;
  categoryName?: string;
  defaultMentionUserId?: string;
}

export interface ParsedArgs {
  category?: string;
  userId?: string;
}

// Functions
export function parseArgs(args: string[]): ParsedArgs { ... }

export function loadEnvironmentConfig(): Partial<BotConfiguration> { ... }

export function validateConfig(config: Partial<BotConfiguration>): config is BotConfiguration { ... }
```

### 4.2 signal-handler.ts (~100 lines)
```typescript
export interface SignalHandlerDependencies {
  shellHandlers: { killAllProcesses: () => void };
  gitHandlers: { killAllWorktreeBots: () => void };
  claudeController: AbortController | null;
  claudeSender: ((messages: ClaudeMessage[]) => Promise<void>) | null;
  botClient: { destroy: () => void };
  categoryName: string;
  repoName: string;
  branchName: string;
}

export function createSignalHandler(deps: SignalHandlerDependencies) {
  const handleSignal = async (signal: string) => { ... };
  
  return {
    register: () => { ... },
    cleanup: () => { ... }
  };
}
```

### 4.3 handler-registry.ts (~1400 lines - still large but focused)
```typescript
export interface HandlerDependencies {
  // State
  workDir: string;
  actualCategoryName: string;
  discordToken: string;
  applicationId: string;
  repoName: string;
  branchName: string;
  
  // Managers
  shellManager: ShellManager;
  worktreeBotManager: WorktreeBotManager;
  crashHandler: ProcessCrashHandler;
  claudeSessionManager: ClaudeSessionManager;
  
  // Settings
  botSettings: BotSettings;
  advancedSettings: AdvancedBotSettings;
  unifiedSettings: UnifiedBotSettings;
  
  // Callbacks
  updateBotSettings: (settings: Partial<BotSettings>) => void;
  updateAdvancedSettings: (settings: Partial<AdvancedBotSettings>) => void;
  updateUnifiedSettings: (settings: Partial<UnifiedBotSettings>) => void;
  getClaudeSender: () => ((messages: ClaudeMessage[]) => Promise<void>) | null;
  setClaudeController: (controller: AbortController | null) => void;
  getClaudeController: () => AbortController | null;
  
  // History (for button handlers)
  addToHistory: (message: string) => void;
  getPreviousMessage: () => string | null;
  getNextMessage: () => string | null;
  getCurrentHistoryIndex: () => number;
  getMessageHistory: () => string[];
}

export function createAllHandlers(deps: HandlerDependencies) {
  // Create individual handler groups
  const claudeHandlers = createClaudeHandlers(...);
  const gitHandlers = createGitHandlers(...);
  // ...etc
  
  return { claudeHandlers, gitHandlers, ... };
}

export function createCommandHandlersMap(
  handlers: ReturnType<typeof createAllHandlers>,
  deps: HandlerDependencies
): CommandHandlers { ... }

export function createButtonHandlersMap(
  handlers: ReturnType<typeof createAllHandlers>,
  deps: HandlerDependencies
): ButtonHandlers { ... }

export function createBotDependencies(
  handlers: ReturnType<typeof createAllHandlers>
): BotDependencies { ... }
```

### 4.4 bot-factory.ts (~250 lines)
```typescript
import { BotConfiguration } from "./config-loader.ts";
import { createSignalHandler } from "./signal-handler.ts";
import { 
  createAllHandlers, 
  createCommandHandlersMap, 
  createButtonHandlersMap,
  createBotDependencies 
} from "./handler-registry.ts";

// Internal state management
interface BotState {
  claudeController: AbortController | null;
  claudeSessionId: string | undefined;
  messageHistory: string[];
  currentHistoryIndex: number;
  claudeSender: ((messages: ClaudeMessage[]) => Promise<void>) | null;
}

function createBotState(): BotState { ... }

function createHistoryHelpers(state: BotState) {
  return {
    addToHistory: (msg: string) => { ... },
    getPreviousMessage: () => { ... },
    getNextMessage: () => { ... }
  };
}

function createManagers(workDir: string, crashHandler: ProcessCrashHandler) {
  return {
    shellManager: new ShellManager(workDir),
    worktreeBotManager: new WorktreeBotManager(),
    claudeSessionManager: new ClaudeSessionManager(),
    healthMonitor: new ProcessHealthMonitor(crashHandler)
  };
}

function createSettings(defaultMentionUserId?: string) {
  // Initialize all settings objects
  return { botSettings, advancedSettings, unifiedSettings, updateFunctions };
}

export async function createClaudeCodeBot(config: BotConfiguration) {
  // 1. Create state
  const state = createBotState();
  const historyHelpers = createHistoryHelpers(state);
  
  // 2. Create crash handler
  const crashHandler = new ProcessCrashHandler({ ... });
  
  // 3. Create managers
  const managers = createManagers(config.workDir, crashHandler);
  
  // 4. Create settings
  const settings = createSettings(config.defaultMentionUserId);
  
  // 5. Setup periodic cleanup
  const cleanupInterval = setInterval(() => { ... }, 3600000);
  
  // 6. Create handler dependencies
  const handlerDeps = { ... };
  
  // 7. Create all handlers
  const handlers = createAllHandlers(handlerDeps);
  const commandHandlers = createCommandHandlersMap(handlers, handlerDeps);
  const buttonHandlers = createButtonHandlersMap(handlers, handlerDeps);
  const dependencies = createBotDependencies(handlers);
  
  // 8. Create Discord bot
  const bot = await createDiscordBot(config, commandHandlers, buttonHandlers, dependencies, crashHandler);
  
  // 9. Create Discord sender
  state.claudeSender = createClaudeSender(discordSender);
  
  // 10. Setup signal handlers
  const signalHandler = createSignalHandler({ ... });
  signalHandler.register();
  
  return bot;
}
```

### 4.5 main.ts (~80 lines)
```typescript
#!/usr/bin/env -S deno run --allow-all

import { parseArgs, loadEnvironmentConfig, validateConfig } from "./config-loader.ts";
import { createClaudeCodeBot } from "./bot-factory.ts";
import { getGitInfo } from "./git/index.ts";

// Re-exports for backward compatibility
export { getGitInfo, executeGitCommand } from "./git/index.ts";
export { sendToClaudeCode } from "./claude/index.ts";

if (import.meta.main) {
  try {
    // Load config
    const envConfig = loadEnvironmentConfig();
    const args = parseArgs(Deno.args);
    
    if (!envConfig.discordToken || !envConfig.applicationId) {
      console.error("Error: DISCORD_TOKEN and APPLICATION_ID environment variables are required");
      Deno.exit(1);
    }
    
    // Get Git information
    const gitInfo = await getGitInfo();
    
    // Merge configuration
    const config = {
      discordToken: envConfig.discordToken,
      applicationId: envConfig.applicationId,
      workDir: Deno.cwd(),
      repoName: gitInfo.repo,
      branchName: gitInfo.branch,
      categoryName: args.category || envConfig.categoryName,
      defaultMentionUserId: args.userId || envConfig.defaultMentionUserId,
    };
    
    // Create and start bot
    await createClaudeCodeBot(config);
    
    console.log("Bot has started. Press Ctrl+C to stop.");
  } catch (error) {
    console.error("Failed to start bot:", error);
    Deno.exit(1);
  }
}
```

---

## 5. Risk Assessment

### HIGH RISK Areas

1. **Closure State Management (D5, D7)**
   - The command and button handlers heavily rely on closure-captured state
   - Variables like `claudeController`, `claudeSessionId`, `messageHistory`, `currentHistoryIndex`
   - **Mitigation:** Pass these as getter/setter functions in dependencies object

2. **Circular References**
   - `claudeSender` is created AFTER bot, but handlers need it BEFORE bot creation
   - Current solution uses mutable `let claudeSender` that gets assigned later
   - **Mitigation:** Keep the late-binding pattern with getter function

3. **Handler Size** 
   - Even extracted, handler-registry.ts will be ~1400 lines
   - Could further split into:
     - `handlers/claude-commands.ts`
     - `handlers/git-commands.ts`
     - `handlers/shell-commands.ts`
     - `handlers/system-commands.ts`
     - `handlers/button-handlers.ts`
   - **Mitigation:** Phase 3 can further decompose handler-registry

### MEDIUM RISK Areas

1. **Discord.js Dynamic Import (D8)**
   - Line 1651-1695: Dynamic import of discord.js
   - **Mitigation:** Keep in bot-factory.ts, document the pattern

2. **Manager Interconnections (D3)**
   - CrashHandler needs ShellManager and WorktreeBotManager
   - HealthMonitor needs CrashHandler
   - **Mitigation:** Careful initialization order

3. **Settings Synchronization**
   - Three settings objects that need to stay in sync
   - **Mitigation:** Consider unifying in Phase 3

### LOW RISK Areas

1. **parseArgs** - Pure function, easy extraction
2. **Signal handlers** - Self-contained, clear interface
3. **Main entry point** - Simple orchestration logic

---

## 6. Line Count Summary

| Module | Estimated Lines | Complexity |
|--------|----------------|------------|
| config-loader.ts | ~80 | Low |
| signal-handler.ts | ~100 | Low |
| handler-registry.ts | ~1400 | High |
| bot-factory.ts | ~250 | Medium |
| main.ts | ~80 | Low |
| **Total** | ~1910 | - |

*Note: Total slightly higher than original due to added types and interfaces*

---

## 7. Implementation Tasks

### Task 1: ✅ Analyze index.ts and identify logical sections
- Analysis complete (this document)

### Task 2: Create config-loader.ts
- [ ] Extract `parseArgs()` 
- [ ] Add `loadEnvironmentConfig()`
- [ ] Add type definitions
- [ ] Test independently

### Task 3: Create signal-handler.ts
- [ ] Extract signal handling logic
- [ ] Define clean interface
- [ ] Test signal registration

### Task 4: Create handler-registry.ts (Most Complex)
- [ ] Define `HandlerDependencies` interface
- [ ] Extract handler creation functions
- [ ] Extract command handlers map
- [ ] Extract button handlers map
- [ ] Ensure closure variables become dependency parameters

### Task 5: Create bot-factory.ts
- [ ] Extract manager creation
- [ ] Extract settings initialization
- [ ] Wire together with handler-registry
- [ ] Maintain late-binding for claudeSender

### Task 6: Create new main.ts entry point
- [ ] Keep only entry point logic
- [ ] Update imports
- [ ] Maintain backward-compatible exports

### Task 7: Testing & Validation
- [ ] Run full bot startup
- [ ] Test all commands
- [ ] Test signal handling (Ctrl+C)
- [ ] Test worktree bot spawning
- [ ] Verify TypeScript compiles cleanly

---

## 8. Alternative Considerations

### Option A: More Granular Handler Split
Instead of one large handler-registry.ts, create:
```
handlers/
  index.ts           # Re-exports
  claude.ts          # Claude commands
  git.ts             # Git/worktree commands  
  shell.ts           # Shell commands
  system.ts          # System info commands
  settings.ts        # Settings commands
  buttons.ts         # Button handlers
```
**Pros:** Better separation of concerns
**Cons:** More files, more complex dependency passing

### Option B: State Manager Pattern
Create dedicated state managers:
```
state/
  session-state.ts   # claudeController, claudeSessionId
  history-state.ts   # messageHistory, navigation
  settings-state.ts  # unified/advanced settings
```
**Pros:** Cleaner state management
**Cons:** More abstraction layers

### Recommendation
Start with the proposed 5-module approach. If handler-registry.ts proves too large to maintain, apply Option A in Phase 3.

---

## Status: ✅ Analysis Complete - Ready for Implementation
