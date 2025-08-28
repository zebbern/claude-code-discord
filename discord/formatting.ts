// Enhanced formatting utilities for Discord messages
export interface FormatOptions {
  maxLength?: number;
  truncateAt?: number;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  language?: string;
  wrapInCodeBlock?: boolean;
}

// Enhanced text truncation with context preservation
export function formatText(text: string, options: FormatOptions = {}): {
  formatted: string;
  wasTruncated: boolean;
  originalLength: number;
  truncatedLength: number;
} {
  const {
    maxLength = 4000,
    truncateAt = 3800,
    showLineNumbers = false,
    highlightLines = [],
    language = '',
    wrapInCodeBlock = false
  } = options;

  let processed = text;
  const originalLength = processed.length;

  // Add line numbers if requested
  if (showLineNumbers) {
    const lines = processed.split('\n');
    processed = lines.map((line, index) => {
      const lineNum = (index + 1).toString().padStart(3, ' ');
      const highlight = highlightLines.includes(index + 1) ? '► ' : '  ';
      return `${lineNum}${highlight}${line}`;
    }).join('\n');
  }

  // Wrap in code block if requested
  if (wrapInCodeBlock) {
    const lang = language ? language : '';
    processed = `\`\`\`${lang}\n${processed}\n\`\`\``;
  }

  // Truncate if necessary
  let wasTruncated = false;
  if (processed.length > maxLength) {
    wasTruncated = true;
    processed = processed.substring(0, truncateAt) + '\n... (truncated)';
  }

  return {
    formatted: processed,
    wasTruncated,
    originalLength,
    truncatedLength: processed.length
  };
}

// Format file content with syntax highlighting hints
export function formatFileContent(
  filePath: string,
  content: string,
  options: Partial<FormatOptions> = {}
): {
  formatted: string;
  wasTruncated: boolean;
  fileType: string;
  language: string;
} {
  const fileExt = filePath.split('.').pop()?.toLowerCase() || '';
  
  const languageMap: Record<string, { lang: string; type: string }> = {
    'ts': { lang: 'typescript', type: 'TypeScript' },
    'tsx': { lang: 'typescript', type: 'React TypeScript' },
    'js': { lang: 'javascript', type: 'JavaScript' },
    'jsx': { lang: 'javascript', type: 'React JavaScript' },
    'py': { lang: 'python', type: 'Python' },
    'rs': { lang: 'rust', type: 'Rust' },
    'go': { lang: 'go', type: 'Go' },
    'java': { lang: 'java', type: 'Java' },
    'cpp': { lang: 'cpp', type: 'C++' },
    'c': { lang: 'c', type: 'C' },
    'cs': { lang: 'csharp', type: 'C#' },
    'php': { lang: 'php', type: 'PHP' },
    'rb': { lang: 'ruby', type: 'Ruby' },
    'swift': { lang: 'swift', type: 'Swift' },
    'kt': { lang: 'kotlin', type: 'Kotlin' },
    'dart': { lang: 'dart', type: 'Dart' },
    'html': { lang: 'html', type: 'HTML' },
    'css': { lang: 'css', type: 'CSS' },
    'scss': { lang: 'scss', type: 'SCSS' },
    'sass': { lang: 'sass', type: 'Sass' },
    'less': { lang: 'less', type: 'Less' },
    'json': { lang: 'json', type: 'JSON' },
    'xml': { lang: 'xml', type: 'XML' },
    'yaml': { lang: 'yaml', type: 'YAML' },
    'yml': { lang: 'yaml', type: 'YAML' },
    'toml': { lang: 'toml', type: 'TOML' },
    'ini': { lang: 'ini', type: 'INI' },
    'md': { lang: 'markdown', type: 'Markdown' },
    'sh': { lang: 'bash', type: 'Shell Script' },
    'bash': { lang: 'bash', type: 'Bash Script' },
    'zsh': { lang: 'zsh', type: 'Zsh Script' },
    'ps1': { lang: 'powershell', type: 'PowerShell' },
    'bat': { lang: 'batch', type: 'Batch Script' },
    'sql': { lang: 'sql', type: 'SQL' },
    'dockerfile': { lang: 'dockerfile', type: 'Dockerfile' },
    'gitignore': { lang: 'gitignore', type: 'Git Ignore' }
  };

  const fileInfo = languageMap[fileExt] || { lang: 'text', type: 'Text File' };
  
  const formatOptions: FormatOptions = {
    language: fileInfo.lang,
    wrapInCodeBlock: true,
    ...options
  };

  const result = formatText(content, formatOptions);

  return {
    ...result,
    fileType: fileInfo.type,
    language: fileInfo.lang
  };
}

// Format shell command output with enhanced readability
export function formatShellOutput(
  command: string,
  output: string,
  exitCode: number = 0,
  options: Partial<FormatOptions> = {}
): {
  formatted: string;
  wasTruncated: boolean;
  isError: boolean;
} {
  const isError = exitCode !== 0;
  
  const formatOptions: FormatOptions = {
    language: 'bash',
    wrapInCodeBlock: true,
    maxLength: isError ? 3000 : 4000, // Shorter for errors to leave room for error context
    ...options
  };

  // Clean up common shell output issues
  let cleanOutput = output
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\r/g, '\n') // Handle remaining carriage returns
    .replace(/\x1b\[[0-9;]*m/g, '') // Remove ANSI color codes
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '') // Remove other ANSI escape sequences
    .trim();

  // Add command context if it's not too long
  if (command.length < 100) {
    cleanOutput = `$ ${command}\n${cleanOutput}`;
  }

  const result = formatText(cleanOutput, formatOptions);

  return {
    ...result,
    isError
  };
}

