/**
 * Configuration loader for the Claude Code Discord Bot.
 * Handles command-line argument parsing and environment variable validation.
 * 
 * @module core/config-loader
 */

/**
 * Application configuration interface.
 * Contains all required settings for bot initialization.
 */
export interface AppConfig {
  /** Discord bot token for authentication */
  discordToken: string;
  /** Discord application ID for slash commands */
  applicationId: string;
  /** Working directory for file operations */
  workDir: string;
  /** Category name for organizing Discord channels */
  categoryName: string | undefined;
  /** Default user ID to mention in messages, if configured */
  userId: string | undefined;
}

/**
 * Parsed command-line arguments.
 */
export interface ParsedArgs {
  /** Category name from CLI */
  category?: string;
  /** User ID from CLI */
  userId?: string;
}

/**
 * Environment variable configuration.
 */
export interface EnvConfig {
  /** Discord token from environment */
  discordToken: string | undefined;
  /** Application ID from environment */
  applicationId: string | undefined;
  /** Category name from environment (optional) */
  categoryName: string | undefined;
  /** Default mention user ID from environment (optional) */
  mentionUserId: string | undefined;
}

/**
 * Dependencies for configuration loading.
 * Uses dependency injection for testability.
 */
export interface ConfigLoaderDeps {
  /** Function to get environment variables */
  getEnv: (key: string) => string | undefined;
  /** Function to get current working directory */
  getCwd: () => string;
  /** Command-line arguments array */
  args: string[];
}

/**
 * Parse command-line arguments into structured format.
 * 
 * Supports the following argument formats:
 * - `--category <value>` or `--category=<value>`
 * - `--user-id <value>` or `--user-id=<value>`
 * - Positional arguments (backward compatibility): `<category> [userId]`
 * 
 * @param args - Array of command-line arguments
 * @returns Parsed arguments object
 * 
 * @example
 * ```typescript
 * // Named arguments
 * parseArgs(['--category', 'my-project', '--user-id', '123456'])
 * // => { category: 'my-project', userId: '123456' }
 * 
 * // Positional arguments (legacy support)
 * parseArgs(['my-project', '123456'])
 * // => { category: 'my-project', userId: '123456' }
 * ```
 */
export function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--category' && i + 1 < args.length) {
      result.category = args[i + 1];
      i++; // Skip next argument
    } else if (arg === '--user-id' && i + 1 < args.length) {
      result.userId = args[i + 1];
      i++; // Skip next argument
    } else if (arg.startsWith('--category=')) {
      result.category = arg.split('=')[1];
    } else if (arg.startsWith('--user-id=')) {
      result.userId = arg.split('=')[1];
    } else if (!arg.startsWith('--')) {
      // Positional arguments for backward compatibility
      if (!result.category) {
        result.category = arg;
      } else if (!result.userId) {
        result.userId = arg;
      }
    }
  }
  
  return result;
}

/**
 * Load environment variables into structured format.
 * 
 * @param getEnv - Function to retrieve environment variables
 * @returns Environment configuration object
 */
export function loadEnvConfig(getEnv: (key: string) => string | undefined): EnvConfig {
  return {
    discordToken: getEnv("DISCORD_TOKEN"),
    applicationId: getEnv("APPLICATION_ID"),
    categoryName: getEnv("CATEGORY_NAME"),
    mentionUserId: getEnv("DEFAULT_MENTION_USER_ID"),
  };
}

/**
 * Error thrown when required configuration is missing.
 */
export class ConfigurationError extends Error {
  /** List of missing required configuration keys */
  readonly missingKeys: string[];
  
  constructor(missingKeys: string[]) {
    super(`Missing required configuration: ${missingKeys.join(', ')}`);
    this.name = 'ConfigurationError';
    this.missingKeys = missingKeys;
  }
}

/**
 * Validate that all required environment variables are present.
 * 
 * @param envConfig - Environment configuration to validate
 * @throws {ConfigurationError} If required variables are missing
 */
export function validateEnvConfig(envConfig: EnvConfig): void {
  const missing: string[] = [];
  
  if (!envConfig.discordToken) {
    missing.push('DISCORD_TOKEN');
  }
  if (!envConfig.applicationId) {
    missing.push('APPLICATION_ID');
  }
  
  if (missing.length > 0) {
    throw new ConfigurationError(missing);
  }
}

/**
 * Load complete application configuration from environment and CLI arguments.
 * 
 * This function combines environment variables and command-line arguments
 * to produce the final configuration. CLI arguments take precedence over
 * environment variables for overlapping settings.
 * 
 * @param deps - Dependencies for loading configuration (defaults to Deno globals)
 * @returns Complete application configuration
 * @throws {ConfigurationError} If required configuration is missing
 * 
 * @example
 * ```typescript
 * // Using defaults (Deno environment)
 * const config = loadConfig();
 * 
 * // Using custom dependencies (for testing)
 * const config = loadConfig({
 *   getEnv: (key) => mockEnv[key],
 *   getCwd: () => '/test/dir',
 *   args: ['--category', 'test']
 * });
 * ```
 */
export function loadConfig(deps?: Partial<ConfigLoaderDeps>): AppConfig {
  // Default to Deno globals
  const getEnv = deps?.getEnv ?? ((key: string) => Deno.env.get(key));
  const getCwd = deps?.getCwd ?? (() => Deno.cwd());
  const args = deps?.args ?? Deno.args;
  
  // Load environment configuration
  const envConfig = loadEnvConfig(getEnv);
  
  // Validate required environment variables
  validateEnvConfig(envConfig);
  
  // Parse command-line arguments
  const parsedArgs = parseArgs(args);
  
  // Combine environment and CLI (CLI takes precedence)
  return {
    discordToken: envConfig.discordToken!,
    applicationId: envConfig.applicationId!,
    workDir: getCwd(),
    categoryName: parsedArgs.category || envConfig.categoryName,
    userId: parsedArgs.userId || envConfig.mentionUserId,
  };
}

/**
 * Get configuration with validation, suitable for main entry point.
 * Logs errors and exits process on failure.
 * 
 * @param deps - Optional dependencies for testing
 * @returns Application configuration or exits process on error
 */
export function loadConfigOrExit(deps?: Partial<ConfigLoaderDeps>): AppConfig {
  try {
    return loadConfig(deps);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error(`Error: ${error.message}`);
      console.error('Please set the required environment variables and try again.');
    } else {
      console.error('Configuration error:', error instanceof Error ? error.message : String(error));
    }
    Deno.exit(1);
  }
}
