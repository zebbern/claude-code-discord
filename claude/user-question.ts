/**
 * AskUserQuestion — Interactive question flow for Claude ↔ Discord user.
 *
 * When Claude needs clarification mid-session, the SDK fires the
 * `AskUserQuestion` tool through the `canUseTool` callback.  This module
 * converts the structured question into Discord buttons / selects,
 * waits for the user's response, and returns answers to the SDK.
 *
 * @module claude/user-question
 */

import type { EmbedData, ComponentData, MessageContent } from "../discord/types.ts";

// ================================
// Types (matches SDK AskUserQuestion schema)
// ================================

/** A single option within a question. */
export interface AskUserOption {
  /** Display text (1-5 words). */
  label: string;
  /** Explanation of what this option means. */
  description: string;
}

/** A single question the SDK wants to ask. */
export interface AskUserQuestionItem {
  /** The full question text. */
  question: string;
  /** Very short label / chip (max 12 chars). */
  header: string;
  /** 2-4 available choices. */
  options: AskUserOption[];
  /** Allow multiple selections when true. */
  multiSelect?: boolean;
}

/** Full input payload from the AskUserQuestion tool. */
export interface AskUserQuestionInput {
  questions: AskUserQuestionItem[];
  answers?: Record<string, string>;
}

/**
 * Callback type for the ask-user flow.
 *
 * Implementations must:
 * 1. Present the questions to the user (e.g. Discord embed + buttons).
 * 2. Collect answers (with a reasonable timeout).
 * 3. Return a map of `question → answer` strings.
 *
 * Throwing rejects the tool use (deny).
 */
export type AskUserCallback = (input: AskUserQuestionInput) => Promise<Record<string, string>>;

// ================================
// Discord UI Builders
// ================================

/**
 * Build a Discord embed + button components for a set of questions.
 *
 * Returns one embed per question along with an ActionRow of buttons
 * for each question's options.  The `customId` of each button encodes
 * the question index and option index so the collector can parse it.
 */
export function buildQuestionMessages(questions: AskUserQuestionItem[]): MessageContent[] {
  const messages: MessageContent[] = [];

  for (let qi = 0; qi < questions.length; qi++) {
    const q = questions[qi];

    // Build embed
    const embed: EmbedData = {
      color: 0xff9900, // Orange — "waiting for you"
      title: `❓ Claude needs your input — ${q.header}`,
      description: q.question,
      fields: q.options.map((opt, oi) => ({
        name: `${oi + 1}. ${opt.label}`,
        value: opt.description,
        inline: true,
      })),
      footer: {
        text: q.multiSelect
          ? 'Select one or more options, then click Confirm'
          : 'Click an option to answer',
      },
      timestamp: true,
    };

    // Build buttons — max 5 per row, SDK allows 2-4 options
    const buttons: ComponentData[] = q.options.map((opt, oi) => ({
      type: 'button' as const,
      customId: `ask-user:${qi}:${oi}`,
      label: opt.label,
      style: 'primary' as const,
    }));

    // For multi-select, add a confirm button
    if (q.multiSelect) {
      buttons.push({
        type: 'button' as const,
        customId: `ask-user-confirm:${qi}`,
        label: '✅ Confirm',
        style: 'success' as const,
      });
    }

    messages.push({
      embeds: [embed],
      components: [{ type: 'actionRow', components: buttons }],
    });
  }

  return messages;
}

/**
 * Parse an `ask-user:qi:oi` custom ID into question/option indices.
 * Returns null if the ID doesn't match the pattern.
 */
export function parseAskUserButtonId(customId: string): { questionIndex: number; optionIndex: number } | null {
  const match = customId.match(/^ask-user:(\d+):(\d+)$/);
  if (!match) return null;
  return {
    questionIndex: Number(match[1]),
    optionIndex: Number(match[2]),
  };
}

/**
 * Check if a custom ID is an ask-user confirm button.
 */
export function parseAskUserConfirmId(customId: string): { questionIndex: number } | null {
  const match = customId.match(/^ask-user-confirm:(\d+)$/);
  if (!match) return null;
  return { questionIndex: Number(match[1]) };
}
