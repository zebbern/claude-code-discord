/**
 * Persistence Utility Module
 * Provides file-based JSON storage for bot data that needs to survive restarts.
 */

import { ensureDir } from "https://deno.land/std@0.208.0/fs/mod.ts";
import * as path from "https://deno.land/std@0.208.0/path/mod.ts";

// Default data directory - relative to working directory
const DEFAULT_DATA_DIR = ".bot-data";

export interface PersistenceOptions {
  dataDir?: string;
  pretty?: boolean;
}

/**
 * Generic persistence manager for JSON data
 */
export class PersistenceManager<T> {
  private dataDir: string;
  private filename: string;
  private filePath: string;
  private pretty: boolean;
  private cache: T | null = null;
  private initialized = false;

  constructor(filename: string, options: PersistenceOptions = {}) {
    this.dataDir = options.dataDir || DEFAULT_DATA_DIR;
    this.filename = filename.endsWith(".json") ? filename : `${filename}.json`;
    this.filePath = path.join(this.dataDir, this.filename);
    this.pretty = options.pretty ?? true;
  }

  /**
   * Initialize the persistence manager (creates directory if needed)
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await ensureDir(this.dataDir);
      this.initialized = true;
      console.log(`Persistence: Initialized ${this.filename} at ${this.filePath}`);
    } catch (error) {
      console.error(`Persistence: Failed to initialize ${this.filename}:`, error);
      throw error;
    }
  }

  /**
   * Load data from file
   */
  async load(defaultValue: T): Promise<T> {
    await this.init();

    try {
      const content = await Deno.readTextFile(this.filePath);
      this.cache = JSON.parse(content) as T;
      console.log(`Persistence: Loaded ${this.filename}`);
      return this.cache;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        console.log(`Persistence: ${this.filename} not found, using default`);
        this.cache = defaultValue;
        return defaultValue;
      }
      console.error(`Persistence: Failed to load ${this.filename}:`, error);
      this.cache = defaultValue;
      return defaultValue;
    }
  }

  /**
   * Save data to file
   */
  async save(data: T): Promise<boolean> {
    await this.init();

    try {
      const content = this.pretty
        ? JSON.stringify(data, null, 2)
        : JSON.stringify(data);
      
      await Deno.writeTextFile(this.filePath, content);
      this.cache = data;
      console.log(`Persistence: Saved ${this.filename}`);
      return true;
    } catch (error) {
      console.error(`Persistence: Failed to save ${this.filename}:`, error);
      return false;
    }
  }

  /**
   * Get cached data (or load if not cached)
   */
  async get(defaultValue: T): Promise<T> {
    if (this.cache !== null) {
      return this.cache;
    }
    return this.load(defaultValue);
  }

  /**
   * Update data with a transform function
   */
  async update(
    defaultValue: T,
    transform: (current: T) => T
  ): Promise<boolean> {
    const current = await this.get(defaultValue);
    const updated = transform(current);
    return this.save(updated);
  }

  /**
   * Delete the persistence file
   */
  async delete(): Promise<boolean> {
    try {
      await Deno.remove(this.filePath);
      this.cache = null;
      console.log(`Persistence: Deleted ${this.filename}`);
      return true;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return true; // Already deleted
      }
      console.error(`Persistence: Failed to delete ${this.filename}:`, error);
      return false;
    }
  }

  /**
   * Check if the persistence file exists
   */
  async exists(): Promise<boolean> {
    try {
      await Deno.stat(this.filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the file path
   */
  getFilePath(): string {
    return this.filePath;
  }
}

// Pre-configured persistence managers for common data types

export interface TodoItem {
  id: string;
  text: string;
  priority: "critical" | "high" | "medium" | "low";
  completed: boolean;
  source?: string;
  line?: number;
  createdAt: string;
  completedAt?: string;
}

export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  addedAt: string;
  lastTested?: string;
  lastStatus?: "online" | "offline" | "error";
}

export interface AgentSessionData {
  id: string;
  agentType: string;
  startTime: string;
  lastActivity: string;
  messageCount: number;
  context?: string;
}

export interface BotPersistentData {
  todos: TodoItem[];
  mcpServers: MCPServerConfig[];
  agentSessions: AgentSessionData[];
  settings?: Record<string, unknown>;
  lastSaved: string;
  version: string;
}

// Singleton persistence managers
let todosManager: PersistenceManager<TodoItem[]> | null = null;
let mcpServersManager: PersistenceManager<MCPServerConfig[]> | null = null;
let agentSessionsManager: PersistenceManager<AgentSessionData[]> | null = null;

/**
 * Get or create the todos persistence manager
 */
export function getTodosManager(dataDir?: string): PersistenceManager<TodoItem[]> {
  if (!todosManager) {
    todosManager = new PersistenceManager<TodoItem[]>("todos", { dataDir });
  }
  return todosManager;
}

/**
 * Get or create the MCP servers persistence manager
 */
export function getMCPServersManager(dataDir?: string): PersistenceManager<MCPServerConfig[]> {
  if (!mcpServersManager) {
    mcpServersManager = new PersistenceManager<MCPServerConfig[]>("mcp-servers", { dataDir });
  }
  return mcpServersManager;
}

/**
 * Get or create the agent sessions persistence manager
 */
export function getAgentSessionsManager(dataDir?: string): PersistenceManager<AgentSessionData[]> {
  if (!agentSessionsManager) {
    agentSessionsManager = new PersistenceManager<AgentSessionData[]>("agent-sessions", { dataDir });
  }
  return agentSessionsManager;
}

/**
 * Initialize all persistence managers
 */
export async function initAllPersistence(dataDir?: string): Promise<void> {
  const managers = [
    getTodosManager(dataDir),
    getMCPServersManager(dataDir),
    getAgentSessionsManager(dataDir),
  ];

  await Promise.all(managers.map(m => m.init()));
  console.log("Persistence: All managers initialized");
}

/**
 * Load all persistent data
 */
export async function loadAllData(dataDir?: string): Promise<{
  todos: TodoItem[];
  mcpServers: MCPServerConfig[];
  agentSessions: AgentSessionData[];
}> {
  const [todos, mcpServers, agentSessions] = await Promise.all([
    getTodosManager(dataDir).load([]),
    getMCPServersManager(dataDir).load([]),
    getAgentSessionsManager(dataDir).load([]),
  ]);

  return { todos, mcpServers, agentSessions };
}
