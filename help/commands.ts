import { SlashCommandBuilder } from "npm:discord.js@14.14.1";

export const helpCommand = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Display detailed help for all available commands')
  .addStringOption(option =>
    option.setName('command')
      .setDescription('Get detailed help for a specific command')
      .setRequired(false)
      .addChoices(
        { name: 'claude', value: 'claude' },
        { name: 'continue', value: 'continue' },
        { name: 'claude-cancel', value: 'claude-cancel' },
        { name: 'git', value: 'git' },
        { name: 'worktree', value: 'worktree' },
        { name: 'worktree-list', value: 'worktree-list' },
        { name: 'worktree-remove', value: 'worktree-remove' },
        { name: 'worktree-bots', value: 'worktree-bots' },
        { name: 'worktree-kill', value: 'worktree-kill' },
        { name: 'shell', value: 'shell' },
        { name: 'shell-input', value: 'shell-input' },
        { name: 'shell-list', value: 'shell-list' },
        { name: 'shell-kill', value: 'shell-kill' },
        { name: 'status', value: 'status' },
        { name: 'settings', value: 'settings' },
        { name: 'pwd', value: 'pwd' },
        { name: 'shutdown', value: 'shutdown' },
        { name: 'claude-enhanced', value: 'claude-enhanced' },
        { name: 'claude-models', value: 'claude-models' },
        { name: 'claude-sessions', value: 'claude-sessions' },
        { name: 'claude-templates', value: 'claude-templates' },
        { name: 'claude-context', value: 'claude-context' },
        { name: 'system-info', value: 'system-info' },
        { name: 'processes', value: 'processes' },
        { name: 'system-resources', value: 'system-resources' },
        { name: 'network-info', value: 'network-info' },
        { name: 'disk-usage', value: 'disk-usage' },
        { name: 'env-vars', value: 'env-vars' },
        { name: 'system-logs', value: 'system-logs' },
        { name: 'port-scan', value: 'port-scan' },
        { name: 'service-status', value: 'service-status' },
        { name: 'uptime', value: 'uptime' }
      ));

export interface HelpHandlerDeps {
  workDir: string;
  repoName: string;
  branchName: string;
  categoryName: string;
}

