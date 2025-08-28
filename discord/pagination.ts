import type { EmbedData, ComponentData } from "./types.ts";

export interface PaginationOptions {
  pageSize?: number;
  maxEmbedSize?: number;
  includePageInfo?: boolean;
  color?: number;
}

export interface PaginatedContent {
  embeds: EmbedData[];
  components?: ComponentData[][];
  totalPages: number;
}

export interface PaginationState {
  currentPage: number;
  totalPages: number;
  content: string[];
  options: PaginationOptions;
  messageId?: string;
}

// Store pagination states for navigation
const paginationStates = new Map<string, PaginationState>();

// Generate unique pagination ID
function generatePaginationId(): string {
  return `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Smart text splitting with context preservation
export function smartSplit(text: string, maxLength: number = 4000): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  const lines = text.split('\n');
  let currentChunk = '';
  
  for (const line of lines) {
    // If adding this line would exceed the limit
    if (currentChunk.length + line.length + 1 > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // If a single line is too long, split it at word boundaries
      if (line.length > maxLength) {
        const words = line.split(' ');
        let wordChunk = '';
        
        for (const word of words) {
          if (wordChunk.length + word.length + 1 > maxLength) {
            if (wordChunk) {
              chunks.push(wordChunk.trim());
              wordChunk = '';
            }
            
            // If a single word is still too long, force split it
            if (word.length > maxLength) {
              for (let i = 0; i < word.length; i += maxLength) {
                chunks.push(word.slice(i, i + maxLength));
              }
            } else {
              wordChunk = word;
            }
          } else {
            wordChunk += (wordChunk ? ' ' : '') + word;
          }
        }
        
        if (wordChunk) {
          currentChunk = wordChunk;
        }
      } else {
        currentChunk = line;
      }
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 0);
}

// Create paginated content from long text
export function createPaginatedEmbeds(
  title: string,
  content: string,
  options: PaginationOptions = {}
): PaginatedContent {
  const {
    pageSize = 4000,
    maxEmbedSize = 6000,
    includePageInfo = true,
    color = 0x0099ff
  } = options;

  const chunks = smartSplit(content, pageSize);
  const embeds: EmbedData[] = [];
  const totalPages = chunks.length;

  for (let i = 0; i < chunks.length; i++) {
    const pageTitle = totalPages > 1 && includePageInfo 
      ? `${title} (Page ${i + 1}/${totalPages})`
      : title;

    let description = chunks[i];
    
    // Ensure we don't exceed Discord's embed limits
    if (description.length > maxEmbedSize) {
      description = description.substring(0, maxEmbedSize - 3) + '...';
    }

    embeds.push({
      color,
      title: pageTitle,
      description,
      timestamp: true,
      footer: totalPages > 1 ? { 
        text: `Page ${i + 1} of ${totalPages} • Use buttons to navigate` 
      } : undefined
    });
  }

  return { embeds, totalPages };
}

// Create navigation buttons for pagination
export function createPaginationButtons(
  paginationId: string,
  currentPage: number,
  totalPages: number,
  disabled: boolean = false
): ComponentData[] {
  if (totalPages <= 1) {
    return [];
  }

  return [
    {
      type: 'button',
      customId: `pagination:${paginationId}:first`,
      label: '⏮️ First',
      style: 'secondary',
      disabled: disabled || currentPage === 0
    },
    {
      type: 'button',
      customId: `pagination:${paginationId}:prev`,
      label: '⬅️ Previous',
      style: 'secondary',
      disabled: disabled || currentPage === 0
    },
    {
      type: 'button',
      customId: `pagination:${paginationId}:info`,
      label: `${currentPage + 1}/${totalPages}`,
      style: 'primary',
      disabled: true
    },
    {
      type: 'button',
      customId: `pagination:${paginationId}:next`,
      label: '➡️ Next',
      style: 'secondary',
      disabled: disabled || currentPage === totalPages - 1
    },
    {
      type: 'button',
      customId: `pagination:${paginationId}:last`,
      label: '⏭️ Last',
      style: 'secondary',
      disabled: disabled || currentPage === totalPages - 1
    }
  ];
}

// Initialize pagination for a message
export function initializePagination(
  title: string,
  content: string,
  options: PaginationOptions = {}
): { paginationId: string; embed: EmbedData; components?: ComponentData[] } {
  const paginatedContent = createPaginatedEmbeds(title, content, options);
  
  if (paginatedContent.totalPages <= 1) {
    return {
      paginationId: '',
      embed: paginatedContent.embeds[0]
    };
  }

  const paginationId = generatePaginationId();
  const paginationState: PaginationState = {
    currentPage: 0,
    totalPages: paginatedContent.totalPages,
    content: smartSplit(content, options.pageSize || 4000),
    options
  };

  paginationStates.set(paginationId, paginationState);

  const buttons = createPaginationButtons(paginationId, 0, paginatedContent.totalPages);

  return {
    paginationId,
    embed: paginatedContent.embeds[0],
    components: buttons.length > 0 ? buttons : undefined
  };
}

// Handle pagination button interactions
export function handlePaginationInteraction(
  buttonId: string
): { embed: EmbedData; components?: ComponentData[] } | null {
  const parts = buttonId.split(':');
  if (parts.length !== 3 || parts[0] !== 'pagination') {
    return null;
  }

  const [, paginationId, action] = parts;
  const state = paginationStates.get(paginationId);
  
  if (!state) {
    return null;
  }

  let newPage = state.currentPage;
  
  switch (action) {
    case 'first':
      newPage = 0;
      break;
    case 'prev':
      newPage = Math.max(0, state.currentPage - 1);
      break;
    case 'next':
      newPage = Math.min(state.totalPages - 1, state.currentPage + 1);
      break;
    case 'last':
      newPage = state.totalPages - 1;
      break;
    case 'info':
      return null; // Info button doesn't change page
    default:
      return null;
  }

  // Update pagination state
  state.currentPage = newPage;

  // Create new embed for the current page
  const paginatedContent = createPaginatedEmbeds(
    'Content', // We'll update this with the original title
    state.content[newPage],
    { ...state.options, includePageInfo: true }
  );

  const buttons = createPaginationButtons(paginationId, newPage, state.totalPages);

  return {
    embed: {
      ...paginatedContent.embeds[0],
      title: state.options.includePageInfo 
        ? `Content (Page ${newPage + 1}/${state.totalPages})`
        : 'Content'
    },
    components: buttons.length > 0 ? buttons : undefined
  };
}

// Clean up old pagination states (call periodically)
export function cleanupPaginationStates(maxAge: number = 3600000): void { // 1 hour default
  const now = Date.now();
  const toDelete: string[] = [];
  
  for (const [id, state] of paginationStates.entries()) {
    // Extract timestamp from pagination ID
    const timestamp = parseInt(id.split('_')[1]);
    if (now - timestamp > maxAge) {
      toDelete.push(id);
    }
  }
  
  for (const id of toDelete) {
    paginationStates.delete(id);
  }
}

// Get pagination state (for debugging or advanced usage)
export function getPaginationState(paginationId: string): PaginationState | undefined {
  return paginationStates.get(paginationId);
}

// Create paginated message for long content with smart formatting
export function createPaginatedMessage(
  title: string,
  content: string,
  codeBlock?: string,
  options: PaginationOptions = {}
): { embed: EmbedData; components?: Array<{ type: 'actionRow'; components: ComponentData[] }> } {
  let processedContent = content;
  
  // Add code block formatting if specified
  if (codeBlock) {
    processedContent = `\`\`\`${codeBlock}\n${content}\n\`\`\``;
  }

  const result = initializePagination(title, processedContent, options);
  
  return {
    embed: result.embed,
    components: result.components ? [{ type: 'actionRow', components: result.components }] : undefined
  };
}