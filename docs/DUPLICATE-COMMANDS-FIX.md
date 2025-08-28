# Duplicate Commands Fix

## Problem
Discord API was rejecting command registration with error:
```
DiscordAPIError[50035]: Invalid Form Body
APPLICATION_COMMANDS_DUPLICATE_NAME: Application command names must be unique
```

## Root Cause Analysis
Found two sources of duplicate commands:

### 1. Duplicate `settings` Command
- **Location 1**: `/app/util/command.ts` - Legacy settings command
- **Location 2**: `/app/settings/unified-settings.ts` - New unified settings command
- **Impact**: Both were being registered causing the duplicate name error

### 2. `claude-templates` Command Still Present
- **Location**: `/app/claude/enhanced-commands.ts` 
- **Issue**: Despite filtering in index.ts, the command definition still existed in source
- **Impact**: Command was supposed to be removed but still being processed

## Fix Applied

### ✅ 1. Removed Legacy Settings Command
**File**: `/app/util/command.ts`
- Removed the entire old `settings` SlashCommandBuilder definition
- Added explanatory comment about migration to unified settings
- Kept other util commands (status, pwd, shutdown) intact

### ✅ 2. Completely Removed claude-templates
**File**: `/app/claude/enhanced-commands.ts`
- Removed the `claude-templates` SlashCommandBuilder definition (lines 71-87)
- Removed the `onClaudeTemplates` handler function
- Added explanatory comments about removal and alternative (enhanced prompting)

**File**: `/app/help/commands.ts`  
- Commented out `claude-templates` help documentation
- Updated help text to remove references

**File**: `/app/index.ts`
- Cleaned up unnecessary filter since command is now removed from source

## Verification

### Commands Now Unique ✅
All commands verified to have unique names:
- `agent` (1)
- `claude` (1) 
- `claude-cancel` (1)
- `claude-context` (1)
- `claude-debug` (1)
- `claude-enhanced` (1)
- `claude-explain` (1)
- `claude-generate` (1)
- `claude-learn` (1)
- `claude-models` (1)
- `claude-optimize` (1)
- `claude-refactor` (1)
- `claude-review` (1)
- `claude-sessions` (1)
- `claude-settings` (1)
- `continue` (1)
- `developer-settings` (1)
- `disk-usage` (1)
- `env-vars` (1)
- `git` (1)
- `help` (1)
- `mcp` (1)
- `monitoring-settings` (1)
- `network-info` (1)
- `output-settings` (1)
- `port-scan` (1)
- `processes` (1)
- `profile-settings` (1)
- `pwd` (1)
- `quick-model` (1)
- `service-status` (1)
- `session-settings` (1)
- `settings` (1) ✅ Now unique - unified version only
- `shell` (1)
- `shell-input` (1)
- `shell-kill` (1)
- `shell-list` (1)
- `shutdown` (1)
- `status` (1)
- `system-info` (1)
- `system-logs` (1)
- `system-resources` (1)
- `todos` (1)
- `uptime` (1)
- `worktree` (1)
- `worktree-bots` (1)
- `worktree-kill` (1)
- `worktree-list` (1)
- `worktree-remove` (1)

### Missing Commands Confirmed ✅
- `claude-templates` - ✅ Successfully removed (as requested)

## Files Modified

1. **`/app/util/command.ts`**
   - Removed legacy settings command definition
   - Added migration note

2. **`/app/claude/enhanced-commands.ts`**
   - Removed claude-templates command completely
   - Removed associated handler function
   - Added explanatory comments

3. **`/app/help/commands.ts`**
   - Commented out claude-templates help entry
   - Updated help text references

4. **`/app/index.ts`**
   - Cleaned up unnecessary filter logic

## Test Files Created

- **`/app/test-no-duplicates.ts`** - Comprehensive test to verify no duplicate command names
- Provides detailed breakdown by category
- Validates specific problematic commands

## Expected Result

Discord bot should now start successfully without the `APPLICATION_COMMANDS_DUPLICATE_NAME` error.

The unified settings system is now the single source for settings management, with template functionality moved to enhanced prompting as intended.

## Migration Notes

### For Users
- Use `/settings` (unified) instead of old basic settings
- Use `/claude-enhanced` with custom prompts instead of `/claude-templates`
- All existing functionality preserved in new unified system

### For Developers  
- Settings management now centralized in `/app/settings/unified-settings.ts`
- Template functionality available through enhanced prompting system
- Clean command structure with no duplicates or conflicts