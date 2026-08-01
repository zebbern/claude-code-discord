/**
 * Compact command-result embeds for /shell and /git.
 * Meta (command, exit, duration, pid) lives in fields; description is payload only.
 */

import { formatText } from "./formatting.ts";
import { filesForTruncation } from "./attachments.ts";
import type { EmbedData, FileAttachment } from "./types.ts";
import {
  EMBED_COLORS,
  firstNonEmptyLine,
  formatDuration,
  truncateField,
} from "./embed-theme.ts";

export type CommandEmbedResult = {
  embed: EmbedData;
  wasTruncated: boolean;
  files?: FileAttachment[];
};

function cleanAnsiAndNewlines(output: string): string {
  return output
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
    .trim();
}

function wrapCommand(command: string): string {
  return truncateField("`" + command.replace(/`/g, "'") + "`");
}

function gitLanguage(command: string): string {
  if (command.includes("diff")) return "diff";
  if (command.includes("log") || command.includes("status")) return "git";
  return "bash";
}

function isGitErrorOutput(output: string): boolean {
  const lower = output.toLowerCase();
  return lower.includes("error") || lower.includes("fatal") || lower.includes("failed");
}

export function buildShellResultEmbed(opts: {
  command: string;
  output: string;
  exitCode: number;
  processId: number;
  durationMs: number;
}): CommandEmbedResult {
  const ok = opts.exitCode === 0;
  const cleaned = cleanAnsiAndNewlines(opts.output);
  const duration = formatDuration(opts.durationMs);
  const body = formatText(cleaned, {
    language: "bash",
    wrapInCodeBlock: cleaned.length > 0,
    maxLength: 3500,
    truncateAt: 3300,
  });
  const files = filesForTruncation(body.wasTruncated, cleaned, "shell-output.txt");

  const fields: NonNullable<EmbedData["fields"]> = [
    { name: "Command", value: wrapCommand(opts.command), inline: false },
    { name: "Exit", value: String(opts.exitCode), inline: true },
    { name: "PID", value: String(opts.processId), inline: true },
    { name: "Duration", value: duration, inline: true },
  ];

  if (!ok) {
    const errLine = firstNonEmptyLine(cleaned);
    if (errLine) {
      fields.push({
        name: "Error",
        value: truncateField(errLine, 200),
        inline: false,
      });
    }
  }

  return {
    embed: {
      color: ok ? EMBED_COLORS.success : EMBED_COLORS.fail,
      title: "/shell",
      description: cleaned.length === 0 ? "*No output*" : body.formatted,
      fields,
      timestamp: true,
      footer: body.wasTruncated
        ? { text: "Output truncated — full output attached as .txt" }
        : undefined,
    },
    wasTruncated: body.wasTruncated,
    files,
  };
}

export function buildShellRunningEmbed(opts: {
  command: string;
  processId: number;
  longRunning?: boolean;
}): EmbedData {
  const fields: NonNullable<EmbedData["fields"]> = [
    { name: "Command", value: wrapCommand(opts.command), inline: false },
    { name: "PID", value: String(opts.processId), inline: true },
  ];
  if (opts.longRunning) {
    fields.push({
      name: "Status",
      value: "Still running… (updates when complete)",
      inline: false,
    });
  }

  return {
    color: opts.longRunning ? EMBED_COLORS.info : EMBED_COLORS.running,
    title: "/shell · running",
    fields,
    timestamp: true,
  };
}

export function buildShellErrorEmbed(opts: {
  command: string;
  processId?: number;
  error: string;
  durationMs?: number;
}): EmbedData {
  const fields: NonNullable<EmbedData["fields"]> = [
    { name: "Command", value: wrapCommand(opts.command), inline: false },
  ];
  if (opts.processId !== undefined) {
    fields.push({ name: "PID", value: String(opts.processId), inline: true });
  }
  if (opts.durationMs !== undefined) {
    fields.push({
      name: "Duration",
      value: formatDuration(opts.durationMs),
      inline: true,
    });
  }
  fields.push({
    name: "Error",
    value: truncateField(opts.error, 500),
    inline: false,
  });

  return {
    color: EMBED_COLORS.fail,
    title: "/shell · error",
    fields,
    timestamp: true,
  };
}

export function buildGitResultEmbed(opts: {
  command: string;
  output: string;
  durationMs: number;
}): CommandEmbedResult {
  const cleaned = cleanAnsiAndNewlines(opts.output);
  const isError = isGitErrorOutput(cleaned);
  const duration = formatDuration(opts.durationMs);
  const body = formatText(cleaned, {
    language: gitLanguage(opts.command),
    wrapInCodeBlock: cleaned.length > 0,
    maxLength: 3500,
    truncateAt: 3300,
  });
  const files = filesForTruncation(body.wasTruncated, cleaned, "git-output.txt");

  const fields: NonNullable<EmbedData["fields"]> = [
    { name: "Command", value: wrapCommand(`git ${opts.command}`), inline: false },
    { name: "Duration", value: duration, inline: true },
  ];

  if (isError) {
    const errLine = firstNonEmptyLine(cleaned);
    if (errLine) {
      fields.push({
        name: "Error",
        value: truncateField(errLine, 200),
        inline: false,
      });
    }
  }

  return {
    embed: {
      color: isError ? EMBED_COLORS.fail : EMBED_COLORS.success,
      title: "/git",
      description: cleaned.length === 0 ? "*No output*" : body.formatted,
      fields,
      timestamp: true,
      footer: body.wasTruncated
        ? { text: "Output truncated — full output attached as .txt" }
        : undefined,
    },
    wasTruncated: body.wasTruncated,
    files,
  };
}

export function buildGitErrorEmbed(opts: {
  command: string;
  error: string;
  durationMs?: number;
}): EmbedData {
  const fields: NonNullable<EmbedData["fields"]> = [
    { name: "Command", value: wrapCommand(`git ${opts.command}`), inline: false },
  ];
  if (opts.durationMs !== undefined) {
    fields.push({
      name: "Duration",
      value: formatDuration(opts.durationMs),
      inline: true,
    });
  }
  fields.push({
    name: "Error",
    value: truncateField(opts.error, 500),
    inline: false,
  });

  return {
    color: EMBED_COLORS.fail,
    title: "/git · error",
    fields,
    timestamp: true,
  };
}

/** Follow-up shell output (e.g. after /shell-input) with truncation attach. */
export function buildShellOutputFollowUpEmbed(opts: {
  title: string;
  processId: number;
  input: string;
  output: string;
}): CommandEmbedResult {
  const cleaned = cleanAnsiAndNewlines(opts.output);
  const body = formatText(cleaned, {
    language: "bash",
    wrapInCodeBlock: cleaned.length > 0,
    maxLength: 3500,
    truncateAt: 3300,
  });
  const files = filesForTruncation(body.wasTruncated, cleaned, "shell-output.txt");

  // Discord field values max 1024 — use description for payload when large
  const useDescription = body.formatted.length > 1000 || body.wasTruncated;

  return {
    embed: {
      color: EMBED_COLORS.info,
      title: opts.title,
      description: useDescription
        ? (cleaned.length === 0 ? "*No output*" : body.formatted)
        : undefined,
      fields: [
        { name: "PID", value: String(opts.processId), inline: true },
        { name: "Input", value: wrapCommand(opts.input), inline: true },
        ...(useDescription
          ? []
          : [{
            name: "Output",
            value: cleaned.length === 0 ? "*No output*" : body.formatted,
            inline: false,
          }]),
      ],
      timestamp: true,
      footer: body.wasTruncated
        ? { text: "Output truncated — full output attached as .txt" }
        : undefined,
    },
    wasTruncated: body.wasTruncated,
    files,
  };
}
