# Comprehensive Cleanup Plan

## Issues to Fix

### 1. Help System Cleanup
Remove non-implemented commands from help:
- `developer-settings` - Command defined but no handler
- `session-settings` - Command defined but no handler  
- `monitoring-settings` - Command defined but no handler
- `profile-settings` - Command defined but no handler

### 2. Git Status Display Issue
Fix the git status button showing raw output instead of formatted display

### 3. File Structure Cleanup
Remove unused/zombie files and commands:

#### Files to Analyze:
- `/app/test-*.ts` files - Keep only essential ones
- Unused command definitions without handlers
- Old/legacy files that aren't imported

#### Commands to Remove:
- Advanced settings commands that have no implementation
- Any orphaned command definitions

### 4. Code Organization
- Consolidate similar functionality
- Remove duplicate imports
- Clean up comments and documentation
- Ensure proper file naming conventions

## Implementation Steps

1. **Update help system** - Remove non-functional commands
2. **Fix git status display** - Improve formatting
3. **Remove unused advanced settings** - Clean up command definitions
4. **Delete zombie files** - Remove unused test/temp files
5. **Reorganize imports** - Clean up dependencies
6. **Update documentation** - Reflect actual functionality

## Expected Results
- Clean help system showing only working commands
- Proper git status display
- Organized file structure
- No unused/dead code
- Better maintainability