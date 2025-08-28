// Proxy configuration utilities

export interface ProxyConfig {
  enabled: boolean;
  url: string | null;
  noProxyDomains: string[];
  bypassLocal: boolean;
}

/**
 * Get proxy configuration from environment variables and settings
 */
export function getProxyConfig(): ProxyConfig {
  const httpProxy = Deno.env.get("HTTP_PROXY") || Deno.env.get("http_proxy");
  const httpsProxy = Deno.env.get("HTTPS_PROXY") || Deno.env.get("https_proxy");
  const noProxy = Deno.env.get("NO_PROXY") || Deno.env.get("no_proxy");
  
  // Parse NO_PROXY domains
  const noProxyDomains = noProxy ? 
    noProxy.split(',').map(domain => domain.trim().toLowerCase()) : 
    ['localhost', '127.0.0.1', '::1'];

  return {
    enabled: !!(httpProxy || httpsProxy),
    url: httpsProxy || httpProxy || null,
    noProxyDomains,
    bypassLocal: true
  };
}

/**
 * Check if a URL should bypass proxy based on NO_PROXY settings
 */
export function shouldBypassProxy(url: string, proxyConfig: ProxyConfig): boolean {
  if (!proxyConfig.enabled) {
    return true; // No proxy configured
  }

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Check against NO_PROXY domains
    for (const domain of proxyConfig.noProxyDomains) {
      if (domain === '*') {
        return true; // Wildcard bypass
      }
      
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        return true;
      }
      
      // Handle IP addresses and CIDR ranges (simplified)
      if (domain.includes('/')) {
        // CIDR notation - simplified check for exact IP match
        const [ip] = domain.split('/');
        if (hostname === ip) {
          return true;
        }
      }
    }

    return false;
  } catch {
    // Invalid URL, err on side of caution
    return true;
  }
}

/**
 * Configure fetch options with proxy settings
 */
export function configureFetchWithProxy(
  options: RequestInit = {}, 
  proxyConfig: ProxyConfig,
  url: string
): RequestInit {
  if (!proxyConfig.enabled || !proxyConfig.url || shouldBypassProxy(url, proxyConfig)) {
    return options;
  }

  // Note: Deno doesn't have built-in proxy support for fetch
  // This would typically require a proxy agent in Node.js
  // For now, we'll add proxy headers that some services recognize
  const headers = new Headers(options.headers);
  
  // Add proxy-related headers that some services might use
  headers.set('X-Proxy-URL', proxyConfig.url);
  
  return {
    ...options,
    headers
  };
}

/**
 * Get proxy status information
 */
export function getProxyStatus(): {
  enabled: boolean;
  proxyUrl: string | null;
  noProxyDomains: string[];
  environmentVariables: Record<string, string | undefined>;
} {
  const config = getProxyConfig();
  
  return {
    enabled: config.enabled,
    proxyUrl: config.url,
    noProxyDomains: config.noProxyDomains,
    environmentVariables: {
      HTTP_PROXY: Deno.env.get("HTTP_PROXY"),
      HTTPS_PROXY: Deno.env.get("HTTPS_PROXY"),
      NO_PROXY: Deno.env.get("NO_PROXY"),
      http_proxy: Deno.env.get("http_proxy"),
      https_proxy: Deno.env.get("https_proxy"),
      no_proxy: Deno.env.get("no_proxy")
    }
  };
}

/**
 * Set proxy environment variables
 */
export function setProxyEnvironment(proxyUrl: string, noProxyDomains: string[] = []): void {
  if (proxyUrl) {
    Deno.env.set("HTTP_PROXY", proxyUrl);
    Deno.env.set("HTTPS_PROXY", proxyUrl);
  }
  
  if (noProxyDomains.length > 0) {
    Deno.env.set("NO_PROXY", noProxyDomains.join(','));
  }
}

/**
 * Clear proxy environment variables
 */
export function clearProxyEnvironment(): void {
  Deno.env.delete("HTTP_PROXY");
  Deno.env.delete("HTTPS_PROXY");
  Deno.env.delete("NO_PROXY");
  Deno.env.delete("http_proxy");
  Deno.env.delete("https_proxy");
  Deno.env.delete("no_proxy");
}

/**
 * Test proxy connectivity
 */
export async function testProxyConnection(proxyUrl: string): Promise<{
  success: boolean;
  error?: string;
  responseTime?: number;
}> {
  const startTime = Date.now();
  
  try {
    // Test connectivity to a well-known endpoint through proxy
    const testUrl = "https://httpbin.org/ip";
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Claude-Discord-Bot-Proxy-Test/1.0'
      }
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const responseTime = Date.now() - startTime;
    return {
      success: true,
      responseTime
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}