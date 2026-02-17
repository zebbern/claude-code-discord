/**
 * Dynamic Model Fetcher
 * 
 * Discovers available Claude models using two strategies:
 * 1. Primary: Anthropic REST API (requires ANTHROPIC_API_KEY)
 * 2. Fallback: Parse model IDs from the installed Claude CLI binary
 * 
 * Both strategies auto-refresh periodically and fall back to
 * hardcoded defaults when neither source is available.
 */

import type { ModelInfo } from "./enhanced-client.ts";

// Anthropic API response types
interface AnthropicModelEntry {
  id: string;
  display_name: string;
  created_at: string;
  type: string;
}

interface AnthropicModelsResponse {
  data: AnthropicModelEntry[];
  has_more: boolean;
  first_id?: string;
  last_id?: string;
}

// Cache state
let cachedModels: Record<string, ModelInfo> | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let refreshInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Classify a model ID into a tier based on naming conventions.
 */
function classifyTier(id: string): ModelInfo['tier'] {
  if (id.includes('opus')) return 'flagship';
  if (id.includes('haiku')) return 'fast';
  if (id.includes('sonnet')) return 'balanced';
  // Legacy / Claude 3 models
  if (id.startsWith('claude-3-') && !id.startsWith('claude-3-5-')) return 'legacy';
  return 'balanced';
}

/**
 * Determine if a model ID supports extended thinking (heuristic).
 */
function inferSupportsThinking(id: string): boolean {
  // Opus and Sonnet 4+ support thinking; Haiku and legacy do not
  if (id.includes('opus')) return true;
  if (id.includes('sonnet')) {
    // Sonnet 4+ supports thinking
    const versionMatch = id.match(/sonnet-(\d+)/);
    if (versionMatch && parseInt(versionMatch[1]) >= 4) return true;
  }
  return false;
}

/**
 * Determine if a model is deprecated based on its ID.
 */
function inferDeprecated(id: string): boolean {
  // Claude 3.x (non-3.5) are deprecated
  if (id.startsWith('claude-3-') && !id.startsWith('claude-3-5-')) return true;
  // Claude 3.5 models are older generation
  if (id.startsWith('claude-3-5-')) return true;
  return false;
}

/**
 * Extract a context window size from model ID (heuristic).
 * All current Claude models use 200k context.
 */
function inferContextWindow(_id: string): number {
  return 200_000;
}

/**
 * Convert an Anthropic API model entry into our ModelInfo format.
 */
function toModelInfo(entry: AnthropicModelEntry): ModelInfo {
  const tier = classifyTier(entry.id);
  return {
    name: entry.display_name || entry.id,
    description: `${entry.display_name || entry.id} (fetched from API)`,
    contextWindow: inferContextWindow(entry.id),
    recommended: false,
    supportsThinking: inferSupportsThinking(entry.id),
    tier,
    deprecated: inferDeprecated(entry.id),
  };
}

/**
 * Build alias entries that point to the latest model in each family.
 * Families: opus, sonnet, haiku.
 */
function buildAliases(models: Record<string, ModelInfo>, apiModels: AnthropicModelEntry[]): void {
  const families = ['opus', 'sonnet', 'haiku'] as const;
  
  for (const family of families) {
    // Find all API models in this family, sorted by created_at descending
    const familyModels = apiModels
      .filter(m => m.id.includes(family) && m.type === 'model')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    if (familyModels.length > 0) {
      const latest = familyModels[0];
      const tier = classifyTier(latest.id);
      
      models[family] = {
        name: `Claude ${family.charAt(0).toUpperCase() + family.slice(1)} (Latest)`,
        description: `Auto-resolves to latest ${family.charAt(0).toUpperCase() + family.slice(1)} via CLI alias`,
        contextWindow: inferContextWindow(latest.id),
        recommended: true,
        supportsThinking: inferSupportsThinking(latest.id),
        tier,
        aliasFor: latest.id,
      };

      // Mark the latest model as recommended
      if (models[latest.id]) {
        models[latest.id].recommended = true;
      }
    }
  }
}

/**
 * Fetch models from the Anthropic API.
 * Returns null if no API key is set or the request fails.
 */
