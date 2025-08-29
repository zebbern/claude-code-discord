import { 
  detectPlatform, 
  getPlatformCommands, 
  executeSystemCommand, 
  getPlatformDisplayName,
  parseProcessList,
  formatFileSize,
  isCommandAvailable 
} from "../util/platform.ts";

// Re-export system commands from commands.ts
export { systemCommands } from "./commands.ts";

export interface SystemHandlerDeps {
  workDir: string;
  crashHandler: any;
}

export function createSystemHandlers(deps: SystemHandlerDeps) {
  const { workDir, crashHandler } = deps;
  const platform = detectPlatform();
  const platformCommands = getPlatformCommands();

  return {
    async onSystemInfo(ctx: any) {
      try {
        const platformName = getPlatformDisplayName();
        const systemInfoOutput = await executeSystemCommand(platformCommands.systemInfoCmd);
        
        // Enhanced system info with platform detection
        const systemInfo = `Platform: ${platformName} (${platform})
Architecture: ${Deno.build.arch}
Deno Version: ${Deno.version.deno}
V8 Version: ${Deno.version.v8}
TypeScript Version: ${Deno.version.typescript}
Working Directory: ${workDir}

System Details:
${systemInfoOutput}`;

        return { data: systemInfo };
      } catch (error) {
        throw new Error(`Failed to get system info: ${error.message}`);
      }
    },

    async onProcesses(ctx: any, filter?: string, limit: number = 20) {
      try {
        let command = platformCommands.processListCmd;
        
        // Apply filter if provided
        if (filter && platform !== 'windows') {
          command = platformCommands.findProcessCmd(filter);
        }
        
        const output = await executeSystemCommand(command);
        
        // Parse process list based on platform
        const processes = parseProcessList(output);
        
        // Apply filter for Windows (post-processing)
        let filteredProcesses = processes;
        if (filter) {
          filteredProcesses = processes.filter(p => 
            p.name.toLowerCase().includes(filter.toLowerCase())
          );
        }
        
        // Apply limit
        const limitedProcesses = filteredProcesses.slice(0, limit);
        
        let processInfo = `Running Processes (${limitedProcesses.length}/${filteredProcesses.length} shown):\n`;
        processInfo += `Platform: ${getPlatformDisplayName()}\n\n`;
        
        if (platform === 'windows') {
          processInfo += `${'Name'.padEnd(20)} ${'PID'.padEnd(8)} ${'CPU%'.padEnd(8)} ${'Memory'.padEnd(12)}\n`;
          processInfo += '-'.repeat(50) + '\n';
          
          limitedProcesses.forEach(proc => {
            processInfo += `${proc.name.padEnd(20)} ${proc.pid.toString().padEnd(8)} ${(proc.cpu || 0).toFixed(1).padEnd(8)} ${formatFileSize(proc.memory || 0).padEnd(12)}\n`;
          });
        } else {
          processInfo += `${'PID'.padEnd(8)} ${'Name'.padEnd(20)} ${'CPU%'.padEnd(8)} ${'MEM%'.padEnd(8)} ${'Status'.padEnd(10)}\n`;
          processInfo += '-'.repeat(60) + '\n';
          
          limitedProcesses.forEach(proc => {
            processInfo += `${proc.pid.toString().padEnd(8)} ${proc.name.padEnd(20)} ${(proc.cpu || 0).toFixed(1).padEnd(8)} ${(proc.memory || 0).toFixed(1).padEnd(8)} ${(proc.status || 'Unknown').padEnd(10)}\n`;
          });
        }

        return { data: processInfo };
      } catch (error) {
        throw new Error(`Failed to list processes: ${error.message}`);
      }
    },

    async onSystemResources(ctx: any) {
      try {
        let resourceInfo = `System Resources - ${getPlatformDisplayName()}\n\n`;
        
        if (platform === 'windows') {
          // Windows resource monitoring
          const memoryCmd = ['powershell', '-Command', 'Get-CimInstance -ClassName Win32_OperatingSystem | Select-Object TotalVisibleMemorySize, FreePhysicalMemory'];
          const cpuCmd = ['powershell', '-Command', 'Get-Counter "\\Processor(_Total)\\% Processor Time" | Select-Object -ExpandProperty CounterSamples | Select-Object CookedValue'];
          
          const [memoryOutput, cpuOutput] = await Promise.all([
            executeSystemCommand(memoryCmd),
            executeSystemCommand(cpuCmd)
          ]);
          
          resourceInfo += `Memory Information:\n${memoryOutput}\n\n`;
          resourceInfo += `CPU Usage:\n${cpuOutput}\n`;
        } else {
          // Unix-like systems
          const commands = [
            ['free', '-h'],
            ['cat', '/proc/loadavg'],
            ['cat', '/proc/meminfo']
          ];
          
          for (const cmd of commands) {
            const available = await isCommandAvailable(cmd[0]);
            if (available) {
              const output = await executeSystemCommand(cmd);
              resourceInfo += `${cmd.join(' ')}:\n${output}\n\n`;
            }
          }
        }

        return { data: resourceInfo };
      } catch (error) {
        throw new Error(`Failed to get system resources: ${error.message}`);
      }
    },

    async onNetworkInfo(ctx: any) {
      try {
        const networkOutput = await executeSystemCommand(platformCommands.networkInfoCmd);
        
        let networkInfo = `Network Information - ${getPlatformDisplayName()}\n\n`;
        
        if (platform === 'windows') {
          networkInfo += `Network Adapters:\n${networkOutput}`;
        } else {
          networkInfo += `Network Interfaces:\n${networkOutput}`;
          
          // Try to get additional connection info on Unix systems
          const netstatAvailable = await isCommandAvailable('netstat');
          if (netstatAvailable) {
            const connectionsOutput = await executeSystemCommand(['netstat', '-tuln']);
            networkInfo += `\n\nActive Connections:\n${connectionsOutput}`;
          }
        }

        return { data: networkInfo };
      } catch (error) {
        throw new Error(`Failed to get network info: ${error.message}`);
      }
    },

    async onDiskUsage(ctx: any) {
      try {
        const diskOutput = await executeSystemCommand(platformCommands.diskUsageCmd);
        
        const diskInfo = `Disk Usage - ${getPlatformDisplayName()}\n\n${diskOutput}`;
        return { data: diskInfo };
      } catch (error) {
        throw new Error(`Failed to get disk usage: ${error.message}`);
      }
    },

    async onEnvVars(ctx: any, filter?: string) {
      try {
        const envVars = Deno.env.toObject();
        let envInfo = `Environment Variables - ${getPlatformDisplayName()}\n\n`;
        
        const filteredVars = filter 
          ? Object.entries(envVars).filter(([key]) => 
              key.toLowerCase().includes(filter.toLowerCase())
            )
          : Object.entries(envVars);
        
        // Mask sensitive values
        const sensitivePatterns = [
          /password/i, /token/i, /key/i, /secret/i, /auth/i
        ];
        
        filteredVars.forEach(([key, value]) => {
          const isSensitive = sensitivePatterns.some(pattern => pattern.test(key));
          const displayValue = isSensitive ? '***MASKED***' : value;
          envInfo += `${key}=${displayValue}\n`;
        });
        
        envInfo += `\nTotal: ${filteredVars.length} variables`;
        if (filter) {
          envInfo += ` (filtered by: ${filter})`;
        }

        return { data: envInfo };
      } catch (error) {
        throw new Error(`Failed to get environment variables: ${error.message}`);
      }
    },

    async onSystemLogs(ctx: any, lines: number = 50, service?: string) {
      try {
        let command = platformCommands.systemLogsCmd;
        
        if (platform === 'windows') {
          if (service) {
            command = ['powershell', '-Command', `Get-EventLog -LogName System -Source "*${service}*" -Newest ${lines} | Select-Object TimeGenerated, Source, EntryType, Message | Format-Table -AutoSize`];
          } else {
            command = ['powershell', '-Command', `Get-EventLog -LogName System -Newest ${lines} | Select-Object TimeGenerated, Source, EntryType, Message | Format-Table -AutoSize`];
          }
        } else {
          if (service) {
            const journalAvailable = await isCommandAvailable('journalctl');
            if (journalAvailable) {
              command = ['journalctl', '-u', service, '-n', lines.toString(), '--no-pager'];
            } else {
              command = ['dmesg', '|', 'grep', service, '|', 'tail', `-${lines}`];
            }
          } else {
            const journalAvailable = await isCommandAvailable('journalctl');
            if (journalAvailable) {
              command = ['journalctl', '-n', lines.toString(), '--no-pager'];
            } else {
              command = ['dmesg', '|', 'tail', `-${lines}`];
            }
          }
        }
        
        const logOutput = await executeSystemCommand(command);
        
        let logInfo = `System Logs - ${getPlatformDisplayName()}\n`;
        if (service) logInfo += `Service: ${service}\n`;
        logInfo += `Lines: ${lines}\n\n${logOutput}`;

        return { data: logInfo };
      } catch (error) {
        throw new Error(`Failed to get system logs: ${error.message}`);
      }
    },

    async onPortScan(ctx: any, host: string = 'localhost', ports?: string) {
      try {
        let portInfo = `Port Scan - ${host} (${getPlatformDisplayName()})\n\n`;
        
        if (platform === 'windows') {
          // Windows netstat approach
          const command = ['netstat', '-an'];
          const output = await executeSystemCommand(command);
          portInfo += `Active Connections:\n${output}`;
        } else {
          // Unix approach - try ss first, fallback to netstat
          const ssAvailable = await isCommandAvailable('ss');
          const command = ssAvailable ? ['ss', '-tuln'] : ['netstat', '-tuln'];
          
          const output = await executeSystemCommand(command);
          portInfo += `Listening Ports:\n${output}`;
        }

        return { data: portInfo };
      } catch (error) {
        throw new Error(`Failed to scan ports: ${error.message}`);
      }
    },

    async onServiceStatus(ctx: any, service?: string) {
      try {
        let command = platformCommands.serviceStatusCmd;
        
        if (service) {
          if (platform === 'windows') {
            command = ['powershell', '-Command', `Get-Service -Name "*${service}*" | Format-Table -AutoSize`];
          } else if (platform === 'darwin') {
            command = ['launchctl', 'list', '|', 'grep', service];
          } else {
            command = ['systemctl', 'status', service, '--no-pager'];
          }
        }
        
        const serviceOutput = await executeSystemCommand(command);
        
        let serviceInfo = `Service Status - ${getPlatformDisplayName()}\n`;
        if (service) serviceInfo += `Service: ${service}\n`;
        serviceInfo += `\n${serviceOutput}`;

        return { data: serviceInfo };
      } catch (error) {
        throw new Error(`Failed to get service status: ${error.message}`);
      }
    },

    async onUptime(ctx: any) {
      try {
        const uptimeOutput = await executeSystemCommand(platformCommands.uptimeCmd);
        
        const uptimeInfo = `System Uptime - ${getPlatformDisplayName()}\n\n${uptimeOutput}`;
        return { data: uptimeInfo };
      } catch (error) {
        throw new Error(`Failed to get uptime: ${error.message}`);
      }
    }
  };
}