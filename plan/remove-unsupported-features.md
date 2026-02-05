# Remove Unsupported Features Plan

## Issue
Temperature and maxTokens parameters are shown in the UI and stored in settings, but they are NOT supported by Claude Code CLI. This gives users the false impression they can control these values.

## Claude Code CLI Supported Features
Based on the SDK, these ARE supported:
- ✅ Model selection (--model flag)
- ✅ System prompts (injected into prompt)
- ✅ Git context (gathered manually, injected)
- ✅ Context files (read manually, injected)
- ✅ Thinking mode (varies by model capability)
- ✅ Continue mode
- ✅ Working directory

## NOT Supported by Claude Code CLI
- ❌ Temperature
- ❌ Max tokens
- ❌ Top P
- ❌ Presence penalty
- ❌ Frequency penalty

## Files Modified

### 1. settings/advanced-settings.ts
- [x] Remove `defaultTemperature` from interface
- [x] Remove `defaultMaxTokens` from interface
- [x] Remove from DEFAULT_SETTINGS
- [x] Remove 'set-temperature' and 'set-max-tokens' command choices

### 2. settings/unified-settings.ts
- [x] Remove `defaultTemperature` from interface
- [x] Remove `defaultMaxTokens` from interface
- [x] Remove from UNIFIED_DEFAULT_SETTINGS

### 3. settings/unified-handlers.ts
- [x] Remove temperature from display
- [x] Remove maxTokens from display
- [x] Remove 'set-temperature' case
- [x] Update help text

### 4. settings/handlers.ts
- [x] Remove temperature handlers
- [x] Remove maxTokens handlers
- [x] Remove from display

### 5. claude/enhanced-client.ts
- [x] Remove temperature from EnhancedClaudeOptions interface
- [x] Remove maxTokens from EnhancedClaudeOptions interface
- [x] Remove console.log messages about unsupported features

### 6. agent/index.ts
- [x] Remove temperature from AgentConfig interface
- [x] Remove maxTokens from AgentConfig interface
- [x] Remove from all PREDEFINED_AGENTS
- [x] Remove from UI display

### 7. claude/additional-commands.ts
- [x] Remove temperature from all enhancedClaudeQuery calls

### 8. claude/client.ts
- [x] Cleaned up ClaudeModelOptions comment

### 9. help/commands.ts
- [x] Updated claude-settings help text

## Status
- [x] Started
- [x] Testing (deno check passed)
- [x] Complete