// Detailed command information
export const COMMAND_HELP = {
  claude: {
    title: "🤖 Claude Code Integration",
    description: "Send prompts to Claude Code CLI for AI-powered development assistance",
    usage: "/claude prompt: [your message] session_id: [optional]",
    examples: [
      "/claude prompt: Help me fix this bug in my TypeScript code",
      "/claude prompt: Create a new React component session_id: abc123",
      "/claude prompt: Explain this error message"
    ],
    parameters: [
      { name: "prompt", description: "Your message or question for Claude", required: true },
      { name: "session_id", description: "Resume a previous conversation (optional)", required: false }
    ],
    notes: [
      "Creates a new session if no session_id is provided",
      "Sessions persist across bot restarts",
      "Supports streaming responses for real-time feedback"
    ]
  },
  continue: {
    title: "⏭️ Continue Conversation",
    description: "Continue the most recent Claude Code conversation in this directory",
    usage: "/continue prompt: [optional additional message]",
    examples: [
      "/continue",
      "/continue prompt: Can you also add error handling?",
      "/continue prompt: What about edge cases?"
    ],
    parameters: [
      { name: "prompt", description: "Additional message to add (optional)", required: false }
    ],
    notes: [
      "Automatically loads the latest conversation",
      "Uses continue mode to maintain context",
      "Fallback prompt: 'Please continue.' if no prompt provided"
    ]
  },
  "claude-cancel": {
    title: "❌ Cancel Claude Session",
    description: "Cancel any currently running Claude Code operation",
    usage: "/claude-cancel",
    examples: ["/claude-cancel"],
    parameters: [],
    notes: [
      "Immediately stops Claude Code execution",
      "Safe to use - no data loss",
      "Use when Claude is taking too long or stuck"
    ]
  },
  git: {
    title: "📂 Git Operations",
    description: "Execute Git commands in the current working directory",
    usage: "/git command: [git command without 'git' prefix]",
    examples: [
      "/git command: status",
      "/git command: add .",
      "/git command: commit -m \"Update feature\"",
      "/git command: push origin main",
      "/git command: log --oneline -5"
    ],
    parameters: [
      { name: "command", description: "Git command to execute (without 'git' prefix)", required: true }
    ],
    notes: [
      "All commands run in the bot's working directory",
      "Output is formatted and displayed in Discord",
      "Use with caution for destructive operations"
    ]
  },
  worktree: {
    title: "🌿 Create Git Worktree",
    description: "Create a new Git worktree and start a bot instance for it",
    usage: "/worktree branch: [branch name] ref: [optional reference]",
    examples: [
      "/worktree branch: feature-auth",
      "/worktree branch: hotfix-bug ref: v1.0.0",
      "/worktree branch: experimental ref: main"
    ],
    parameters: [
      { name: "branch", description: "Name of the branch for the worktree", required: true },
      { name: "ref", description: "Git reference to base the worktree on (defaults to branch name)", required: false }
    ],
    notes: [
      "Creates worktree in ../[branch-name] directory",
      "Automatically starts a new bot instance for the worktree",
      "Each worktree gets its own Discord channel",
      "Detects and reuses existing worktrees"
    ]
  },
  "worktree-list": {
    title: "📋 List Git Worktrees",
    description: "Display all Git worktrees in the repository",
    usage: "/worktree-list",
    examples: ["/worktree-list"],
    parameters: [],
    notes: [
      "Shows path and branch for each worktree",
      "Includes the main repository directory",
      "Useful for managing multiple feature branches"
    ]
  },
  "worktree-remove": {
    title: "🗑️ Remove Git Worktree",
    description: "Remove a Git worktree and clean up associated files",
    usage: "/worktree-remove branch: [branch name]",
    examples: [
      "/worktree-remove branch: feature-auth",
      "/worktree-remove branch: old-experiment"
    ],
    parameters: [
      { name: "branch", description: "Branch name of worktree to remove", required: true }
    ],
    notes: [
      "Permanently deletes the worktree directory",
      "Does not delete the Git branch itself",
      "Stop associated bot instances first with worktree-kill"
    ]
  },
  "worktree-bots": {
    title: "🤖 List Worktree Bots",
    description: "Show all running bot instances for worktrees",
    usage: "/worktree-bots",
    examples: ["/worktree-bots"],
    parameters: [],
    notes: [
      "Displays bot status, uptime, and paths",
      "Shows which branches have active bot instances",
      "Useful for monitoring resource usage"
    ]
  },
  "worktree-kill": {
    title: "💀 Kill Worktree Bot",
    description: "Terminate a specific worktree bot instance",
    usage: "/worktree-kill path: [full path to worktree]",
    examples: [
      "/worktree-kill path: /home/user/project/../feature-auth",
      "/worktree-kill path: /workspace/../experimental"
    ],
    parameters: [
      { name: "path", description: "Full path to the worktree directory", required: true }
    ],
    notes: [
      "Use worktree-bots to get the exact path",
      "Gracefully stops the bot process",
      "Does not affect the worktree files themselves"
    ]
  },
  shell: {
    title: "🖥️ Shell Commands",
    description: "Execute shell commands with interactive support",
    usage: "/shell command: [command] input: [optional initial input]",
    examples: [
      "/shell command: ls -la",
      "/shell command: python3 script.py",
      "/shell command: npm install",
      "/shell command: python3 input: print('Hello World')"
    ],
    parameters: [
      { name: "command", description: "Shell command to execute", required: true },
      { name: "input", description: "Initial standard input (optional)", required: false }
    ],
    notes: [
      "Supports long-running and interactive processes",
      "Each process gets a unique ID for management",
      "Use shell-input to send additional input",
      "Python processes use unbuffered output (-u flag)"
    ]
  },
  "shell-input": {
    title: "📝 Send Shell Input",
    description: "Send input to a running shell process",
    usage: "/shell-input id: [process id] text: [input text]",
    examples: [
      "/shell-input id: 1 text: exit()",
      "/shell-input id: 2 text: y",
      "/shell-input id: 3 text: print(2+2)"
    ],
    parameters: [
      { name: "id", description: "Process ID from shell command", required: true },
      { name: "text", description: "Text to send to the process", required: true }
    ],
    notes: [
      "Use shell-list to see running process IDs",
      "Automatically adds newline to input",
      "Output appears after a short delay",
      "Process must still be running to accept input"
    ]
  },
  "shell-list": {
    title: "📊 List Shell Processes",
    description: "Display all currently running shell processes",
    usage: "/shell-list",
    examples: ["/shell-list"],
    parameters: [],
    notes: [
      "Shows process ID, command, and start time",
      "Use IDs with shell-input or shell-kill",
      "Processes may complete and disappear from list"
    ]
  },
  "shell-kill": {
    title: "⚡ Kill Shell Process",
    description: "Terminate a running shell process",
    usage: "/shell-kill id: [process id]",
    examples: [
      "/shell-kill id: 1",
      "/shell-kill id: 5"
    ],
    parameters: [
      { name: "id", description: "Process ID to terminate", required: true }
    ],
    notes: [
      "Sends SIGTERM first, then SIGKILL if needed",
      "Use shell-list to get process IDs",
      "Graceful termination with 5-second timeout"
    ]
  },
  status: {
    title: "🔍 System Status",
    description: "Display comprehensive status of all bot components",
    usage: "/status",
    examples: ["/status"],
    parameters: [],
    notes: [
      "Shows Claude Code session status",
      "Displays Git branch and repository info",
      "Lists running shell processes count",
      "Shows worktree bot count and mention settings"
    ]
  },
  settings: {
    title: "⚙️ Bot Settings",
    description: "Manage bot configuration and preferences",
    usage: "/settings action: [action] value: [optional value]",
    examples: [
      "/settings action: show",
      "/settings action: mention-on value: 123456789012345678",
      "/settings action: mention-off"
    ],
    parameters: [
      { name: "action", description: "Setting action (show, mention-on, mention-off)", required: true },
      { name: "value", description: "User ID for mention-on action", required: false }
    ],
    notes: [
      "mention-on: Enable notifications for Claude completions",
      "mention-off: Disable notifications",
      "show: Display current settings",
      "User ID can be obtained by right-clicking username"
    ]
  },
  pwd: {
    title: "📍 Working Directory",
    description: "Display current working directory and bot information",
    usage: "/pwd",
    examples: ["/pwd"],
    parameters: [],
    notes: [
      "Shows full path to working directory",
      "Displays category, repository, and branch",
      "Useful for confirming bot context"
    ]
  },
  shutdown: {
    title: "🛑 Bot Shutdown",
    description: "Gracefully shutdown the bot and all associated processes",
    usage: "/shutdown",
    examples: ["/shutdown"],
    parameters: [],
    notes: [
      "Stops all running shell processes",
      "Kills all worktree bot instances",
      "Cancels any running Claude Code sessions",
      "Use with caution - requires manual restart"
    ]
  },
  "claude-enhanced": {
    title: "🚀 Enhanced Claude Code Integration",
    description: "Send prompts to Claude Code with advanced options and context",
    usage: "/claude-enhanced prompt: [message] model: [model] template: [template] ...",
    examples: [
      "/claude-enhanced prompt: Debug this error include_system_info: true",
      "/claude-enhanced prompt: Optimize this code template: optimize model: claude-3-5-sonnet-20241022",
      "/claude-enhanced prompt: Help with this file context_files: src/main.ts,README.md include_git_context: true"
    ],
    parameters: [
      { name: "prompt", description: "Your message or question for Claude", required: true },
      { name: "model", description: "Claude model to use (see /claude-models)", required: false },
      { name: "template", description: "Predefined template (debug, explain, optimize, etc.)", required: false },
      { name: "include_system_info", description: "Include system information in context", required: false },
      { name: "include_git_context", description: "Include git repository context", required: false },
      { name: "context_files", description: "Comma-separated list of files to include", required: false },
      { name: "session_id", description: "Resume a previous conversation", required: false }
    ],
    notes: [
      "Provides more context and options than regular /claude command",
      "Templates help with common tasks like debugging and optimization",
      "System and git context can provide valuable information to Claude",
      "Context files are automatically truncated if too large"
    ]
  },
  "claude-models": {
    title: "🤖 Available Claude Models",
    description: "List all available Claude models and their capabilities",
    usage: "/claude-models",
    examples: ["/claude-models"],
    parameters: [],
    notes: [
      "Shows model names, descriptions, and context windows",
      "Indicates recommended models for general use",
      "Use model IDs with /claude-enhanced command"
    ]
  },
  "claude-sessions": {
    title: "📋 Claude Session Management",
    description: "Manage and view Claude Code conversation sessions",
    usage: "/claude-sessions action: [action] session_id: [optional]",
    examples: [
      "/claude-sessions action: list",
      "/claude-sessions action: info session_id: session_123...",
      "/claude-sessions action: delete session_id: session_123...",
      "/claude-sessions action: cleanup"
    ],
    parameters: [
      { name: "action", description: "Action to perform (list, info, delete, cleanup)", required: true },
      { name: "session_id", description: "Session ID for info/delete actions", required: false }
    ],
    notes: [
      "list: Shows all active sessions with stats",
      "info: Detailed information about a specific session",
      "delete: Remove a specific session",
      "cleanup: Remove old sessions (>24 hours)"
    ]
  },
  "claude-templates": {
    title: "📝 Claude Code Templates",
    description: "Use predefined templates for common Claude Code tasks",
    usage: "/claude-templates template: [template] content: [your content]",
    examples: [
      "/claude-templates template: debug content: Error: Cannot read property 'x' of undefined",
      "/claude-templates template: explain content: const result = array.reduce((acc, item) => ...)",
      "/claude-templates template: optimize content: for(let i=0; i<items.length; i++) {...}"
    ],
    parameters: [
      { name: "template", description: "Template type (debug, explain, optimize, test, refactor, etc.)", required: true },
      { name: "content", description: "Your code or content to apply the template to", required: true }
    ],
    notes: [
      "Templates provide structured prompts for specific tasks",
      "Shows the combined prompt that you can copy and use",
      "Available templates: debug, explain, optimize, test, refactor, document, security, convert"
    ]
  },
  "claude-context": {
    title: "📋 Claude Context Preview",
    description: "Preview what context information would be sent to Claude",
    usage: "/claude-context include_system_info: [true/false] include_git_context: [true/false] ...",
    examples: [
      "/claude-context include_system_info: true",
      "/claude-context include_git_context: true context_files: package.json,src/main.ts",
      "/claude-context include_system_info: true include_git_context: true"
    ],
    parameters: [
      { name: "include_system_info", description: "Preview system information", required: false },
      { name: "include_git_context", description: "Preview git context", required: false },
      { name: "context_files", description: "Preview specific files", required: false }
    ],
    notes: [
      "Shows exactly what context would be included",
      "Helps you understand what information Claude will receive",
      "Useful for debugging context issues"
    ]
  },
  "system-info": {
    title: "🖥️ System Information",
    description: "Display comprehensive system information including OS, CPU, and memory",
    usage: "/system-info",
    examples: ["/system-info"],
    parameters: [],
    notes: [
      "Shows operating system details and architecture",
      "Displays CPU information and specifications", 
      "Includes memory usage and kernel version",
      "Useful for debugging environment-specific issues"
    ]
  },
  "processes": {
    title: "⚙️ Running Processes",
    description: "List currently running processes on the system",
    usage: "/processes filter: [optional] limit: [number]",
    examples: [
      "/processes",
      "/processes filter: node limit: 10",
      "/processes filter: python",
      "/processes limit: 50"
    ],
    parameters: [
      { name: "filter", description: "Filter processes by name", required: false },
      { name: "limit", description: "Maximum number of processes to show (default: 20)", required: false }
    ],
    notes: [
      "Shows process ID, CPU usage, memory usage, and command",
      "Filter helps find specific applications or services",
      "Limited output to prevent overwhelming Discord messages"
    ]
  },
  "system-resources": {
    title: "📊 System Resources",
    description: "Display current system resource usage (CPU, Memory, Load)",
    usage: "/system-resources",
    examples: ["/system-resources"],
    parameters: [],
    notes: [
      "Shows real-time memory usage and availability",
      "Displays CPU usage and load averages",
      "Includes system uptime and load statistics",
      "Useful for monitoring system performance"
    ]
  },
  "network-info": {
    title: "🌐 Network Information", 
    description: "Display network interfaces, connections, and routing information",
    usage: "/network-info",
    examples: ["/network-info"],
    parameters: [],
    notes: [
      "Shows all network interfaces and their IP addresses",
      "Lists active network connections and listening ports",
      "Displays routing table information",
      "Fallback to ifconfig if ip command is not available"
    ]
  },
  "disk-usage": {
    title: "💽 Disk Space Usage",
    description: "Show disk space usage for all mounted drives and filesystems",
    usage: "/disk-usage",
    examples: ["/disk-usage"],
    parameters: [],
    notes: [
      "Shows used and available space for each filesystem",
      "Displays usage percentages and mount points",
      "Helps identify storage issues and capacity planning",
      "Human-readable format (GB, MB, etc.)"
    ]
  },
  "env-vars": {
    title: "🔧 Environment Variables",
    description: "List environment variables with optional filtering",
    usage: "/env-vars filter: [optional]",
    examples: [
      "/env-vars",
      "/env-vars filter: PATH",
      "/env-vars filter: NODE",
      "/env-vars filter: DISCORD"
    ],
    parameters: [
      { name: "filter", description: "Filter by variable name (case insensitive)", required: false }
    ],
    notes: [
      "Sensitive values (passwords, tokens, keys) are masked for security",
      "Filter helps find specific environment variables",
      "Useful for debugging configuration issues",
      "Shows all environment variables if no filter specified"
    ]
  },
  "system-logs": {
    title: "📋 System Logs",
    description: "Display recent system logs with optional service filtering",
    usage: "/system-logs lines: [number] service: [service name]",
    examples: [
      "/system-logs",
      "/system-logs lines: 100",
      "/system-logs service: nginx lines: 50",
      "/system-logs service: docker"
    ],
    parameters: [
      { name: "lines", description: "Number of lines to show (default: 50)", required: false },
      { name: "service", description: "Specific service to filter logs", required: false }
    ],
    notes: [
      "Uses journalctl for systemd systems",
      "Falls back to dmesg if journalctl is not available",
      "Service filtering shows logs for specific systemd services",
      "Timestamps included for log correlation"
    ]
  },
  "port-scan": {
    title: "🔍 Port Scanner",
    description: "Check which ports are open and listening on a host",
    usage: "/port-scan host: [hostname] ports: [port range]",
    examples: [
      "/port-scan",
      "/port-scan host: localhost ports: 80,443",
      "/port-scan ports: 8000-9000",
      "/port-scan host: example.com ports: 22,80,443"
    ],
    parameters: [
      { name: "host", description: "Host to scan (default: localhost)", required: false },
      { name: "ports", description: "Specific ports (80,443) or range (8000-9000)", required: false }
    ],
    notes: [
      "Shows listening ports and associated services",
      "Supports individual ports (80,443) or ranges (8000-9000)",
      "Uses ss or netstat for port information",
      "Helpful for debugging connectivity issues"
    ]
  },
  "service-status": {
    title: "🔧 Service Status",
    description: "Check the status of system services using systemctl",
    usage: "/service-status service: [service name]",
    examples: [
      "/service-status",
      "/service-status service: nginx",
      "/service-status service: docker",
      "/service-status service: ssh"
    ],
    parameters: [
      { name: "service", description: "Specific service name to check", required: false }
    ],
    notes: [
      "Shows all services if no service specified",
      "Displays service state (active, inactive, failed)",
      "Includes service uptime and recent status changes",
      "Works with systemd-based systems"
    ]
  },
  "uptime": {
    title: "⏰ System Uptime",
    description: "Display system uptime, boot time, and load averages",
    usage: "/uptime",
    examples: ["/uptime"],
    parameters: [],
    notes: [
      "Shows how long the system has been running",
      "Displays system boot time and date",
      "Includes current load averages (1, 5, 15 minutes)",
      "Useful for monitoring system stability"
    ]
  }
};

