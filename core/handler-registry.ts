/**
 * Handler registry for Discord bot commands and button interactions.
 * Centralizes all handler registration and state management.
 * 
 * @module core/handler-registry
 */

import type { 
  CommandHandlers, 
  ButtonHandlers, 
  BotDependencies 
} from "../discord/index.ts";

import type { ClaudeMessage } from "../claude/index.ts";

// Import command definitions
import { claudeCommands, createClaudeHandlers } from "../claude/index.ts";
import { enhancedClaudeCommands, createEnhancedClaudeHandlers } from "../claude/index.ts";
import { additionalClaudeCommands, createAdditionalClaudeHandlers } from "../claude/additional-index.ts";
import { advancedSettingsCommands, createAdvancedSettingsHandlers, type AdvancedBotSettings } from "../settings/index.ts";
import { unifiedSettingsCommands, createUnifiedSettingsHandlers, type UnifiedBotSettings } from "../settings/index.ts";
import { gitCommands, createGitHandlers } from "../git/index.ts";
import { shellCommands, createShellHandlers } from "../shell/index.ts";
import { utilsCommands, createUtilsHandlers } from "../util/index.ts";
import { systemCommands, createSystemHandlers } from "../system/index.ts";
import { helpCommand, createHelpHandlers } from "../help/index.ts";
import { agentCommand, createAgentHandlers } from "../agent/index.ts";
import { cleanSessionId, ClaudeSessionManager } from "../claude/index.ts";

import type { ShellManager } from "../shell/index.ts";
import type { WorktreeBotManager } from "../git/index.ts";
import type { ProcessCrashHandler, ProcessHealthMonitor } from "../process/index.ts";

// ================================
// Types and Interfaces
// ================================

/**
 * Message history state for navigation.
 */
export interface MessageHistoryState {
  /** Array of previous messages */
  history: string[];
  /** Current index in history (-1 means latest) */
  currentIndex: number;
}

/**
 * Message history operations.
 */
export interface MessageHistoryOps {
  /** Add a message to history */
  addToHistory: (message: string) => void;
  /** Get previous message in history */
  getPreviousMessage: () => string | null;
  /** Get next message in history */
  getNextMessage: () => string | null;
  /** Get current history state (for button handlers) */
  getState: () => MessageHistoryState;
}

/**
 * Claude session state.
 */
export interface ClaudeSessionState {
  /** Abort controller for cancellation */
  controller: AbortController | null;
  /** Current session ID */
  sessionId: string | undefined;
}

/**
 * Claude session operations.
 */
export interface ClaudeSessionOps {
  /** Get current controller */
  getController: () => AbortController | null;
  /** Set controller */
  setController: (controller: AbortController | null) => void;
  /** Get session ID */
  getSessionId: () => string | undefined;
  /** Set session ID */
  setSessionId: (sessionId: string | undefined) => void;
}

/**
 * Bot settings state.
 */
export interface BotSettingsState {
  /** Advanced settings */
  advanced: AdvancedBotSettings;
  /** Unified settings */
  unified: UnifiedBotSettings;
  /** Legacy bot settings */
  legacy: {
    mentionEnabled: boolean;
    mentionUserId: string | null;
  };
}

/**
 * Bot settings operations.
 */
export interface BotSettingsOps {
  /** Get current settings */
  getSettings: () => BotSettingsState;
  /** Update advanced settings */
  updateAdvanced: (settings: Partial<AdvancedBotSettings>) => void;
  /** Update unified settings */
  updateUnified: (settings: Partial<UnifiedBotSettings>) => void;
  /** Update legacy settings */
  updateLegacy: (settings: { mentionEnabled: boolean; mentionUserId: string | null }) => void;
}

/**
 * All handler dependencies.
 */
export interface AllHandlers {
  claude: ReturnType<typeof createClaudeHandlers>;
  enhancedClaude: ReturnType<typeof createEnhancedClaudeHandlers>;
  additionalClaude: ReturnType<typeof createAdditionalClaudeHandlers>;
  advancedSettings: ReturnType<typeof createAdvancedSettingsHandlers>;
  unifiedSettings: ReturnType<typeof createUnifiedSettingsHandlers>;
  git: ReturnType<typeof createGitHandlers>;
  shell: ReturnType<typeof createShellHandlers>;
  utils: ReturnType<typeof createUtilsHandlers>;
  system: ReturnType<typeof createSystemHandlers>;
  help: ReturnType<typeof createHelpHandlers>;
  agent: ReturnType<typeof createAgentHandlers>;
}

/**
 * Dependencies for handler registry creation.
 */
