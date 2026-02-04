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

// Wrapper for Claude Code SDK query function
export async function sendToClaudeCode(
  workDir: string,
  prompt: string,
  controller: AbortController,
  sessionId?: string,
  onChunk?: (text: string) => void,
  // deno-lint-ignore no-explicit-any
  onStreamJson?: (json: any) => void,
  continueMode?: boolean
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
  let modelUsed = "Default";
  
  // Clean up session ID
  const cleanedSessionId = sessionId ? cleanSessionId(sessionId) : undefined;
  
  // Wrap with comprehensive error handling
  const executeWithErrorHandling = async (useRetryModel = false) => {
    try {
      const queryOptions = {
        prompt,
        abortController: controller,
        options: {
          cwd: workDir,
          permissionMode: "bypassPermissions" as const,
          verbose: true,
          outputFormat: "stream-json",
          ...(continueMode && { continue: true }),
          ...(cleanedSessionId && !continueMode && { resume: cleanedSessionId }),
          ...(useRetryModel && { model: "claude-sonnet-4-20250514" }),
        },
      };
      
      console.log(`Claude Code: Running with ${useRetryModel ? 'Sonnet 4' : 'default model'}...`);
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
          console.log(`Claude Code${useRetryModel ? ' (Retry)' : ''}: Abort signal detected, stopping iteration`);
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
        aborted: controller.signal.aborted
      };
    // deno-lint-ignore no-explicit-any
    } catch (error: any) {
      // Properly handle process exit code 143 (SIGTERM) and AbortError
      if (error.name === 'AbortError' || 
          controller.signal.aborted || 
          (error.message && error.message.includes('exited with code 143'))) {
        console.log(`Claude Code${useRetryModel ? ' (Retry)' : ''}: Process terminated by abort signal`);
        return {
          messages: [],
          response: "",
          sessionId: undefined,
          aborted: true
        };
      }
      throw error;
    }
  };
  
  // First try with normal model
  try {
    const result = await executeWithErrorHandling(false);
    
    if (result.aborted) {
      return { response: "Request was cancelled", modelUsed };
    }
    
    messages.push(...result.messages);
    fullResponse = result.response;
    resultSessionId = result.sessionId;
    
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
    // For exit code 1 errors, retry with Sonnet 4
    if (error.message && (error.message.includes('exit code 1') || error.message.includes('exited with code 1'))) {
      console.log("Rate limit detected, retrying with Sonnet 4...");
      modelUsed = "Claude Sonnet 4";
      
      try {
        const retryResult = await executeWithErrorHandling(true);
        
        if (retryResult.aborted) {
          return { response: "Request was cancelled", modelUsed };
        }
        
        // Get information from the last message
        const lastRetryMessage = retryResult.messages[retryResult.messages.length - 1];
        
        return {
          response: retryResult.response || "No response received",
          sessionId: retryResult.sessionId,
          cost: 'total_cost_usd' in lastRetryMessage ? lastRetryMessage.total_cost_usd : undefined,
          duration: 'duration_ms' in lastRetryMessage ? lastRetryMessage.duration_ms : undefined,
          modelUsed
        };
      // deno-lint-ignore no-explicit-any
      } catch (retryError: any) {
        // If Sonnet 4 also fails
        if (retryError.name === 'AbortError' || 
            controller.signal.aborted || 
            (retryError.message && retryError.message.includes('exited with code 143'))) {
          return { response: "Request was cancelled", modelUsed };
        }
        
        retryError.message += '\n\n⚠️ Both default model and Sonnet 4 encountered errors. Please wait a moment and try again.';
        throw retryError;
      }
    }
    
    throw error;
  }
}