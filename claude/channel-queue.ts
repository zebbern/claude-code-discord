/**
 * Same-channel /claude queue — single waiting slot per Discord channel.
 * Queue only applies to primary /claude (not continue/thread/enhanced).
 */

export interface QueuedClaudeJob<TCtx = unknown> {
  ctx: TCtx;
  prompt: string;
  explicitSessionId?: string;
  enqueuedAt: number;
}

const queueByChannel = new Map<string, QueuedClaudeJob>();

/** Try to place a job in the channel's single slot. Returns false if already full. */
export function tryEnqueueClaudeJob<TCtx>(
  channelId: string,
  job: QueuedClaudeJob<TCtx>,
): boolean {
  if (queueByChannel.has(channelId)) return false;
  queueByChannel.set(channelId, job as QueuedClaudeJob);
  return true;
}

/** Remove and return the queued job, if any. */
export function takeClaudeJob<TCtx = unknown>(
  channelId: string,
): QueuedClaudeJob<TCtx> | undefined {
  const job = queueByChannel.get(channelId) as QueuedClaudeJob<TCtx> | undefined;
  if (job) queueByChannel.delete(channelId);
  return job;
}

/** Drop the queued job without running it. Returns the dropped job if present. */
export function clearClaudeJob<TCtx = unknown>(
  channelId: string,
): QueuedClaudeJob<TCtx> | undefined {
  return takeClaudeJob<TCtx>(channelId);
}

export function peekClaudeJob(channelId: string): QueuedClaudeJob | undefined {
  return queueByChannel.get(channelId);
}

export function hasClaudeJob(channelId: string): boolean {
  return queueByChannel.has(channelId);
}

/** Test helper — clear all queued jobs. */
export function resetClaudeQueueForTests(): void {
  queueByChannel.clear();
}