async function fetchFromAPI(): Promise<AnthropicModelEntry[] | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return null;
  }

  try {
    const allModels: AnthropicModelEntry[] = [];
    let hasMore = true;
    let afterId: string | undefined;

    while (hasMore) {
      const url = new URL("https://api.anthropic.com/v1/models");
      url.searchParams.set("limit", "100");
      if (afterId) {
        url.searchParams.set("after_id", afterId);
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
      });

      if (!response.ok) {
        console.error(`Anthropic Models API error: ${response.status} ${response.statusText}`);
        const body = await response.text().catch(() => "");
        console.error(`Response body: ${body}`);
        return null;
      }

      const data: AnthropicModelsResponse = await response.json();
      allModels.push(...data.data);

      hasMore = data.has_more;
      if (hasMore && data.last_id) {
        afterId = data.last_id;
      } else {
        hasMore = false;
      }
    }

    return allModels;
  } catch (error) {
    console.error("Failed to fetch models from Anthropic API:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Build the models record from API data.
 */
function buildModelsFromAPI(apiModels: AnthropicModelEntry[]): Record<string, ModelInfo> {
  const models: Record<string, ModelInfo> = {};

  // Filter to only Claude models (skip any non-Claude entries)
  const claudeModels = apiModels.filter(m => m.id.startsWith("claude-"));

  // Add each model
  for (const entry of claudeModels) {
    models[entry.id] = toModelInfo(entry);
  }

  // Build convenience aliases (opus, sonnet, haiku)
  buildAliases(models, claudeModels);

  return models;
}

/**
 * Parse model IDs from the installed Claude CLI binary.
 * Looks for patterns like "claude-xxx-yyy-YYYYMMDD" in cli.js.
 * This works without an API key — just needs Claude Code installed.
 */
async function parseModelsFromCLI(): Promise<string[] | null> {
  try {
    // Common install paths for Claude Code CLI
    const possiblePaths = [
      // npm global (Windows)
      `${Deno.env.get("APPDATA")}/npm/node_modules/@anthropic-ai/claude-code/cli.js`,
      // npm global (Unix)
      `/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js`,
      `/usr/lib/node_modules/@anthropic-ai/claude-code/cli.js`,
      // User-specific npm (Unix)
      `${Deno.env.get("HOME")}/.npm-global/lib/node_modules/@anthropic-ai/claude-code/cli.js`,
    ];

    let cliContent: string | null = null;

    for (const cliPath of possiblePaths) {
      if (!cliPath) continue;
      try {
        cliContent = await Deno.readTextFile(cliPath);
        console.log(`Model fetcher: Found CLI binary at ${cliPath}`);
        break;
      } catch {
        // Try next path
      }
    }

    // Also try locating via `which claude` / `where claude`
    if (!cliContent) {
      try {
        const isWindows = Deno.build.os === 'windows';
        const whichCmd = isWindows ? 'where' : 'which';
        const cmd = new Deno.Command(whichCmd, {
          args: ['claude'],
          stdout: 'piped',
          stderr: 'piped',
        });
        const { stdout } = await cmd.output();
        const claudePath = new TextDecoder().decode(stdout).trim().split('\n')[0].trim();
        
        if (claudePath) {
          // Claude is a JS script — the actual CLI is in the same package
          // Resolve to the package's cli.js
          const possibleCliJs = claudePath.replace(/[/\\]claude(\.cmd|\.ps1)?$/i, '') + 
            '/node_modules/@anthropic-ai/claude-code/cli.js';
          
          try {
            cliContent = await Deno.readTextFile(possibleCliJs);
          } catch {
            // The claude binary might itself contain model references
            try {
              cliContent = await Deno.readTextFile(claudePath);
            } catch {
              // Give up on this path
            }
          }
        }
      } catch {
        // which/where failed
      }
    }

    if (!cliContent) {
      console.log("Model fetcher: Could not find Claude CLI binary");
      return null;
    }

    // Extract model IDs matching the pattern: claude-<family>-<version>-YYYYMMDD
    const modelPattern = /claude-[a-z0-9-]+-\d{8}/g;
    const matches = cliContent.match(modelPattern) || [];
    
    // Deduplicate and filter out non-model patterns
    const uniqueModels = [...new Set(matches)].filter(id => {
      // Must be a plausible model ID (contains a known family name)
      return id.includes('opus') || id.includes('sonnet') || id.includes('haiku') || id.includes('code');
    });

    if (uniqueModels.length === 0) {
      console.log("Model fetcher: No model IDs found in CLI binary");
      return null;
    }

    console.log(`Model fetcher: Discovered ${uniqueModels.length} models from CLI binary`);
    return uniqueModels;
  } catch (error) {
    console.error("Failed to parse models from CLI:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Build models record from CLI-discovered model IDs.
 * Creates ModelInfo entries with inferred metadata.
 */
function buildModelsFromCLI(modelIds: string[]): Record<string, ModelInfo> {
  const models: Record<string, ModelInfo> = {};

  for (const id of modelIds) {
    const tier = classifyTier(id);
    const familyName = id.includes('opus') ? 'Opus' : id.includes('sonnet') ? 'Sonnet' : id.includes('haiku') ? 'Haiku' : 'Claude';
    
    // Extract version info from ID
    const versionMatch = id.match(/(\d+)(?:-(\d+))?-(\d{8})$/);
    const majorVersion = versionMatch ? versionMatch[1] : '';
    const minorVersion = versionMatch?.[2] ? `.${versionMatch[2]}` : '';
    
    models[id] = {
      name: `Claude ${familyName} ${majorVersion}${minorVersion}`,
      description: `Claude ${familyName} ${majorVersion}${minorVersion} (discovered from CLI)`,
      contextWindow: inferContextWindow(id),
      recommended: false,
      supportsThinking: inferSupportsThinking(id),
      tier,
      deprecated: inferDeprecated(id),
    };
  }

  // Build aliases from CLI-discovered models
  const apiLikeEntries: AnthropicModelEntry[] = modelIds.map(id => ({
    id,
    display_name: models[id]?.name || id,
    created_at: extractDateFromId(id),
    type: 'model',
  }));

  buildAliases(models, apiLikeEntries);

  return models;
}

/**
 * Extract a date string from a model ID (the YYYYMMDD suffix).
 */
function extractDateFromId(id: string): string {
  const match = id.match(/(\d{4})(\d{2})(\d{2})$/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}T00:00:00Z`;
  }
  return '2024-01-01T00:00:00Z';
}

/**
 * Fetch and cache models. Returns the models record.
 * Strategy: API key > CLI binary parsing > null (use hardcoded defaults).
 */
export async function fetchModels(): Promise<Record<string, ModelInfo> | null> {
  const now = Date.now();

  // Return cached if still fresh
  if (cachedModels && (now - lastFetchTime) < CACHE_TTL_MS) {
    return cachedModels;
  }

  // Strategy 1: Use Anthropic API (if API key is available)
  const apiModels = await fetchFromAPI();
  if (apiModels && apiModels.length > 0) {
    cachedModels = buildModelsFromAPI(apiModels);
    lastFetchTime = now;
    console.log(`Model fetcher: Loaded ${Object.keys(cachedModels).length} models from Anthropic API`);
    return cachedModels;
  }

  // Strategy 2: Parse from installed CLI binary
  const cliModelIds = await parseModelsFromCLI();
  if (cliModelIds && cliModelIds.length > 0) {
    cachedModels = buildModelsFromCLI(cliModelIds);
    lastFetchTime = now;
    console.log(`Model fetcher: Loaded ${Object.keys(cachedModels).length} models from CLI binary`);
    return cachedModels;
  }

  // Fallback: use hardcoded defaults
  console.log("Model fetcher: No dynamic source available, using hardcoded defaults");
  return null;
}

/**
 * Start periodic model refresh (call once at startup).
 */
export function startModelRefresh(
  updateCallback: (models: Record<string, ModelInfo>) => void
): void {
  // Initial fetch
  fetchModels().then(models => {
    if (models) {
      updateCallback(models);
    }
  }).catch(err => {
    console.error("Initial model fetch failed:", err);
  });

  // Periodic refresh
  refreshInterval = setInterval(async () => {
    try {
      // Force re-fetch by clearing cache
      cachedModels = null;
      const models = await fetchModels();
      if (models) {
        updateCallback(models);
        console.log(`Model refresh: Updated ${Object.keys(models).length} models`);
      }
    } catch (err) {
      console.error("Model refresh failed:", err);
    }
  }, CACHE_TTL_MS);
}

/**
 * Stop periodic model refresh.
 */
export function stopModelRefresh(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

/**
 * Clear the model cache (useful for testing or manual refresh).
 */
export function clearModelCache(): void {
  cachedModels = null;
  lastFetchTime = 0;
}
