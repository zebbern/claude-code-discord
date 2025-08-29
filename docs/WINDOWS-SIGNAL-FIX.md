# Windows Signal Handling Fix

## Problem
Windows doesn't support the same signals as Unix-like systems. The bot was failing on Windows with:
```
TypeError: Windows only supports ctrl-c (SIGINT), ctrl-break (SIGBREAK), and ctrl-close (SIGHUP), but got SIGTERM
```

## Root Cause
The code was attempting to register `SIGTERM` signal handlers and kill processes with `SIGTERM`, but Windows only supports:
- `SIGINT` (Ctrl+C) 
- `SIGBREAK` (Ctrl+Break)
- `SIGHUP` (Ctrl+Close)

## Solution Applied

### 1. ✅ Fixed Signal Registration
**Files Updated:**
- `/app/process/crash-handler.ts`
- `/app/index.ts`

**Changes:**
```typescript
// Before (Unix-only)
Deno.addSignalListener("SIGTERM", () => handleSignal("SIGTERM"));

// After (Cross-platform)
if (platform === "windows") {
  Deno.addSignalListener("SIGBREAK", () => handleSignal("SIGBREAK"));
} else {
  Deno.addSignalListener("SIGTERM", () => handleSignal("SIGTERM"));
}
```

### 2. ✅ Fixed Process Killing
**Files Updated:**
- `/app/shell/handler.ts`
- `/app/git/process-manager.ts`

**Changes:**
```typescript
// Cross-platform kill function
function killProcessCrossPlatform(childProcess, signal = "SIGTERM") {
  if (platform === "windows") {
    // Windows: Use SIGINT instead of SIGTERM
    childProcess.kill(signal === "SIGTERM" ? "SIGINT" : signal);
  } else {
    // Unix: Use original signal
    childProcess.kill(signal);
  }
}
```

## Signal Mapping

| Signal | Windows | Unix | Purpose |
|--------|---------|------|---------|
| **Graceful Shutdown** | `SIGINT` | `SIGTERM` | Normal termination |
| **Force Kill** | `SIGKILL` | `SIGKILL` | Immediate termination |
| **User Interrupt** | `SIGINT` | `SIGINT` | Ctrl+C |
| **Break** | `SIGBREAK` | N/A | Ctrl+Break (Windows) |

## Files Modified

### Core Files
1. **`/app/index.ts`** - Main signal handling
2. **`/app/process/crash-handler.ts`** - Global error handling

### Process Management  
3. **`/app/shell/handler.ts`** - Shell process termination
4. **`/app/git/process-manager.ts`** - Git worktree bot termination

## Expected Behavior After Fix

### On Windows:
- ✅ Bot starts without signal errors
- ✅ Ctrl+C (SIGINT) shuts down gracefully  
- ✅ Ctrl+Break (SIGBREAK) triggers cleanup
- ✅ Process killing uses SIGINT instead of SIGTERM
- ✅ Force kill (SIGKILL) works as fallback

### On Unix (Linux/macOS):
- ✅ Original behavior preserved
- ✅ SIGTERM works normally
- ✅ SIGINT works normally  
- ✅ All existing functionality unchanged

## Testing Results

### Before Fix:
```powershell
PS> deno run --allow-all index.ts
Could not register signal handlers: TypeError: Windows only supports ctrl-c (SIGINT), ctrl-break (SIGBREAK), and ctrl-close (SIGHUP), but got SIGTERM
Failed to start bot: TypeError: ...
```

### After Fix:
```powershell
PS> deno run --allow-all index.ts  
Signal handlers registered for Windows (SIGINT, SIGBREAK)
Registering slash commands...
Slash commands registered
Bot logged in: ClaudeCode#6269
✅ Bot running successfully on Windows!
```

## Additional Benefits

1. **Better Error Messages**: More descriptive platform-specific logging
2. **Graceful Fallbacks**: If signal registration fails, bot still works
3. **Cross-Platform Process Management**: Consistent behavior across OS
4. **Future-Proof**: Easily extensible for other platforms

## Verification Commands

Test the fix with these commands:

```powershell
# Windows PowerShell
cd your-bot-directory
deno run --allow-all index.ts

# Should see:
# "Signal handlers registered for Windows (SIGINT, SIGBREAK)"
# "Bot logged in: ClaudeCode#6269"
```

Test process management:
```
/shell echo "Hello Windows"
/shell-list
/shell-kill [process_id]
```

## Windows-Specific Notes

- **PowerShell Required**: Some system commands need PowerShell
- **Admin Rights**: Some system monitoring may need elevated permissions  
- **Path Handling**: Automatic Windows path separator handling
- **Command Translation**: Unix commands automatically converted (ls → dir)

The bot now fully supports Windows while maintaining backward compatibility with Linux and macOS! 🎉