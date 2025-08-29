// Cross-platform utilities for Windows/Linux/macOS compatibility

export type PlatformType = 'windows' | 'linux' | 'darwin' | 'unknown';

/**
 * Detect the current operating system platform
 */
export function detectPlatform(): PlatformType {
  const os = Deno.build.os;
  switch (os) {
    case 'windows':
      return 'windows';
    case 'linux':
      return 'linux';
    case 'darwin':
      return 'darwin';
    default:
      return 'unknown';
  }
}

/**
 * Get platform-specific system commands
 */
export interface SystemCommands {
  processListCmd: string[];
  systemInfoCmd: string[];
  networkInfoCmd: string[];
  diskUsageCmd: string[];
  systemLogsCmd: string[];
  serviceStatusCmd: string[];
  uptimeCmd: string[];
  killProcessCmd: (pid: number) => string[];
  findProcessCmd: (name: string) => string[];
}

export function getPlatformCommands(): SystemCommands {
  const platform = detectPlatform();

  switch (platform) {
    case 'windows':
      return {
        processListCmd: ['powershell', '-Command', 'Get-Process | Select-Object Name, Id, CPU, WorkingSet | Format-Table -AutoSize'],
        systemInfoCmd: ['systeminfo'],
        networkInfoCmd: ['ipconfig', '/all'],
        diskUsageCmd: ['powershell', '-Command', 'Get-WmiObject -Class Win32_LogicalDisk | Select-Object DeviceID, @{Name="Size(GB)";Expression={[math]::Round($_.Size/1GB,2)}}, @{Name="FreeSpace(GB)";Expression={[math]::Round($_.FreeSpace/1GB,2)}}, @{Name="PercentFree";Expression={[math]::Round(($_.FreeSpace/$_.Size)*100,2)}} | Format-Table -AutoSize'],
        systemLogsCmd: ['powershell', '-Command', 'Get-EventLog -LogName System -Newest 50 | Select-Object TimeGenerated, Source, EntryType, Message | Format-Table -AutoSize'],
        serviceStatusCmd: ['powershell', '-Command', 'Get-Service | Format-Table -AutoSize'],
        uptimeCmd: ['powershell', '-Command', '(Get-CimInstance -ClassName Win32_OperatingSystem).LastBootUpTime; (Get-Date) - (Get-CimInstance -ClassName Win32_OperatingSystem).LastBootUpTime'],
        killProcessCmd: (pid: number) => ['taskkill', '/PID', pid.toString(), '/F'],
        findProcessCmd: (name: string) => ['powershell', '-Command', `Get-Process | Where-Object {$_.Name -like "*${name}*"} | Format-Table -AutoSize`]
      };

    case 'linux':
      return {
        processListCmd: ['ps', 'aux', '--sort=-%cpu'],
        systemInfoCmd: ['uname', '-a'],
        networkInfoCmd: ['ip', 'addr', 'show'],
        diskUsageCmd: ['df', '-h'],
        systemLogsCmd: ['journalctl', '-n', '50', '--no-pager'],
        serviceStatusCmd: ['systemctl', 'status', '--no-pager'],
        uptimeCmd: ['uptime'],
        killProcessCmd: (pid: number) => ['kill', '-TERM', pid.toString()],
        findProcessCmd: (name: string) => ['pgrep', '-l', name]
      };

    case 'darwin':
      return {
        processListCmd: ['ps', 'aux'],
        systemInfoCmd: ['uname', '-a'],
        networkInfoCmd: ['ifconfig'],
        diskUsageCmd: ['df', '-h'],
        systemLogsCmd: ['log', 'show', '--last', '1h', '--style', 'compact'],
        serviceStatusCmd: ['launchctl', 'list'],
        uptimeCmd: ['uptime'],
        killProcessCmd: (pid: number) => ['kill', '-TERM', pid.toString()],
        findProcessCmd: (name: string) => ['pgrep', '-l', name]
      };

    default:
      // Fallback to basic commands
      return {
        processListCmd: ['ps', 'aux'],
        systemInfoCmd: ['uname', '-a'],
        networkInfoCmd: ['ifconfig'],
        diskUsageCmd: ['df', '-h'],
        systemLogsCmd: ['dmesg', '|', 'tail', '-50'],
        serviceStatusCmd: ['ps', 'aux'],
        uptimeCmd: ['uptime'],
        killProcessCmd: (pid: number) => ['kill', pid.toString()],
        findProcessCmd: (name: string) => ['ps', 'aux', '|', 'grep', name]
      };
  }
}

