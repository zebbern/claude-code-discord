import { query as claudeQuery, type SDKMessage } from "@anthropic-ai/claude-code";

// Clean session ID (remove unwanted characters)
export function cleanSessionId(sessionId: string): string {
  return sessionId
    .trim()                           // Remove leading/trailing whitespace
    .replace(/^`+|`+$/g, '')         // Remove leading/trailing backticks
    .replace(/^```\n?|\n?```$/g, '') // Remove code block markers
    .replace(/[\r\n]/g, '')          // Remove line breaks
    .trim();                         // Remove whitespace again
}

// Valid SDK permission modes (maps to CLI --permission-mode)
export type SDKPermissionMode = 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions';

// Full query options for Claude Code SDK
export interface ClaudeModelOptions {
  model?: string;
  /** SDK permissionMode: 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions' */
  permissionMode?: SDKPermissionMode;
  /** MAX_THINKING_TOKENS env var value — controls thinking budget. null = default behavior */
  thinkingBudget?: number | null;
  /** Custom system prompt (replaces default) */
  systemPrompt?: string;
  /** Append to default system prompt */
  appendSystemPrompt?: string;
  /** Max turns for the conversation */
  maxTurns?: number;
  /** Fallback model on rate limit */
  fallbackModel?: string;
  /** Extra environment variables for the Claude subprocess (proxy, etc.) */
  extraEnv?: Record<string, string>;
}

