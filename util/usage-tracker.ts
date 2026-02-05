/**
 * API Usage Tracking Module
 * Tracks real Claude API usage including costs, tokens, and request counts.
 */

import { PersistenceManager } from "./persistence.ts";

// Usage record for a single API call
export interface APIUsageRecord {
  timestamp: string;
  model: string;
  cost: number;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  requestType: 'chat' | 'agent' | 'command' | 'enhanced';
  sessionId?: string;
}

// Aggregated usage statistics
export interface UsageStatistics {
  totalCost: number;
  totalRequests: number;
  totalDurationMs: number;
  byModel: Record<string, {
    cost: number;
    requests: number;
    durationMs: number;
  }>;
  byType: Record<string, {
    cost: number;
    requests: number;
  }>;
  lastUpdated: string;
}

// Daily usage data
export interface DailyUsage {
  date: string;
  records: APIUsageRecord[];
  statistics: UsageStatistics;
}

// Usage data persistence structure
export interface UsageData {
  currentDay: DailyUsage;
  history: DailyUsage[]; // Last 30 days
  allTimeStats: UsageStatistics;
}

// Persistence manager for usage data
const usageManager = new PersistenceManager<UsageData>("api-usage");

// In-memory cache
let usageData: UsageData | null = null;
let initialized = false;

// Get today's date string (YYYY-MM-DD)
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

// Create empty statistics
function createEmptyStats(): UsageStatistics {
  return {
    totalCost: 0,
    totalRequests: 0,
    totalDurationMs: 0,
    byModel: {},
    byType: {},
    lastUpdated: new Date().toISOString()
  };
}

// Create empty daily usage
function createEmptyDailyUsage(date: string): DailyUsage {
  return {
    date,
    records: [],
    statistics: createEmptyStats()
  };
}

// Create default usage data
function createDefaultUsageData(): UsageData {
  return {
    currentDay: createEmptyDailyUsage(getTodayDate()),
    history: [],
    allTimeStats: createEmptyStats()
  };
}

// Initialize usage tracking
async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  
  try {
    usageData = await usageManager.load(createDefaultUsageData());
    
    // Check if we need to roll over to a new day
    const today = getTodayDate();
    if (usageData.currentDay.date !== today) {
      // Archive current day to history
      if (usageData.currentDay.records.length > 0) {
        usageData.history.unshift(usageData.currentDay);
        // Keep only last 30 days
        if (usageData.history.length > 30) {
          usageData.history = usageData.history.slice(0, 30);
        }
      }
      // Start new day
      usageData.currentDay = createEmptyDailyUsage(today);
      await usageManager.save(usageData);
    }
    
    initialized = true;
    console.log(`Usage Tracking: Initialized with ${usageData.currentDay.records.length} records today`);
  } catch (error) {
    console.error('Usage Tracking: Failed to initialize:', error);
    usageData = createDefaultUsageData();
    initialized = true;
  }
}

// Update statistics with a new record
function updateStats(stats: UsageStatistics, record: APIUsageRecord): void {
  stats.totalCost += record.cost;
  stats.totalRequests++;
  stats.totalDurationMs += record.durationMs;
  stats.lastUpdated = new Date().toISOString();
  
  // Update by model
  if (!stats.byModel[record.model]) {
    stats.byModel[record.model] = { cost: 0, requests: 0, durationMs: 0 };
  }
  stats.byModel[record.model].cost += record.cost;
  stats.byModel[record.model].requests++;
  stats.byModel[record.model].durationMs += record.durationMs;
  
  // Update by type
  if (!stats.byType[record.requestType]) {
    stats.byType[record.requestType] = { cost: 0, requests: 0 };
  }
  stats.byType[record.requestType].cost += record.cost;
  stats.byType[record.requestType].requests++;
}

/**
 * Record API usage from a Claude Code response
 */
export async function recordAPIUsage(
  model: string,
  cost: number | undefined,
  durationMs: number | undefined,
  requestType: 'chat' | 'agent' | 'command' | 'enhanced',
  sessionId?: string,
  tokenInfo?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  }
): Promise<void> {
  await ensureInitialized();
  if (!usageData) return;
  
  const record: APIUsageRecord = {
    timestamp: new Date().toISOString(),
    model: model || 'unknown',
    cost: cost || 0,
    durationMs: durationMs || 0,
    inputTokens: tokenInfo?.inputTokens,
    outputTokens: tokenInfo?.outputTokens,
    cacheReadTokens: tokenInfo?.cacheReadTokens,
    cacheWriteTokens: tokenInfo?.cacheWriteTokens,
    requestType,
    sessionId
  };
  
  // Add to current day
  usageData.currentDay.records.push(record);
  updateStats(usageData.currentDay.statistics, record);
  updateStats(usageData.allTimeStats, record);
  
  // Save periodically (every 5 records) to avoid too many writes
  if (usageData.currentDay.records.length % 5 === 0) {
    await usageManager.save(usageData);
  }
  
  console.log(`Usage Tracking: Recorded ${requestType} request - $${cost?.toFixed(4) || 0}`);
}

/**
 * Get today's usage statistics
 */
export async function getTodayUsage(): Promise<DailyUsage> {
  await ensureInitialized();
  return usageData?.currentDay || createEmptyDailyUsage(getTodayDate());
}

/**
 * Get all-time usage statistics
 */
export async function getAllTimeUsage(): Promise<UsageStatistics> {
  await ensureInitialized();
  return usageData?.allTimeStats || createEmptyStats();
}

/**
 * Get usage history for the last N days
 */
export async function getUsageHistory(days: number = 7): Promise<DailyUsage[]> {
  await ensureInitialized();
  const history = usageData?.history || [];
  return [
    usageData?.currentDay || createEmptyDailyUsage(getTodayDate()),
    ...history.slice(0, days - 1)
  ];
}

/**
 * Get formatted usage summary for display
 */
export async function getUsageSummary(): Promise<{
  today: {
    cost: string;
    requests: number;
    avgDuration: string;
  };
  allTime: {
    cost: string;
    requests: number;
    topModel: string;
  };
}> {
  await ensureInitialized();
  
  const today = usageData?.currentDay.statistics || createEmptyStats();
  const allTime = usageData?.allTimeStats || createEmptyStats();
  
  // Find top model by requests
  let topModel = 'N/A';
  let maxRequests = 0;
  for (const [model, stats] of Object.entries(allTime.byModel)) {
    if (stats.requests > maxRequests) {
      maxRequests = stats.requests;
      topModel = model;
    }
  }
  
  return {
    today: {
      cost: `$${today.totalCost.toFixed(4)}`,
      requests: today.totalRequests,
      avgDuration: today.totalRequests > 0 
        ? `${(today.totalDurationMs / today.totalRequests / 1000).toFixed(1)}s`
        : 'N/A'
    },
    allTime: {
      cost: `$${allTime.totalCost.toFixed(4)}`,
      requests: allTime.totalRequests,
      topModel
    }
  };
}

/**
 * Force save usage data to disk
 */
export async function saveUsageData(): Promise<void> {
  if (usageData) {
    await usageManager.save(usageData);
  }
}

/**
 * Reset today's usage (for testing)
 */
export async function resetTodayUsage(): Promise<void> {
  await ensureInitialized();
  if (usageData) {
    usageData.currentDay = createEmptyDailyUsage(getTodayDate());
    await usageManager.save(usageData);
  }
}
