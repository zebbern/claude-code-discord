import { SlashCommandBuilder } from "npm:discord.js@14.14.1";

// Fixed help command without choices to avoid Discord's 25-choice limit
export const helpCommand = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Display detailed help for all available commands')
  .addStringOption(option =>
    option
      .setName('command')
      .setDescription('Command name for detailed help (type: claude, system-info, processes, etc.)')
      .setRequired(false)
  );

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
  // NOTE: claude-templates command removed as requested
  // Template functionality is now handled through enhanced prompting
  /*
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
  */
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
  },
  "screenshot": {
    title: "📸 Screenshot Capture",
    description: "Capture and share a screenshot of the host machine's screen",
    usage: "/screenshot delay: [optional seconds]",
    examples: [
      "/screenshot",
      "/screenshot delay: 3",
      "/screenshot delay: 5"
    ],
    parameters: [
      { name: "delay", description: "Delay in seconds before capture (0-10)", required: false }
    ],
    notes: [
      "Only works when bot runs locally (not in Docker)",
      "Captures the entire screen of the host machine",
      "Useful for seeing what Claude is working on",
      "Not available in headless environments",
      "Supports Windows, macOS, and Linux with GUI"
    ]
  },
  "claude-explain": {
    title: "🧠 Claude Code Explanation",
    description: "Ask Claude to explain code, concepts, or errors in detail",
    usage: "/claude-explain content: [code/concept] detail_level: [basic/detailed/expert] include_examples: [true/false]",
    examples: [
      "/claude-explain content: const result = array.reduce((acc, item) => acc + item, 0)",
      "/claude-explain content: What is recursion? detail_level: basic include_examples: true",
      "/claude-explain content: TypeError: Cannot read property 'x' of undefined detail_level: detailed"
    ],
    parameters: [
      { name: "content", description: "Code, concept, or error message to explain", required: true },
      { name: "detail_level", description: "Level of explanation (basic, detailed, expert)", required: false },
      { name: "include_examples", description: "Include practical examples", required: false }
    ],
    notes: [
      "Adjusts explanation complexity based on detail level",
      "Examples help reinforce understanding",
      "Great for learning new concepts or debugging"
    ]
  },
  "claude-debug": {
    title: "🐛 Claude Code Debugging",
    description: "Get help debugging code issues and errors with Claude's assistance",
    usage: "/claude-debug error_or_code: [error/code] language: [language] context_files: [files]",
    examples: [
      "/claude-debug error_or_code: TypeError: Cannot read property 'length' of null language: javascript",
      "/claude-debug error_or_code: def broken_function(): ... language: python context_files: utils.py,main.py",
      "/claude-debug error_or_code: Segmentation fault (core dumped) language: cpp"
    ],
    parameters: [
      { name: "error_or_code", description: "Error message or problematic code", required: true },
      { name: "language", description: "Programming language for context", required: false },
      { name: "context_files", description: "Related files for debugging context", required: false }
    ],
    notes: [
      "Provides root cause analysis and solutions",
      "Includes prevention tips and best practices",
      "Context files help Claude understand the full picture"
    ]
  },
  "claude-optimize": {
    title: "⚡ Claude Code Optimization",
    description: "Get code optimization suggestions from Claude with specific focus areas",
    usage: "/claude-optimize code: [code] focus: [performance/readability/memory/security/all] preserve_functionality: [true/false]",
    examples: [
      "/claude-optimize code: for(let i=0; i<items.length; i++) {...} focus: performance",
      "/claude-optimize code: function complexLogic() {...} focus: readability preserve_functionality: true",
      "/claude-optimize code: const data = JSON.parse(userInput) focus: security"
    ],
    parameters: [
      { name: "code", description: "Code to optimize", required: true },
      { name: "focus", description: "Optimization focus (performance, readability, memory, security, all)", required: false },
      { name: "preserve_functionality", description: "Ensure functionality remains the same", required: false }
    ],
    notes: [
      "Provides optimized version with explanations",
      "Shows performance impact and trade-offs",
      "Preserves functionality by default"
    ]
  },
  "claude-review": {
    title: "🔍 Claude Code Review",
    description: "Get comprehensive code review from Claude with quality analysis",
    usage: "/claude-review code_or_file: [code/file] review_type: [quick/standard/deep] include_security: [true/false] include_performance: [true/false]",
    examples: [
      "/claude-review code_or_file: src/components/UserForm.tsx review_type: standard",
      "/claude-review code_or_file: function authenticate() {...} include_security: true",
      "/claude-review code_or_file: api/users.js review_type: deep include_security: true include_performance: true"
    ],
    parameters: [
      { name: "code_or_file", description: "Code to review or file path", required: true },
      { name: "review_type", description: "Review depth (quick, standard, deep)", required: false },
      { name: "include_security", description: "Include security vulnerability analysis", required: false },
      { name: "include_performance", description: "Include performance analysis", required: false }
    ],
    notes: [
      "Analyzes code quality and maintainability",
      "Identifies potential bugs and issues",
      "Provides specific recommendations with examples"
    ]
  },
  "claude-generate": {
    title: "🔨 Claude Code Generation",
    description: "Generate code, tests, or documentation with Claude's assistance",
    usage: "/claude-generate request: [description] type: [function/class/test/documentation/api/component] style: [clean/performance/functional/oop]",
    examples: [
      "/claude-generate request: Create a user authentication function type: function style: clean",
      "/claude-generate request: Generate unit tests for the Calculator class type: test",
      "/claude-generate request: Build a React form component with validation type: component style: functional"
    ],
    parameters: [
      { name: "request", description: "Description of what to generate", required: true },
      { name: "type", description: "Type of generation (function, class, test, documentation, api, component)", required: false },
      { name: "style", description: "Code style (clean, performance, functional, oop)", required: false }
    ],
    notes: [
      "Generates well-commented, production-ready code",
      "Includes error handling and type annotations",
      "Follows best practices for the specified style"
    ]
  },
  "claude-refactor": {
    title: "🔧 Claude Code Refactoring",
    description: "Refactor existing code with Claude's guidance and best practices",
    usage: "/claude-refactor code: [code] goal: [modernize/simplify/extract/typescript/performance] preserve_behavior: [true/false] add_tests: [true/false]",
    examples: [
      "/claude-refactor code: var oldFunction = function() {...} goal: modernize",
      "/claude-refactor code: complexFunction() {...} goal: simplify preserve_behavior: true",
      "/claude-refactor code: legacyCode.js goal: typescript add_tests: true"
    ],
    parameters: [
      { name: "code", description: "Code to refactor", required: true },
      { name: "goal", description: "Refactoring goal (modernize, simplify, extract, typescript, performance)", required: false },
      { name: "preserve_behavior", description: "Preserve exact behavior (default: true)", required: false },
      { name: "add_tests", description: "Generate tests for refactored code", required: false }
    ],
    notes: [
      "Maintains exact behavior while improving code quality",
      "Explains all changes and their benefits",
      "Can generate tests to verify refactoring"
    ]
  },
  "claude-learn": {
    title: "🎓 Claude Programming Tutor",
    description: "Learn programming concepts with Claude as your personal tutor",
    usage: "/claude-learn topic: [concept] level: [beginner/intermediate/advanced] include_exercises: [true/false] step_by_step: [true/false]",
    examples: [
      "/claude-learn topic: async/await in JavaScript level: intermediate include_exercises: true",
      "/claude-learn topic: recursion level: beginner step_by_step: true",
      "/claude-learn topic: design patterns level: advanced include_exercises: true"
    ],
    parameters: [
      { name: "topic", description: "Programming topic or concept to learn", required: true },
      { name: "level", description: "Your experience level (beginner, intermediate, advanced)", required: false },
      { name: "include_exercises", description: "Include practical exercises", required: false },
      { name: "step_by_step", description: "Break down into step-by-step guide", required: false }
    ],
    notes: [
      "Adapts explanations to your experience level",
      "Includes real-world examples and use cases",
      "Provides exercises for hands-on practice"
    ]
  },
  "claude-settings": {
    title: "⚙️ Claude Code Settings",
    description: "Manage Claude Code specific settings and preferences",
    usage: "/claude-settings action: [show/set-model/toggle-auto-system-info/toggle-auto-git-context/set-system-prompt] value: [optional]",
    examples: [
      "/claude-settings action: show",
      "/claude-settings action: set-model value: claude-sonnet-4",
      "/claude-settings action: toggle-auto-git-context",
      "/claude-settings action: set-system-prompt value: You are a helpful coding assistant"
    ],
    parameters: [
      { name: "action", description: "Setting action to perform", required: true },
      { name: "value", description: "New value for the setting", required: false }
    ],
    notes: [
      "Configure default model and context options",
      "Enable/disable automatic system info and git context",
      "Set custom system prompts for specialized tasks",
      "Note: Only model and context options are supported by Claude Code CLI"
    ]
  },
  "output-settings": {
    title: "🎨 Output Display Settings",
    description: "Configure output formatting and display preferences",
    usage: "/output-settings action: [show/toggle-code-highlighting/set-max-length/etc] value: [optional]",
    examples: [
      "/output-settings action: show",
      "/output-settings action: toggle-code-highlighting",
      "/output-settings action: set-max-length value: 5000"
    ],
    parameters: [
      { name: "action", description: "Output setting to configure", required: true },
      { name: "value", description: "New value for the setting", required: false }
    ],
    notes: [
      "Control syntax highlighting and pagination",
      "Set maximum output length and timestamp format",
      "Customize display preferences for better readability"
    ]
  },
  "quick-model": {
    title: "🚀 Quick Model Switch",
    description: "Quickly switch Claude model for your next conversation",
    usage: "/quick-model model: [model-id]",
    examples: [
      "/quick-model model: claude-sonnet-4",
      "/quick-model model: claude-sonnet-4-20250514?thinking_mode=true",
      "/quick-model model: claude-3-5-sonnet-20241022"
    ],
    parameters: [
      { name: "model", description: "Claude model to use", required: true }
    ],
    notes: [
      "Instantly switches to selected model",
      "Shows model capabilities and features",
      "Applies to all new conversations until changed again"
    ]
  },
  "fast": {
    title: "⚡ Fast Mode Toggle",
    description: "Toggle Opus 4.6 fast mode — 2.5x faster responses at higher per-token cost, same quality",
    usage: "/fast",
    examples: [
      "/fast"
    ],
    parameters: [],
    notes: [
      "Toggles fast mode on/off",
      "Fast mode uses the same Opus 4.6 with a speed-optimized API config",
      "2.5x faster responses, higher per-token cost ($30/$150 MTok)",
      "Takes effect on the next query (persists across sessions)",
      "Use /fast again to toggle back to standard mode"
    ]
  },
  "claude-info": {
    title: "ℹ️ Claude Info & Diagnostics",
    description: "Show Claude account info, available models, and MCP server status",
    usage: "/claude-info section: [account/models/mcp/all]",
    examples: [
      "/claude-info",
      "/claude-info section: account",
      "/claude-info section: models",
      "/claude-info section: mcp"
    ],
    parameters: [
      { name: "section", description: "Which info section to show (account, models, mcp, or all)", required: false }
    ],
    notes: [
      "Requires an active Claude session to query",
      "Shows account tier, rate limits, and usage",
      "Lists all available models with capabilities",
      "Displays MCP server connection status"
    ]
  },
  "rewind": {
    title: "⏪ Rewind File Changes",
    description: "Rewind file changes to a previous state (requires file checkpointing)",
    usage: "/rewind turn: [turn_number] dry_run: [true/false]",
    examples: [
      "/rewind",
      "/rewind turn: 5",
      "/rewind turn: 3 dry_run: true"
    ],
    parameters: [
      { name: "turn", description: "Turn number to rewind to (omit to see available turns)", required: false },
      { name: "dry_run", description: "Preview changes without modifying files", required: false }
    ],
    notes: [
      "Requires an active Claude session with file checkpointing enabled",
      "Use without arguments to list available checkpoint turns",
      "Use dry_run to preview which files would be affected",
      "Rewinding restores files to their state at the specified turn"
    ]
  },
  "claude-control": {
    title: "🎛️ Mid-Session Controls",
    description: "Control an active Claude query — interrupt, switch models, change permissions, or stop tasks",
    usage: "/claude-control action: [interrupt/set-model/set-permissions/stop-task/status] value: [optional]",
    examples: [
      "/claude-control action: interrupt",
      "/claude-control action: set-model value: claude-sonnet-4",
      "/claude-control action: set-permissions value: plan",
      "/claude-control action: stop-task value: task_id_here",
      "/claude-control action: status"
    ],
    parameters: [
      { name: "action", description: "Control action to perform", required: true },
      { name: "value", description: "Value for the action (model name, permission mode, or task ID)", required: false }
    ],
    notes: [
      "Requires an active Claude session to control",
      "Interrupt stops the current processing immediately",
      "Set-model switches the model mid-conversation",
      "Set-permissions changes the permission mode (plan, autoEdit, fullAuto, delegate, bypassPermissions)",
      "Stop-task halts a running background task by its ID",
      "Status shows active session info"
    ]
  }
};