export interface HandlerRegistryDeps {
  /** Working directory */
  workDir: string;
  /** Repository name */
  repoName: string;
  /** Branch name */
  branchName: string;
  /** Category name */
  categoryName: string;
  /** Discord token */
  discordToken: string;
  /** Application ID */
  applicationId: string;
  /** Default mention user ID */
  defaultMentionUserId?: string;
  /** Shell manager instance */
  shellManager: ShellManager;
  /** Worktree bot manager instance */
  worktreeBotManager: WorktreeBotManager;
  /** Crash handler instance */
  crashHandler: ProcessCrashHandler;
  /** Health monitor instance */
  healthMonitor: ProcessHealthMonitor;
  /** Claude session manager instance */
  claudeSessionManager: ClaudeSessionManager;
  /** Function to send Claude messages */
  sendClaudeMessages: (messages: ClaudeMessage[]) => Promise<void>;
  /** Callback when bot settings update */
  onBotSettingsUpdate?: (settings: { mentionEnabled: boolean; mentionUserId: string | null }) => void;
}

/**
 * Complete handler registry with all handlers and state operations.
 */
export interface HandlerRegistry {
  /** Command handlers map */
  commandHandlers: CommandHandlers;
  /** Button handlers map */
  buttonHandlers: ButtonHandlers;
  /** Bot dependencies for Discord bot creation */
  dependencies: BotDependencies;
  /** All individual handler modules */
  handlers: AllHandlers;
  /** Message history operations */
  messageHistory: MessageHistoryOps;
  /** Claude session operations */
  claudeSession: ClaudeSessionOps;
  /** Bot settings operations */
  settings: BotSettingsOps;
  /** Cleanup function */
  cleanup: () => void;
}

// ================================
// State Factories
// ================================

/**
 * Create message history state and operations.
 * 
 * @param maxSize - Maximum history size (default: 50)
 * @returns Message history operations
 */
export function createMessageHistory(maxSize: number = 50): MessageHistoryOps {
  const state: MessageHistoryState = {
    history: [],
    currentIndex: -1,
  };

  return {
    addToHistory(message: string) {
      // Don't add duplicate consecutive messages
      if (state.history.length === 0 || state.history[state.history.length - 1] !== message) {
        state.history.push(message);
        // Keep only last maxSize messages
        if (state.history.length > maxSize) {
          state.history.shift();
        }
      }
      state.currentIndex = -1; // Reset to latest
    },

    getPreviousMessage(): string | null {
      if (state.history.length === 0) return null;
      
      if (state.currentIndex === -1) {
        state.currentIndex = state.history.length - 1;
      } else if (state.currentIndex > 0) {
        state.currentIndex--;
      }
      
      return state.history[state.currentIndex] || null;
    },

    getNextMessage(): string | null {
      if (state.history.length === 0 || state.currentIndex === -1) return null;
      
      if (state.currentIndex < state.history.length - 1) {
        state.currentIndex++;
        return state.history[state.currentIndex];
      } else {
        state.currentIndex = -1; // Reset to latest
        return null; // No next message, at the end
      }
    },

    getState(): MessageHistoryState {
      return { ...state, history: [...state.history] };
    },
  };
}

/**
 * Create Claude session state and operations.
 * 
 * @returns Claude session operations
 */
export function createClaudeSession(): ClaudeSessionOps {
  const state: ClaudeSessionState = {
    controller: null,
    sessionId: undefined,
  };

  return {
    getController: () => state.controller,
    setController: (controller) => { state.controller = controller; },
    getSessionId: () => state.sessionId,
    setSessionId: (sessionId) => { state.sessionId = sessionId; },
  };
}

/**
 * Create bot settings state and operations.
 * 
 * @param defaultMentionUserId - Default user ID to mention
 * @param defaultAdvanced - Default advanced settings
 * @param defaultUnified - Default unified settings
 * @returns Bot settings operations
 */
export function createBotSettings(
  defaultMentionUserId: string | undefined,
  defaultAdvanced: AdvancedBotSettings,
  defaultUnified: UnifiedBotSettings
): BotSettingsOps {
  const state: BotSettingsState = {
    advanced: {
      ...defaultAdvanced,
      mentionEnabled: !!defaultMentionUserId,
      mentionUserId: defaultMentionUserId || null,
    },
    unified: {
      ...defaultUnified,
      mentionEnabled: !!defaultMentionUserId,
      mentionUserId: defaultMentionUserId || null,
    },
    legacy: {
      mentionEnabled: !!defaultMentionUserId,
      mentionUserId: defaultMentionUserId || null,
    },
  };

  return {
    getSettings: () => ({
      advanced: { ...state.advanced },
      unified: { ...state.unified },
      legacy: { ...state.legacy },
    }),

    updateAdvanced(settings: Partial<AdvancedBotSettings>) {
      Object.assign(state.advanced, settings);
      // Sync mention settings to legacy
      state.legacy.mentionEnabled = state.advanced.mentionEnabled;
      state.legacy.mentionUserId = state.advanced.mentionUserId;
    },

    updateUnified(settings: Partial<UnifiedBotSettings>) {
      Object.assign(state.unified, settings);
      // Sync mention settings to legacy and advanced
      state.legacy.mentionEnabled = state.unified.mentionEnabled;
      state.legacy.mentionUserId = state.unified.mentionUserId;
      state.advanced.mentionEnabled = state.unified.mentionEnabled;
      state.advanced.mentionUserId = state.unified.mentionUserId;
    },

    updateLegacy(settings: { mentionEnabled: boolean; mentionUserId: string | null }) {
      state.legacy = { ...settings };
    },
  };
}

