import { SlashCommandBuilder } from "npm:discord.js@14.14.1";
import { CLAUDE_MODELS, CLAUDE_TEMPLATES } from "./enhanced-client.ts";

export const additionalClaudeCommands = [
  new SlashCommandBuilder()
    .setName('claude-explain')
    .setDescription('Ask Claude to explain code, concepts, or errors in detail')
    .addStringOption(option =>
      option.setName('content')
        .setDescription('Code, concept, or error to explain')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('detail_level')
        .setDescription('Level of detail for explanation')
        .setRequired(false)
        .addChoices(
          { name: 'Basic - Simple overview', value: 'basic' },
          { name: 'Detailed - In-depth explanation', value: 'detailed' },
          { name: 'Expert - Advanced technical details', value: 'expert' }
        ))
    .addBooleanOption(option =>
      option.setName('include_examples')
        .setDescription('Include code examples in explanation')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('claude-debug')
    .setDescription('Get help debugging code issues and errors')
    .addStringOption(option =>
      option.setName('error_or_code')
        .setDescription('Error message or problematic code')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('language')
        .setDescription('Programming language')
        .setRequired(false)
        .addChoices(
          { name: 'TypeScript', value: 'typescript' },
          { name: 'JavaScript', value: 'javascript' },
          { name: 'Python', value: 'python' },
          { name: 'Rust', value: 'rust' },
          { name: 'Go', value: 'go' },
          { name: 'Java', value: 'java' },
          { name: 'C++', value: 'cpp' },
          { name: 'Other', value: 'other' }
        ))
    .addStringOption(option =>
      option.setName('context_files')
        .setDescription('Related files for debugging context')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('claude-optimize')
    .setDescription('Get code optimization suggestions from Claude')
    .addStringOption(option =>
      option.setName('code')
        .setDescription('Code to optimize')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('focus')
        .setDescription('Optimization focus area')
        .setRequired(false)
        .addChoices(
          { name: 'Performance - Speed and efficiency', value: 'performance' },
          { name: 'Readability - Code clarity and maintainability', value: 'readability' },
          { name: 'Memory - Memory usage optimization', value: 'memory' },
          { name: 'Security - Security best practices', value: 'security' },
          { name: 'All - Comprehensive optimization', value: 'all' }
        ))
    .addBooleanOption(option =>
      option.setName('preserve_functionality')
        .setDescription('Ensure functionality remains exactly the same')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('claude-review')
    .setDescription('Get comprehensive code review from Claude')
    .addStringOption(option =>
      option.setName('code_or_file')
        .setDescription('Code to review or file path')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('review_type')
        .setDescription('Type of code review')
        .setRequired(false)
        .addChoices(
          { name: 'Quick - Basic issues and suggestions', value: 'quick' },
          { name: 'Standard - Thorough review with recommendations', value: 'standard' },
          { name: 'Deep - Comprehensive analysis with architecture review', value: 'deep' }
        ))
    .addBooleanOption(option =>
      option.setName('include_security')
        .setDescription('Include security vulnerability analysis')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('include_performance')
        .setDescription('Include performance analysis')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('claude-generate')
    .setDescription('Generate code, tests, or documentation with Claude')
    .addStringOption(option =>
      option.setName('request')
        .setDescription('What to generate (function, class, test, documentation, etc.)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of generation')
        .setRequired(false)
        .addChoices(
          { name: 'Function - Generate a function', value: 'function' },
          { name: 'Class - Generate a class', value: 'class' },
          { name: 'Test - Generate unit tests', value: 'test' },
          { name: 'Documentation - Generate docs', value: 'documentation' },
          { name: 'API - Generate API endpoints', value: 'api' },
          { name: 'Component - Generate UI component', value: 'component' }
        ))
    .addStringOption(option =>
      option.setName('style')
        .setDescription('Code style and conventions')
        .setRequired(false)
        .addChoices(
          { name: 'Clean Code - Focus on readability', value: 'clean' },
          { name: 'Performance - Focus on efficiency', value: 'performance' },
          { name: 'Functional - Functional programming style', value: 'functional' },
          { name: 'OOP - Object-oriented style', value: 'oop' }
        )),

  new SlashCommandBuilder()
    .setName('claude-refactor')
    .setDescription('Refactor existing code with Claude\'s assistance')
    .addStringOption(option =>
      option.setName('code')
        .setDescription('Code to refactor')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('goal')
        .setDescription('Refactoring goal')
        .setRequired(false)
        .addChoices(
          { name: 'Modernize - Update to modern patterns', value: 'modernize' },
          { name: 'Simplify - Reduce complexity', value: 'simplify' },
          { name: 'Extract - Extract reusable components', value: 'extract' },
          { name: 'TypeScript - Convert to TypeScript', value: 'typescript' },
          { name: 'Performance - Improve performance', value: 'performance' }
        ))
    .addBooleanOption(option =>
      option.setName('preserve_behavior')
        .setDescription('Preserve exact behavior (default: true)')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('add_tests')
        .setDescription('Generate tests for refactored code')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('claude-learn')
    .setDescription('Learn programming concepts with Claude as your tutor')
    .addStringOption(option =>
      option.setName('topic')
        .setDescription('Programming topic or concept to learn')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('level')
        .setDescription('Your experience level')
        .setRequired(false)
        .addChoices(
          { name: 'Beginner - New to programming', value: 'beginner' },
          { name: 'Intermediate - Some experience', value: 'intermediate' },
          { name: 'Advanced - Experienced developer', value: 'advanced' }
        ))
    .addBooleanOption(option =>
      option.setName('include_exercises')
        .setDescription('Include practical exercises')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('step_by_step')
        .setDescription('Break down into step-by-step guide')
        .setRequired(false))
];

export interface AdditionalClaudeHandlerDeps {
  workDir: string;
  getClaudeController: () => AbortController | null;
  setClaudeController: (controller: AbortController | null) => void;
  sendClaudeMessages: (messages: any[]) => Promise<void>;
  sessionManager: any;
  crashHandler: any;
  settings: any;
  /** Get current runtime options from unified settings (thinking, operation, proxy) */
  getQueryOptions?: () => import("./client.ts").ClaudeModelOptions;
}

export function createAdditionalClaudeHandlers(deps: AdditionalClaudeHandlerDeps) {
  const { workDir, sessionManager, crashHandler, sendClaudeMessages, settings } = deps;

  // Helper: merge runtime options (thinking, operation, proxy) into enhanced query options
  function getRuntimeOpts() {
    const opts = deps.getQueryOptions?.() || {};
    return {
      permissionMode: opts.permissionMode,
      thinking: opts.thinking,
      effort: opts.effort,
      maxBudgetUsd: opts.maxBudgetUsd,
      extraEnv: opts.extraEnv,
    };
  }

  return {
    async onClaudeExplain(
      ctx: any,
      content: string,
      detailLevel?: string,
      includeExamples?: boolean
    ) {
      try {
        await ctx.deferReply();
        
        let prompt = `Please explain the following in ${detailLevel || 'detailed'} terms`;
        
        if (includeExamples) {
          prompt += `, and include practical code examples`;
        }
        
        prompt += `:\n\n${content}`;

        const { enhancedClaudeQuery } = await import("./enhanced-client.ts");
        
        // Cancel any existing session
        const existingController = deps.getClaudeController();
        if (existingController) {
          existingController.abort();
        }

        const controller = new AbortController();
        deps.setClaudeController(controller);

        const result = await enhancedClaudeQuery(
          prompt,
          {
            workDir,
            model: settings.defaultModel,
            includeSystemInfo: false,
            includeGitContext: false,
            ...getRuntimeOpts(),
          },
          controller,
          undefined,
          undefined,
          async (jsonData) => {
            const { convertToClaudeMessages } = await import("./message-converter.ts");
            const claudeMessages = convertToClaudeMessages(jsonData);
            if (claudeMessages.length > 0) {
              sendClaudeMessages(claudeMessages).catch(() => {});
            }
          },
          false
        );

        deps.setClaudeController(null);
        return result;
      } catch (error) {
        await crashHandler.reportCrash('claude', error instanceof Error ? error : new Error(String(error)), 'explain', 'Claude explain command');
        throw error;
      }
    },

    async onClaudeDebug(
      ctx: any,
      errorOrCode: string,
      language?: string,
      contextFiles?: string
    ) {
      try {
        await ctx.deferReply();
        
        let prompt = `Please help me debug this ${language ? `${language} ` : ''}issue:\n\n${errorOrCode}`;
        
        if (contextFiles) {
          prompt += `\n\nRelated files: ${contextFiles}`;
        }
        
        prompt += '\n\nPlease provide:\n1. Root cause analysis\n2. Step-by-step solution\n3. Prevention tips\n4. Code examples if applicable';

        const { enhancedClaudeQuery } = await import("./enhanced-client.ts");
        
        // Cancel any existing session
        const existingController = deps.getClaudeController();
        if (existingController) {
          existingController.abort();
        }

        const controller = new AbortController();
        deps.setClaudeController(controller);

        const contextFilesList = contextFiles ? 
          contextFiles.split(',').map(f => f.trim()).filter(f => f.length > 0) : 
          undefined;

        const result = await enhancedClaudeQuery(
          prompt,
          {
            workDir,
            model: settings.defaultModel,
            includeSystemInfo: settings.autoIncludeSystemInfo,
            includeGitContext: settings.autoIncludeGitContext,
            contextFiles: contextFilesList,
            ...getRuntimeOpts(),
          },
          controller,
          undefined,
          undefined,
          async (jsonData) => {
            const { convertToClaudeMessages } = await import("./message-converter.ts");
            const claudeMessages = convertToClaudeMessages(jsonData);
            if (claudeMessages.length > 0) {
              sendClaudeMessages(claudeMessages).catch(() => {});
            }
          },
          false
        );

        deps.setClaudeController(null);
        return result;
      } catch (error) {
        await crashHandler.reportCrash('claude', error instanceof Error ? error : new Error(String(error)), 'debug', 'Claude debug command');
        throw error;
      }
    },

    async onClaudeOptimize(
      ctx: any,
      code: string,
      focus?: string,
      preserveFunctionality?: boolean
    ) {
      try {
        await ctx.deferReply();
        
        let prompt = `Please optimize this code`;
        
        if (focus) {
          prompt += ` with focus on ${focus}`;
        }
        
        if (preserveFunctionality !== false) {
          prompt += `, ensuring functionality remains exactly the same`;
        }
        
        prompt += `:\n\n${code}\n\nPlease provide:\n1. Optimized version\n2. Explanation of changes\n3. Performance impact\n4. Any trade-offs`;

        const { enhancedClaudeQuery } = await import("./enhanced-client.ts");
        
        // Cancel any existing session
        const existingController = deps.getClaudeController();
        if (existingController) {
          existingController.abort();
        }

        const controller = new AbortController();
        deps.setClaudeController(controller);

        const result = await enhancedClaudeQuery(
          prompt,
          {
            workDir,
            model: settings.defaultModel,
            includeSystemInfo: false,
            includeGitContext: settings.autoIncludeGitContext,
            ...getRuntimeOpts(),
          },
          controller,
          undefined,
          undefined,
          async (jsonData) => {
            const { convertToClaudeMessages } = await import("./message-converter.ts");
            const claudeMessages = convertToClaudeMessages(jsonData);
            if (claudeMessages.length > 0) {
              sendClaudeMessages(claudeMessages).catch(() => {});
            }
          },
          false
        );

        deps.setClaudeController(null);
        return result;
      } catch (error) {
        await crashHandler.reportCrash('claude', error instanceof Error ? error : new Error(String(error)), 'optimize', 'Claude optimize command');
        throw error;
      }
    },

    async onClaudeReview(
      ctx: any,
      codeOrFile: string,
      reviewType?: string,
      includeSecurity?: boolean,
      includePerformance?: boolean
    ) {
      try {
        await ctx.deferReply();
        
        let prompt = `Please perform a ${reviewType || 'standard'} code review of:\n\n${codeOrFile}\n\nPlease analyze:`;
        
        const analysisPoints = [
          '• Code quality and maintainability',
          '• Best practices adherence',
          '• Potential bugs and issues',
          '• Code structure and organization'
        ];
        
        if (includeSecurity) {
          analysisPoints.push('• Security vulnerabilities');
        }
        
        if (includePerformance) {
          analysisPoints.push('• Performance optimizations');
        }
        
        prompt += `\n${analysisPoints.join('\n')}\n\nProvide specific recommendations with examples where applicable.`;

        const { enhancedClaudeQuery } = await import("./enhanced-client.ts");
        
        // Cancel any existing session
        const existingController = deps.getClaudeController();
        if (existingController) {
          existingController.abort();
        }

        const controller = new AbortController();
        deps.setClaudeController(controller);

        // Check if codeOrFile is a file path
        const isFilePath = codeOrFile.includes('/') || codeOrFile.includes('\\') || codeOrFile.includes('.');
        const contextFiles = isFilePath ? [codeOrFile] : undefined;

        const result = await enhancedClaudeQuery(
          prompt,
          {
            workDir,
            model: settings.defaultModel,
            includeSystemInfo: false,
            includeGitContext: settings.autoIncludeGitContext,
            contextFiles,
            ...getRuntimeOpts(),
          },
          controller,
          undefined,
          undefined,
          async (jsonData) => {
            const { convertToClaudeMessages } = await import("./message-converter.ts");
            const claudeMessages = convertToClaudeMessages(jsonData);
            if (claudeMessages.length > 0) {
              sendClaudeMessages(claudeMessages).catch(() => {});
            }
          },
          false
        );

        deps.setClaudeController(null);
        return result;
      } catch (error) {
        await crashHandler.reportCrash('claude', error instanceof Error ? error : new Error(String(error)), 'review', 'Claude review command');
        throw error;
      }
    },

    async onClaudeGenerate(
      ctx: any,
      request: string,
      type?: string,
      style?: string
    ) {
      try {
        await ctx.deferReply();
        
        let prompt = `Please generate ${type ? `a ${type}` : 'code'} based on this request: ${request}`;
        
        if (style) {
          prompt += `\n\nPlease use ${style} programming style and follow best practices for that approach.`;
        }
        
        prompt += '\n\nPlease include:\n• Well-commented code\n• Error handling where appropriate\n• Type annotations (if applicable)\n• Brief explanation of the implementation';

        const { enhancedClaudeQuery } = await import("./enhanced-client.ts");
        
        // Cancel any existing session
        const existingController = deps.getClaudeController();
        if (existingController) {
          existingController.abort();
        }

        const controller = new AbortController();
        deps.setClaudeController(controller);

        const result = await enhancedClaudeQuery(
          prompt,
          {
            workDir,
            model: settings.defaultModel,
            includeSystemInfo: settings.autoIncludeSystemInfo,
            includeGitContext: settings.autoIncludeGitContext,
            ...getRuntimeOpts(),
          },
          controller,
          undefined,
          undefined,
          async (jsonData) => {
            const { convertToClaudeMessages } = await import("./message-converter.ts");
            const claudeMessages = convertToClaudeMessages(jsonData);
            if (claudeMessages.length > 0) {
              sendClaudeMessages(claudeMessages).catch(() => {});
            }
          },
          false
        );

        deps.setClaudeController(null);
        return result;
      } catch (error) {
        await crashHandler.reportCrash('claude', error instanceof Error ? error : new Error(String(error)), 'generate', 'Claude generate command');
        throw error;
      }
    },

    async onClaudeRefactor(
      ctx: any,
      code: string,
      goal?: string,
      preserveBehavior?: boolean,
      addTests?: boolean
    ) {
      try {
        await ctx.deferReply();
        
        let prompt = `Please refactor this code`;
        
        if (goal) {
          prompt += ` to ${goal}`;
        }
        
        if (preserveBehavior !== false) {
          prompt += `, while preserving the exact behavior`;
        }
        
        prompt += `:\n\n${code}\n\nPlease provide:\n• Refactored code with explanations\n• Summary of changes made\n• Benefits of the refactoring`;
        
        if (addTests) {
          prompt += '\n• Unit tests for the refactored code';
        }

        const { enhancedClaudeQuery } = await import("./enhanced-client.ts");
        
        // Cancel any existing session
        const existingController = deps.getClaudeController();
        if (existingController) {
          existingController.abort();
        }

        const controller = new AbortController();
        deps.setClaudeController(controller);

        const result = await enhancedClaudeQuery(
          prompt,
          {
            workDir,
            model: settings.defaultModel,
            includeSystemInfo: false,
            includeGitContext: settings.autoIncludeGitContext,
            ...getRuntimeOpts(),
          },
          controller,
          undefined,
          undefined,
          async (jsonData) => {
            const { convertToClaudeMessages } = await import("./message-converter.ts");
            const claudeMessages = convertToClaudeMessages(jsonData);
            if (claudeMessages.length > 0) {
              sendClaudeMessages(claudeMessages).catch(() => {});
            }
          },
          false
        );

        deps.setClaudeController(null);
        return result;
      } catch (error) {
        await crashHandler.reportCrash('claude', error instanceof Error ? error : new Error(String(error)), 'refactor', 'Claude refactor command');
        throw error;
      }
    },

    async onClaudeLearn(
      ctx: any,
      topic: string,
      level?: string,
      includeExercises?: boolean,
      stepByStep?: boolean
    ) {
      try {
        await ctx.deferReply();
        
        let prompt = `Please teach me about "${topic}" at ${level || 'intermediate'} level.`;
        
        if (stepByStep) {
          prompt += ' Break it down into easy-to-follow steps.';
        }
        
        prompt += '\n\nPlease include:\n• Clear explanations with examples\n• Key concepts and terminology\n• Common use cases and applications\n• Best practices and tips';
        
        if (includeExercises) {
          prompt += '\n• Practical exercises to reinforce learning';
        }

        const { enhancedClaudeQuery } = await import("./enhanced-client.ts");
        
        // Cancel any existing session
        const existingController = deps.getClaudeController();
        if (existingController) {
          existingController.abort();
        }

        const controller = new AbortController();
        deps.setClaudeController(controller);

        const result = await enhancedClaudeQuery(
          prompt,
          {
            workDir,
            model: settings.defaultModel,
            includeSystemInfo: false,
            includeGitContext: false,
            ...getRuntimeOpts(),
          },
          controller,
          undefined,
          undefined,
          async (jsonData) => {
            const { convertToClaudeMessages } = await import("./message-converter.ts");
            const claudeMessages = convertToClaudeMessages(jsonData);
            if (claudeMessages.length > 0) {
              sendClaudeMessages(claudeMessages).catch(() => {});
            }
          },
          false
        );

        deps.setClaudeController(null);
        return result;
      } catch (error) {
        await crashHandler.reportCrash('claude', error instanceof Error ? error : new Error(String(error)), 'learn', 'Claude learn command');
        throw error;
      }
    }
  };
}