export function createHelpHandlers(deps: HelpHandlerDeps) {
  return {
    // deno-lint-ignore no-explicit-any
    async onHelp(ctx: any, commandName?: string) {
      if (commandName) {
        if (COMMAND_HELP[commandName as keyof typeof COMMAND_HELP]) {
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
          // Command not found - show available commands
          const availableCommands = Object.keys(COMMAND_HELP).sort().join(', ');
          await ctx.reply({
            embeds: [{
              color: 0xff6600,
              title: '❓ Command Not Found',
              description: `Command "${commandName}" not found. Use \`/help\` without parameters to see all commands.`,
              fields: [
                { 
                  name: "📋 Available Commands", 
                  value: availableCommands, 
                  inline: false 
                },
                { 
                  name: "💡 Example", 
                  value: 'Try `/help command: claude-enhanced` for detailed help', 
                  inline: false 
                }
              ],
              timestamp: true
            }],
            ephemeral: true
          });
        }
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
                value: "`/claude` - Send prompts to Claude Code\n`/claude-enhanced` - Advanced Claude with options\n`/resume` - Resume conversation\n`/claude-cancel` - Cancel running operation\n`/fast` - Toggle fast mode (2.5x speed)",
                inline: false
              },
              {
                name: "🚀 Enhanced Claude Features",
                value: "`/claude-models` - List available models\n`/claude-sessions` - Manage sessions\n`/claude-context` - Preview context",
                inline: false
              },
              {
                name: "🧠 Claude Development Tools",
                value: "`/claude-explain` - Explain code/concepts\n`/claude-debug` - Debug assistance\n`/claude-optimize` - Code optimization\n`/claude-review` - Code review\n`/claude-generate` - Generate code\n`/claude-refactor` - Refactor code\n`/claude-learn` - Programming tutor",
                inline: false
              },
              {
                name: "🆕 New Features",
                value: "`/todos` - Development task management\n`/mcp` - Model Context Protocol servers\n`/agent` - Specialized AI agents",
                inline: false
              },
              {
                name: "⚙️ Advanced Settings",
                value: "`/settings` - Unified bot settings (NEW)\n`/claude-settings` - Claude preferences\n`/output-settings` - Display settings\n`/quick-model` - Switch Claude model\n`/fast` - Toggle fast mode",
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
                name: "📊 System Monitoring",
                value: "`/system-info` - System information\n`/processes` - Running processes\n`/system-resources` - Resource usage\n`/network-info` - Network details\n`/disk-usage` - Disk space\n`/uptime` - System uptime",
                inline: false
              },
              {
                name: "🔧 System Tools",
                value: "`/env-vars` - Environment variables\n`/system-logs` - System logs\n`/port-scan` - Check open ports\n`/service-status` - Service status",
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