/**
 * Execute platform-specific command with proper error handling
 */
export async function executeSystemCommand(command: string[]): Promise<string> {
  try {
    const cmd = new Deno.Command(command[0], {
      args: command.slice(1),
      stdout: 'piped',
      stderr: 'piped'
    });
    
    const { code, stdout, stderr } = await cmd.output();
    
    if (code === 0) {
      return new TextDecoder().decode(stdout);
    } else {
      const errorOutput = new TextDecoder().decode(stderr);
      return `Command failed (exit code ${code}): ${errorOutput}`;
    }
  } catch (error) {
    return `Execution error: ${error.message}`;
  }
}

/**
 * Get platform-specific file path separator
 */
export function getPathSeparator(): string {
  return detectPlatform() === 'windows' ? '\\' : '/';
}

/**
 * Convert Unix path to platform-specific path
 */
export function normalizePath(path: string): string {
  const platform = detectPlatform();
  if (platform === 'windows') {
    return path.replace(/\//g, '\\');
  }
  return path;
}

/**
 * Get platform-specific environment variable patterns
 */
export function getEnvVarPattern(): RegExp {
  const platform = detectPlatform();
  if (platform === 'windows') {
    // Windows environment variables can have different patterns
    return /^[A-Za-z_][A-Za-z0-9_]*$/;
  }
  // Unix-like systems
  return /^[A-Za-z_][A-Za-z0-9_]*$/;
}

/**
 * Get platform-friendly display names
 */
export function getPlatformDisplayName(): string {
  const platform = detectPlatform();
  switch (platform) {
    case 'windows': return 'Microsoft Windows';
    case 'linux': return 'Linux';
    case 'darwin': return 'macOS';
    default: return 'Unknown OS';
  }
}

/**
 * Check if a command is available on current platform
 */
export async function isCommandAvailable(command: string): Promise<boolean> {
  try {
    const platform = detectPlatform();
    const checkCmd = platform === 'windows' 
      ? ['where', command]
      : ['which', command];
    
    const cmd = new Deno.Command(checkCmd[0], {
      args: checkCmd.slice(1),
      stdout: 'piped',
      stderr: 'piped'
    });
    
    const { code } = await cmd.output();
    return code === 0;
  } catch {
    return false;
  }
}

/**
 * Get platform-specific shell command
 */
export function getShellCommand(): string[] {
  const platform = detectPlatform();
  switch (platform) {
    case 'windows':
      return ['powershell', '-Command'];
    case 'linux':
    case 'darwin':
      return ['bash', '-c'];
    default:
      return ['sh', '-c'];
  }
}

/**
 * Format file size in platform-appropriate units
 */
export function formatFileSize(bytes: number): string {
  const platform = detectPlatform();
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  const formatted = size.toFixed(unitIndex === 0 ? 0 : 2);
  return `${formatted} ${units[unitIndex]}`;
}

/**
 * Platform-specific process information
 */
export interface ProcessInfo {
  pid: number;
  name: string;
  cpu?: number;
  memory?: number;
  status?: string;
}

/**
 * Parse process list output based on platform
 */
export function parseProcessList(output: string): ProcessInfo[] {
  const platform = detectPlatform();
  const lines = output.trim().split('\n');
  
  if (platform === 'windows') {
    // Parse PowerShell Get-Process output
    const processes: ProcessInfo[] = [];
    const dataLines = lines.slice(3); // Skip header lines
    
    for (const line of dataLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 4) {
        processes.push({
          pid: parseInt(parts[1]) || 0,
          name: parts[0] || 'Unknown',
          cpu: parseFloat(parts[2]) || 0,
          memory: parseInt(parts[3]) || 0
        });
      }
    }
    return processes;
  } else {
    // Parse Unix ps output
    const processes: ProcessInfo[] = [];
    const dataLines = lines.slice(1); // Skip header
    
    for (const line of dataLines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 11) {
        processes.push({
          pid: parseInt(parts[1]) || 0,
          name: parts[10] || 'Unknown',
          cpu: parseFloat(parts[2]) || 0,
          memory: parseFloat(parts[3]) || 0,
          status: parts[7] || 'Unknown'
        });
      }
    }
    return processes;
  }
}