// Wrapper for Claude Code SDK query function
export async function sendToClaudeCode(
  workDir: string,
  prompt: string,
  controller: AbortController,
  sessionId?: string,
  onChunk?: (text: string) => void,
  // deno-lint-ignore no-explicit-any
  onStreamJson?: (json: any) => void,
  continueMode?: boolean,
  modelOptions?: ClaudeModelOptions
): Promise<{
  response: string;
  sessionId?: string;
  cost?: number;
  duration?: number;
  modelUsed?: string;
}> {
  const messages: SDKMessage[] = [];
  let fullResponse = "";
  let resultSessionId: string | undefined;
  let modelUsed = modelOptions?.model || "Default";
  
  // Clean up session ID
  const cleanedSessionId = sessionId ? cleanSessionId(sessionId) : undefined;
  
  // Wrap with comprehensive error handling
  const executeWithErrorHandling = async (overrideModel?: string) => {
    try {
      // Determine which model to use
      const modelToUse = overrideModel || modelOptions?.model;
      
      // Determine permission mode (defaults to bypassPermissions for backward compat)
      const permMode = modelOptions?.permissionMode || "bypassPermissions";
      
      // Build environment variables for the subprocess
      const envVars: Record<string, string> = {
        ...Object.fromEntries(Object.entries(Deno.env.toObject())),
      };
      
      // Apply thinking budget via MAX_THINKING_TOKENS env var
      if (modelOptions?.thinkingBudget != null && modelOptions.thinkingBudget > 0) {
        envVars.MAX_THINKING_TOKENS = String(modelOptions.thinkingBudget);
      }
      
      // Apply extra env vars (proxy settings, etc.)
      if (modelOptions?.extraEnv) {
        Object.assign(envVars, modelOptions.extraEnv);
      }

      const queryOptions = {
        prompt,
        abortController: controller,
        options: {
          cwd: workDir,
          permissionMode: permMode as "bypassPermissions" | "default" | "plan" | "acceptEdits",
          ...(continueMode && { continue: true }),
          ...(cleanedSessionId && !continueMode && { resume: cleanedSessionId }),
          ...(modelToUse && { model: modelToUse }),
          ...(modelOptions?.systemPrompt && { customSystemPrompt: modelOptions.systemPrompt }),
          ...(modelOptions?.appendSystemPrompt && { appendSystemPrompt: modelOptions.appendSystemPrompt }),
          ...(modelOptions?.maxTurns && { maxTurns: modelOptions.maxTurns }),
          ...(modelOptions?.fallbackModel && { fallbackModel: modelOptions.fallbackModel }),
          env: envVars,
        },
      };
      
      console.log(`Claude Code: Running with ${modelToUse || 'default'} model, permission=${permMode}${modelOptions?.thinkingBudget ? `, thinking=${modelOptions.thinkingBudget}` : ''}...`);
      if (continueMode) {
        console.log(`Continue mode: Reading latest conversation in directory`);
      } else if (cleanedSessionId) {
        console.log(`Session resuming with ID: ${cleanedSessionId}`);
      }
      
      const iterator = claudeQuery(queryOptions);
      const currentMessages: SDKMessage[] = [];
      let currentResponse = "";
      let currentSessionId: string | undefined;
      
      for await (const message of iterator) {
        // Check AbortSignal to stop iteration
        if (controller.signal.aborted) {
          console.log(`Claude Code: Abort signal detected, stopping iteration`);
          break;
        }
        
        currentMessages.push(message);
        
        // For JSON streams, call dedicated callback
        if (onStreamJson) {
          onStreamJson(message);
        }
        
        // For text messages, send chunks
        // Skip for JSON stream output as it's handled by onStreamJson
        if (message.type === 'assistant' && message.message.content && !onStreamJson) {
          const textContent = message.message.content
            // deno-lint-ignore no-explicit-any
            .filter((c: any) => c.type === 'text')
            // deno-lint-ignore no-explicit-any
            .map((c: any) => c.text)
            .join('');
          
          if (textContent && onChunk) {
            onChunk(textContent);
          }
          currentResponse = textContent;
        }
        
        // Save session information
        if ('session_id' in message && message.session_id) {
          currentSessionId = message.session_id;
        }
      }
      
      return {
        messages: currentMessages,
        response: currentResponse,
        sessionId: currentSessionId,
        aborted: controller.signal.aborted,
        modelUsed: modelToUse || "Default"
      };
    // deno-lint-ignore no-explicit-any
    } catch (error: any) {
      // Properly handle process exit code 143 (SIGTERM) and AbortError
      if (error.name === 'AbortError' || 
          controller.signal.aborted || 
          (error.message && error.message.includes('exited with code 143'))) {
        console.log(`Claude Code: Process terminated by abort signal`);
        return {
          messages: [],
          response: "",
          sessionId: undefined,
          aborted: true,
          modelUsed: "Default"
        };
      }
      throw error;
    }
  };
  
  // First try with specified model (or default)
  try {
    const result = await executeWithErrorHandling();
    
    if (result.aborted) {
      return { response: "Request was cancelled", modelUsed: result.modelUsed };
    }
    
    messages.push(...result.messages);
    fullResponse = result.response;
    resultSessionId = result.sessionId;
    modelUsed = result.modelUsed;
    
    // Get information from the last message
    const lastMessage = messages[messages.length - 1];
    
    return {
      response: fullResponse || "No response received",
      sessionId: resultSessionId,
      cost: 'total_cost_usd' in lastMessage ? lastMessage.total_cost_usd : undefined,
      duration: 'duration_ms' in lastMessage ? lastMessage.duration_ms : undefined,
      modelUsed
    };
  // deno-lint-ignore no-explicit-any
  } catch (error: any) {
    // For exit code 1 errors (rate limit), retry with Haiku (cheaper/faster fallback)
    if (error.message && (error.message.includes('exit code 1') || error.message.includes('exited with code 1'))) {
      console.log("Rate limit detected, retrying with Haiku (fast fallback)...");
      
      try {
        const retryResult = await executeWithErrorHandling("haiku");
        
        if (retryResult.aborted) {
          return { response: "Request was cancelled", modelUsed: retryResult.modelUsed };
        }
        
        // Get information from the last message
        const lastRetryMessage = retryResult.messages[retryResult.messages.length - 1];
        
        return {
          response: retryResult.response || "No response received",
          sessionId: retryResult.sessionId,
          cost: 'total_cost_usd' in lastRetryMessage ? lastRetryMessage.total_cost_usd : undefined,
          duration: 'duration_ms' in lastRetryMessage ? lastRetryMessage.duration_ms : undefined,
          modelUsed: retryResult.modelUsed
        };
      // deno-lint-ignore no-explicit-any
      } catch (retryError: any) {
        // If Haiku fallback also fails
        if (retryError.name === 'AbortError' || 
            controller.signal.aborted || 
            (retryError.message && retryError.message.includes('exited with code 143'))) {
          return { response: "Request was cancelled", modelUsed: "Claude Haiku (fallback)" };
        }
        
        retryError.message += '\n\n⚠️ Both default model and Haiku fallback encountered errors. Please wait a moment and try again.';
        throw retryError;
      }
    }
    
    throw error;
  }
}