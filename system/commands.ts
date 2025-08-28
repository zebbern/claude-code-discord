import { SlashCommandBuilder } from "npm:discord.js@14.14.1";

export const systemCommands = [
  new SlashCommandBuilder()
    .setName('system-info')
    .setDescription('Display comprehensive system information'),
  
  new SlashCommandBuilder()
    .setName('processes')
    .setDescription('List running processes')
    .addStringOption(option =>
      option.setName('filter')
        .setDescription('Filter processes by name (optional)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Maximum number of processes to show (default: 20)')
        .setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('system-resources')
    .setDescription('Show system resource usage (CPU, Memory, Disk)'),
  
  new SlashCommandBuilder()
    .setName('network-info')
    .setDescription('Display network interfaces and connections'),
  
  new SlashCommandBuilder()
    .setName('disk-usage')
    .setDescription('Show disk space usage for all mounted drives'),
  
  new SlashCommandBuilder()
    .setName('env-vars')
    .setDescription('List environment variables')
    .addStringOption(option =>
      option.setName('filter')
        .setDescription('Filter by variable name (optional)')
        .setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('system-logs')
    .setDescription('Show recent system logs')
    .addIntegerOption(option =>
      option.setName('lines')
        .setDescription('Number of lines to show (default: 50)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('service')
        .setDescription('Specific service/application to filter')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('port-scan')
    .setDescription('Check which ports are open/listening')
    .addStringOption(option =>
      option.setName('host')
        .setDescription('Host to scan (default: localhost)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('ports')
        .setDescription('Port range (e.g. 80,443 or 8000-9000)')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('service-status')
    .setDescription('Check status of system services')
    .addStringOption(option =>
      option.setName('service')
        .setDescription('Specific service name to check')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('uptime')
    .setDescription('Show system uptime and load averages')
];

export interface SystemHandlerDeps {
  workDir: string;
  crashHandler: any;
}

export function createSystemHandlers(deps: SystemHandlerDeps) {
  const { workDir, crashHandler } = deps;
  
  return {
    async onSystemInfo(ctx: any) {
      try {
        const info = await getSystemInfo();
        return { success: true, data: info };
      } catch (error) {
        await crashHandler.reportCrash('main', error instanceof Error ? error : new Error(String(error)), 'system-info', 'System info collection');
        throw error;
      }
    },

    async onProcesses(ctx: any, filter?: string, limit: number = 20) {
      try {
        const processes = await getProcessList(filter, limit);
        return { success: true, data: processes };
      } catch (error) {
        await crashHandler.reportCrash('main', error instanceof Error ? error : new Error(String(error)), 'processes', 'Process listing');
        throw error;
      }
    },

    async onSystemResources(ctx: any) {
      try {
        const resources = await getSystemResources();
        return { success: true, data: resources };
      } catch (error) {
        await crashHandler.reportCrash('main', error instanceof Error ? error : new Error(String(error)), 'system-resources', 'Resource monitoring');
        throw error;
      }
    },

    async onNetworkInfo(ctx: any) {
      try {
        const network = await getNetworkInfo();
        return { success: true, data: network };
      } catch (error) {
        await crashHandler.reportCrash('main', error instanceof Error ? error : new Error(String(error)), 'network-info', 'Network information');
        throw error;
      }
    },

    async onDiskUsage(ctx: any) {
      try {
        const disk = await getDiskUsage();
        return { success: true, data: disk };
      } catch (error) {
        await crashHandler.reportCrash('main', error instanceof Error ? error : new Error(String(error)), 'disk-usage', 'Disk usage check');
        throw error;
      }
    },

    async onEnvVars(ctx: any, filter?: string) {
      try {
        const envVars = await getEnvironmentVariables(filter);
        return { success: true, data: envVars };
      } catch (error) {
        await crashHandler.reportCrash('main', error instanceof Error ? error : new Error(String(error)), 'env-vars', 'Environment variables');
        throw error;
      }
    },

    async onSystemLogs(ctx: any, lines: number = 50, service?: string) {
      try {
        const logs = await getSystemLogs(lines, service);
        return { success: true, data: logs };
      } catch (error) {
        await crashHandler.reportCrash('main', error instanceof Error ? error : new Error(String(error)), 'system-logs', 'Log retrieval');
        throw error;
      }
    },

    async onPortScan(ctx: any, host: string = 'localhost', ports?: string) {
      try {
        const openPorts = await scanPorts(host, ports);
        return { success: true, data: openPorts };
      } catch (error) {
        await crashHandler.reportCrash('main', error instanceof Error ? error : new Error(String(error)), 'port-scan', 'Port scanning');
        throw error;
      }
    },

    async onServiceStatus(ctx: any, service?: string) {
      try {
        const status = await getServiceStatus(service);
        return { success: true, data: status };
      } catch (error) {
        await crashHandler.reportCrash('main', error instanceof Error ? error : new Error(String(error)), 'service-status', 'Service status check');
        throw error;
      }
    },

    async onUptime(ctx: any) {
      try {
        const uptime = await getUptimeInfo();
        return { success: true, data: uptime };
      } catch (error) {
        await crashHandler.reportCrash('main', error instanceof Error ? error : new Error(String(error)), 'uptime', 'Uptime information');
        throw error;
      }
    }
  };
}

// System information functions
async function getSystemInfo(): Promise<string> {
  const commands = [
    { name: "OS", cmd: ["uname", "-a"] },
    { name: "CPU", cmd: ["lscpu"] },
    { name: "Memory", cmd: ["free", "-h"] },
    { name: "Kernel", cmd: ["uname", "-r"] },
    { name: "Hostname", cmd: ["hostname"] }
  ];

  const results: string[] = [];
  
  for (const { name, cmd } of commands) {
    try {
      const process = new Deno.Command(cmd[0], {
        args: cmd.slice(1),
        stdout: "piped",
        stderr: "piped"
      });
      
      const { stdout } = await process.output();
      const output = new TextDecoder().decode(stdout).trim();
      results.push(`**${name}:**\n\`\`\`\n${output}\n\`\`\``);
    } catch (error) {
      results.push(`**${name}:** Error - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return results.join('\n\n');
}

async function getProcessList(filter?: string, limit: number = 20): Promise<string> {
  try {
    const args = ["aux"];
    if (filter) {
      // Use ps with grep for filtering
      const process = new Deno.Command("sh", {
        args: ["-c", `ps aux | grep "${filter}" | grep -v grep | head -${limit}`],
        stdout: "piped",
        stderr: "piped"
      });
      
      const { stdout } = await process.output();
      const output = new TextDecoder().decode(stdout).trim();
      
      if (output) {
        return `**Filtered Processes (${filter}):**\n\`\`\`\n${output}\n\`\`\``;
      } else {
        return `**No processes found matching "${filter}"**`;
      }
    } else {
      const process = new Deno.Command("ps", {
        args: args,
        stdout: "piped",
        stderr: "piped"
      });
      
      const { stdout } = await process.output();
      let output = new TextDecoder().decode(stdout).trim();
      
      // Limit output to specified number of lines
      const lines = output.split('\n');
      if (lines.length > limit + 1) { // +1 for header
        output = lines.slice(0, limit + 1).join('\n') + `\n... (${lines.length - limit - 1} more processes)`;
      }
      
      return `**Running Processes (Top ${limit}):**\n\`\`\`\n${output}\n\`\`\``;
    }
  } catch (error) {
    throw new Error(`Failed to get process list: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function getSystemResources(): Promise<string> {
  const commands = [
    { name: "Memory Usage", cmd: ["free", "-h"] },
    { name: "CPU Usage", cmd: ["top", "-bn1"] },
    { name: "Load Average", cmd: ["uptime"] }
  ];

  const results: string[] = [];
  
  for (const { name, cmd } of commands) {
    try {
      if (name === "CPU Usage") {
        // Get just the CPU line from top
        const process = new Deno.Command("sh", {
          args: ["-c", "top -bn1 | head -20"],
          stdout: "piped",
          stderr: "piped"
        });
        
        const { stdout } = await process.output();
        const output = new TextDecoder().decode(stdout).trim();
        results.push(`**${name}:**\n\`\`\`\n${output}\n\`\`\``);
      } else {
        const process = new Deno.Command(cmd[0], {
          args: cmd.slice(1),
          stdout: "piped",
          stderr: "piped"
        });
        
        const { stdout } = await process.output();
        const output = new TextDecoder().decode(stdout).trim();
        results.push(`**${name}:**\n\`\`\`\n${output}\n\`\`\``);
      }
    } catch (error) {
      results.push(`**${name}:** Error - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return results.join('\n\n');
}

async function getNetworkInfo(): Promise<string> {
  const commands = [
    { name: "Network Interfaces", cmd: ["ip", "addr", "show"] },
    { name: "Network Connections", cmd: ["ss", "-tuln"] },
    { name: "Routing Table", cmd: ["ip", "route"] }
  ];

  const results: string[] = [];
  
  for (const { name, cmd } of commands) {
    try {
      const process = new Deno.Command(cmd[0], {
        args: cmd.slice(1),
        stdout: "piped",
        stderr: "piped"
      });
      
      const { stdout } = await process.output();
      const output = new TextDecoder().decode(stdout).trim();
      results.push(`**${name}:**\n\`\`\`\n${output}\n\`\`\``);
    } catch (error) {
      // Fallback commands for different systems
      if (cmd[0] === "ip" && name === "Network Interfaces") {
        try {
          const fallback = new Deno.Command("ifconfig", {
            stdout: "piped",
            stderr: "piped"
          });
          const { stdout: fallbackOut } = await fallback.output();
          const fallbackOutput = new TextDecoder().decode(fallbackOut).trim();
          results.push(`**${name}:**\n\`\`\`\n${fallbackOutput}\n\`\`\``);
        } catch {
          results.push(`**${name}:** Not available`);
        }
      } else {
        results.push(`**${name}:** Error - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  return results.join('\n\n');
}

async function getDiskUsage(): Promise<string> {
  try {
    const process = new Deno.Command("df", {
      args: ["-h"],
      stdout: "piped",
      stderr: "piped"
    });
    
    const { stdout } = await process.output();
    const output = new TextDecoder().decode(stdout).trim();
    return `**Disk Usage:**\n\`\`\`\n${output}\n\`\`\``;
  } catch (error) {
    throw new Error(`Failed to get disk usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function getEnvironmentVariables(filter?: string): Promise<string> {
  try {
    const env = Deno.env.toObject();
    let envEntries = Object.entries(env);
    
    if (filter) {
      envEntries = envEntries.filter(([key]) => 
        key.toLowerCase().includes(filter.toLowerCase())
      );
    }
    
    if (envEntries.length === 0) {
      return filter ? `**No environment variables found matching "${filter}"**` : "**No environment variables found**";
    }
    
    // Sort by key name and limit output
    envEntries.sort(([a], [b]) => a.localeCompare(b));
    
    // Mask sensitive values
    const maskedEntries = envEntries.map(([key, value]) => {
      const sensitivePatterns = [
        /password/i, /token/i, /key/i, /secret/i, /auth/i, /api/i
      ];
      
      const isSensitive = sensitivePatterns.some(pattern => pattern.test(key));
      const displayValue = isSensitive ? '***MASKED***' : value;
      
      return `${key}=${displayValue}`;
    });
    
    const output = maskedEntries.join('\n');
    const title = filter ? `**Environment Variables (filtered by "${filter}"):**` : '**Environment Variables:**';
    
    return `${title}\n\`\`\`\n${output}\n\`\`\``;
  } catch (error) {
    throw new Error(`Failed to get environment variables: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function getSystemLogs(lines: number = 50, service?: string): Promise<string> {
  try {
    let cmd: string[];
    
    if (service) {
      cmd = ["journalctl", "-u", service, "-n", lines.toString(), "--no-pager"];
    } else {
      cmd = ["journalctl", "-n", lines.toString(), "--no-pager"];
    }
    
    const process = new Deno.Command(cmd[0], {
      args: cmd.slice(1),
      stdout: "piped",
      stderr: "piped"
    });
    
    const { stdout } = await process.output();
    const output = new TextDecoder().decode(stdout).trim();
    
    const title = service ? `**System Logs (${service}, last ${lines} lines):**` : `**System Logs (last ${lines} lines):**`;
    return `${title}\n\`\`\`\n${output}\n\`\`\``;
  } catch (error) {
    // Fallback to dmesg or tail
    try {
      const fallback = new Deno.Command("dmesg", {
        args: ["--time-format", "iso", "-T"],
        stdout: "piped",
        stderr: "piped"
      });
      const { stdout } = await fallback.output();
      let output = new TextDecoder().decode(stdout).trim();
      
      const logLines = output.split('\n');
      if (logLines.length > lines) {
        output = logLines.slice(-lines).join('\n');
      }
      
      return `**System Logs (dmesg, last ${lines} lines):**\n\`\`\`\n${output}\n\`\`\``;
    } catch {
      throw new Error(`Failed to get system logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

async function scanPorts(host: string = 'localhost', ports?: string): Promise<string> {
  try {
    // Use netstat or ss to check listening ports
    const process = new Deno.Command("ss", {
      args: ["-tuln"],
      stdout: "piped",
      stderr: "piped"
    });
    
    const { stdout } = await process.output();
    const output = new TextDecoder().decode(stdout).trim();
    
    let filteredOutput = output;
    
    if (ports) {
      const lines = output.split('\n');
      const header = lines[0];
      let filteredLines = [header];
      
      if (ports.includes('-')) {
        // Port range
        const [start, end] = ports.split('-').map(p => parseInt(p.trim()));
        filteredLines = lines.filter((line, index) => {
          if (index === 0) return true; // Keep header
          const portMatch = line.match(/:(\d+)\s/);
          if (portMatch) {
            const port = parseInt(portMatch[1]);
            return port >= start && port <= end;
          }
          return false;
        });
      } else {
        // Specific ports
        const targetPorts = ports.split(',').map(p => p.trim());
        filteredLines = lines.filter((line, index) => {
          if (index === 0) return true; // Keep header
          return targetPorts.some(port => line.includes(`:${port} `));
        });
      }
      
      filteredOutput = filteredLines.join('\n');
    }
    
    const title = ports ? `**Open Ports (${host}, filtered by ${ports}):**` : `**Open Ports (${host}):**`;
    return `${title}\n\`\`\`\n${filteredOutput}\n\`\`\``;
  } catch (error) {
    throw new Error(`Failed to scan ports: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function getServiceStatus(service?: string): Promise<string> {
  try {
    if (service) {
      const process = new Deno.Command("systemctl", {
        args: ["status", service, "--no-pager"],
        stdout: "piped",
        stderr: "piped"
      });
      
      const { stdout } = await process.output();
      const output = new TextDecoder().decode(stdout).trim();
      return `**Service Status (${service}):**\n\`\`\`\n${output}\n\`\`\``;
    } else {
      const process = new Deno.Command("systemctl", {
        args: ["list-units", "--type=service", "--no-pager"],
        stdout: "piped",
        stderr: "piped"
      });
      
      const { stdout } = await process.output();
      const output = new TextDecoder().decode(stdout).trim();
      return `**All Services:**\n\`\`\`\n${output}\n\`\`\``;
    }
  } catch (error) {
    throw new Error(`Failed to get service status: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function getUptimeInfo(): Promise<string> {
  try {
    const commands = [
      { name: "Uptime", cmd: ["uptime"] },
      { name: "Boot Time", cmd: ["who", "-b"] },
      { name: "Load Average", cmd: ["cat", "/proc/loadavg"] }
    ];

    const results: string[] = [];
    
    for (const { name, cmd } of commands) {
      try {
        const process = new Deno.Command(cmd[0], {
          args: cmd.slice(1),
          stdout: "piped",
          stderr: "piped"
        });
        
        const { stdout } = await process.output();
        const output = new TextDecoder().decode(stdout).trim();
        results.push(`**${name}:**\n\`\`\`\n${output}\n\`\`\``);
      } catch (error) {
        results.push(`**${name}:** Error - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return results.join('\n\n');
  } catch (error) {
    throw new Error(`Failed to get uptime info: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}