// Format Git command output with enhanced parsing
export function formatGitOutput(
  command: string,
  output: string,
  options: Partial<FormatOptions> = {}
): {
  formatted: string;
  wasTruncated: boolean;
  isError: boolean;
  outputType: 'status' | 'log' | 'diff' | 'branch' | 'generic';
} {
  const isError = output.toLowerCase().includes('error') || 
                   output.toLowerCase().includes('fatal') ||
                   output.toLowerCase().includes('failed');

  // Detect git command type for specialized formatting
  let outputType: 'status' | 'log' | 'diff' | 'branch' | 'generic' = 'generic';
  
  if (command.includes('status')) {
    outputType = 'status';
  } else if (command.includes('log')) {
    outputType = 'log';
  } else if (command.includes('diff')) {
    outputType = 'diff';
  } else if (command.includes('branch')) {
    outputType = 'branch';
  }

  // Choose language based on output type
  let language = 'bash';
  if (outputType === 'diff') {
    language = 'diff';
  } else if (outputType === 'log' || outputType === 'status') {
    language = 'git';
  }

  const formatOptions: FormatOptions = {
    language,
    wrapInCodeBlock: true,
    maxLength: isError ? 3000 : 4000,
    ...options
  };

  // Add command context
  let processedOutput = output;
  if (command.length < 100) {
    processedOutput = `git ${command}\n${output}`;
  }

  const result = formatText(processedOutput, formatOptions);

  return {
    ...result,
    isError,
    outputType
  };
}

// Format error messages with enhanced readability
export function formatError(
  error: Error | string,
  context?: string,
  options: Partial<FormatOptions> = {}
): {
  formatted: string;
  wasTruncated: boolean;
  errorType: string;
} {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  let errorType = 'Generic Error';
  
  // Detect common error types
  if (errorMessage.includes('ENOENT')) {
    errorType = 'File Not Found';
  } else if (errorMessage.includes('EACCES')) {
    errorType = 'Permission Denied';
  } else if (errorMessage.includes('ECONNREFUSED')) {
    errorType = 'Connection Refused';
  } else if (errorMessage.includes('timeout')) {
    errorType = 'Timeout Error';
  } else if (errorMessage.includes('fetch')) {
    errorType = 'Network Error';
  } else if (error instanceof Error) {
    errorType = error.constructor.name;
  }

  let content = errorMessage;
  
  if (context) {
    content = `Context: ${context}\n\nError: ${content}`;
  }
  
  if (errorStack && errorStack !== errorMessage) {
    content += `\n\nStack Trace:\n${errorStack}`;
  }

  const formatOptions: FormatOptions = {
    language: 'text',
    wrapInCodeBlock: true,
    maxLength: 3500, // Leave room for error embed formatting
    ...options
  };

  const result = formatText(content, formatOptions);

  return {
    ...result,
    errorType
  };
}

// Utility to detect if content needs formatting
export function needsFormatting(content: string): {
  needsCodeBlock: boolean;
  suggestedLanguage: string;
  contentType: 'code' | 'log' | 'data' | 'text';
} {
  const lines = content.split('\n');
  
  // Check for code-like patterns
  const codePatterns = [
    /^(import|export|from|const|let|var|function|class|interface|type)\s/,
    /^(def|class|import|from|if __name__)/,
    /^(use|fn|let|struct|impl|trait)/,
    /^(package|import|public|private|class|interface)/,
    /^\s*[\{\}\[\]]/,
    /^\s*[<>]/
  ];

  // Check for log patterns
  const logPatterns = [
    /^\d{4}-\d{2}-\d{2}/, // Date
    /^(ERROR|WARN|INFO|DEBUG|TRACE)/, // Log levels
    /^\[\d{2}:\d{2}:\d{2}\]/, // Timestamps
    /^(FAIL|PASS|SKIP)/ // Test results
  ];

  let codeScore = 0;
  let logScore = 0;
  
  for (const line of lines.slice(0, 10)) { // Check first 10 lines
    if (codePatterns.some(pattern => pattern.test(line))) {
      codeScore++;
    }
    if (logPatterns.some(pattern => pattern.test(line))) {
      logScore++;
    }
  }

  const needsCodeBlock = content.length > 50 || codeScore > 0 || logScore > 0;
  
  let contentType: 'code' | 'log' | 'data' | 'text' = 'text';
  let suggestedLanguage = 'text';
  
  if (logScore > codeScore) {
    contentType = 'log';
    suggestedLanguage = 'log';
  } else if (codeScore > 0) {
    contentType = 'code';
    suggestedLanguage = 'javascript'; // Default code language
  } else if (content.startsWith('{') || content.startsWith('[')) {
    contentType = 'data';
    suggestedLanguage = 'json';
  }

  return {
    needsCodeBlock,
    suggestedLanguage,
    contentType
  };
}

// Create a well-formatted embed with automatic formatting detection
export function createFormattedEmbed(
  title: string,
  content: string,
  color: number = 0x0099ff,
  options: Partial<FormatOptions> = {}
): {
  embed: {
    color: number;
    title: string;
    description: string;
    timestamp: boolean;
    footer?: { text: string };
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
  };
  wasTruncated: boolean;
} {
  const formatting = needsFormatting(content);
  
  const formatOptions: FormatOptions = {
    wrapInCodeBlock: formatting.needsCodeBlock,
    language: formatting.suggestedLanguage,
    ...options
  };

  const result = formatText(content, formatOptions);
  
  const embed = {
    color,
    title,
    description: result.formatted,
    timestamp: true,
    footer: result.wasTruncated ? { 
      text: `Content truncated (${result.originalLength} → ${result.truncatedLength} chars)` 
    } : undefined
  };

  return {
    embed,
    wasTruncated: result.wasTruncated
  };
}