export function createHelpHandlers(deps: HelpHandlerDeps) {
  return {
    // deno-lint-ignore no-explicit-any
    async onHelp(ctx: any, commandName?: string) {
      if (commandName && COMMAND_HELP[commandName as keyof typeof COMMAND_HELP]) {
        // Show detailed help for specific command
        const help = COMMAND_HELP[commandName as keyof typeof COMMAND_HELP];
        
        const fields = [
          { name: "📝 Usage", value: `\`${help.usage}\``, inline: false }
        ];
        
        if (help.parameters.length > 0) {
          const paramText = help.parameters.map(p => 
            `• **${p.name}** ${p.required ? '(required)' : '(optional)'}: ${p.description}`
          ).join('\n');
          fields.push({ name: "🔧 Parameters", value: paramText, inline: false });
        }
        
        if (help.examples.length > 0) {
          const exampleText = help.examples.map(ex => `\`${ex}\``).join('\n');
          fields.push({ name: "💡 Examples", value: exampleText, inline: false });
        }
        
        if (help.notes.length > 0) {
          const noteText = help.notes.map(note => `• ${note}`).join('\n');
          fields.push({ name: "📌 Notes", value: noteText, inline: false });
        }
        
        await ctx.reply({
          embeds: [{
            color: 0x0099ff,
            title: help.title,
            description: help.description,
            fields,
            timestamp: true
          }],
          ephemeral: true
        });
      } else {
        // Show general help with all commands
        await ctx.reply({
          embeds: [{
            color: 0x00ff00,
            title: "🤖 Claude Code Discord Bot - Help",
            description: `Bot for **${deps.repoName}** (${deps.branchName} branch)\n\nUse \`/help command:[name]\` for detailed help on specific commands.`,
            fields: [
              {
                name: "🤖 Claude Code Commands",
                value: "`/claude` - Send prompts to Claude Code\n`/continue` - Continue conversation\n`/claude-cancel` - Cancel running operation",
                inline: false
              },
              {
                name: "📂 Git Commands", 
                value: "`/git` - Execute git commands\n`/worktree` - Create worktrees\n`/worktree-list` - List worktrees\n`/worktree-remove` - Remove worktree\n`/worktree-bots` - List bot instances\n`/worktree-kill` - Kill bot instance",
                inline: false
              },
              {
                name: "🖥️ Shell Commands",
                value: "`/shell` - Execute shell commands\n`/shell-input` - Send input to process\n`/shell-list` - List running processes\n`/shell-kill` - Kill process",
                inline: false
              },
              {
                name: "⚙️ Utility Commands",
                value: "`/status` - Show system status\n`/settings` - Manage bot settings\n`/pwd` - Show working directory\n`/shutdown` - Shutdown bot",
                inline: false
              },
              {
                name: "💡 Quick Tips",
                value: "• Use buttons on Claude responses for quick actions\n• Shell processes support interactive input\n• Each worktree gets its own bot instance\n• Session IDs persist across restarts",
                inline: false
              }
            ],
            footer: { text: `Working Directory: ${deps.workDir}` },
            timestamp: true
          }],
          ephemeral: true
        });
      }
    }
  };
}