// ================================
// Handler Creation
// ================================

/**
 * Create all handler modules.
 * 
 * @param deps - Handler dependencies
 * @param claudeSession - Claude session operations
 * @param settings - Bot settings operations
 * @returns All handler modules
 */
export function createAllHandlers(
  deps: HandlerRegistryDeps,
  claudeSession: ClaudeSessionOps,
  settings: BotSettingsOps
): AllHandlers {
  const { 
    workDir, repoName, branchName, categoryName, discordToken, applicationId,
    shellManager, worktreeBotManager, crashHandler, claudeSessionManager,
    sendClaudeMessages, onBotSettingsUpdate
  } = deps;

  const currentSettings = settings.getSettings();

  const claudeHandlers = createClaudeHandlers({
    workDir,
    claudeController: claudeSession.getController(),
    setClaudeController: claudeSession.setController,
    setClaudeSessionId: claudeSession.setSessionId,
    sendClaudeMessages,
  });

  const gitHandlers = createGitHandlers({
    workDir,
    actualCategoryName: categoryName,
    discordToken,
    applicationId,
    botSettings: currentSettings.legacy,
    worktreeBotManager,
  });

  const shellHandlers = createShellHandlers({
    shellManager,
  });

  const utilsHandlers = createUtilsHandlers({
    workDir,
    repoName,
    branchName,
    actualCategoryName: categoryName,
    botSettings: currentSettings.legacy,
    updateBotSettings: (newSettings) => {
      settings.updateLegacy(newSettings);
      if (onBotSettingsUpdate) {
        onBotSettingsUpdate(newSettings);
      }
    },
  });

  const helpHandlers = createHelpHandlers({
    workDir,
    repoName,
    branchName,
    categoryName,
  });

  const enhancedClaudeHandlers = createEnhancedClaudeHandlers({
    workDir,
    claudeController: claudeSession.getController(),
    setClaudeController: claudeSession.setController,
    setClaudeSessionId: claudeSession.setSessionId,
    sendClaudeMessages,
    sessionManager: claudeSessionManager,
    crashHandler,
  });

  const systemHandlers = createSystemHandlers({
    workDir,
    crashHandler,
  });

  const additionalClaudeHandlers = createAdditionalClaudeHandlers({
    workDir,
    claudeController: claudeSession.getController(),
    setClaudeController: claudeSession.setController,
    sendClaudeMessages,
    sessionManager: claudeSessionManager,
    crashHandler,
    settings: currentSettings.advanced,
  });

  const advancedSettingsHandlers = createAdvancedSettingsHandlers({
    settings: currentSettings.advanced,
    updateSettings: settings.updateAdvanced,
    crashHandler,
  });

  const unifiedSettingsHandlers = createUnifiedSettingsHandlers({
    settings: currentSettings.unified,
    updateSettings: settings.updateUnified,
    crashHandler,
  });

  const agentHandlers = createAgentHandlers({
    workDir,
    crashHandler,
    sendClaudeMessages,
    sessionManager: claudeSessionManager,
  });

  return {
    claude: claudeHandlers,
    enhancedClaude: enhancedClaudeHandlers,
    additionalClaude: additionalClaudeHandlers,
    advancedSettings: advancedSettingsHandlers,
    unifiedSettings: unifiedSettingsHandlers,
    git: gitHandlers,
    shell: shellHandlers,
    utils: utilsHandlers,
    system: systemHandlers,
    help: helpHandlers,
    agent: agentHandlers,
  };
}

/**
 * Get all command definitions for bot registration.
 * 
 * @returns Array of all command definitions
 */
export function getAllCommands() {
  return [
    ...claudeCommands,
    ...enhancedClaudeCommands,
    ...additionalClaudeCommands,
    ...advancedSettingsCommands,
    ...unifiedSettingsCommands,
    agentCommand,
    ...gitCommands,
    ...shellCommands,
    ...utilsCommands,
    ...systemCommands,
    helpCommand,
  ];
}

// Re-export for convenience
export { cleanSessionId };
