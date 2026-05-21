/**
 * /project command handlers.
 *
 * All handlers follow the deferReply → editReply pattern used throughout
 * the rest of the codebase.
 */

import type { InteractionContext } from "../discord/types.ts";
import type { ProjectBindings } from "./bindings.ts";
import { validateProjectPath } from "./validate.ts";

export interface ProjectHandlerDeps {
  bindings: ProjectBindings;
  defaultWorkDir: string;
}

export function createProjectHandlers(deps: ProjectHandlerDeps) {
  const { bindings, defaultWorkDir } = deps;

  return {
    /** /project action:bind path:<path> */
    async handleBind(
      ctx: InteractionContext,
      path?: string | null,
    ): Promise<void> {
      await ctx.deferReply();

      if (!path || path.trim() === "") {
        await ctx.editReply({
          content: "Please provide `path:` argument.",
        });
        return;
      }

      let validatedPath: string;
      try {
        validatedPath = await validateProjectPath(path.trim());
      } catch (err) {
        await ctx.editReply({
          content: err instanceof Error ? err.message : String(err),
        });
        return;
      }

      await bindings.setBinding(ctx.getChannelId(), validatedPath);

      await ctx.editReply({
        embeds: [
          {
            color: 0x57f287, // green
            title: "Project bound",
            description:
              `This channel is now bound to \`${validatedPath}\`.\nAll Claude queries in this channel will use that directory as the working directory.`,
          },
        ],
      });
    },

    /** /project action:unbind */
    async handleUnbind(ctx: InteractionContext): Promise<void> {
      await ctx.deferReply();

      await bindings.unsetBinding(ctx.getChannelId());

      await ctx.editReply({
        content: "Binding removed. Will use global default.",
      });
    },

    /** /project action:show */
    async handleShow(ctx: InteractionContext): Promise<void> {
      await ctx.deferReply();

      const parentChannelId =
        "getParentChannelId" in ctx &&
        typeof (ctx as { getParentChannelId?: () => string | undefined })
          .getParentChannelId === "function"
          ? (ctx as { getParentChannelId: () => string | undefined })
              .getParentChannelId()
          : undefined;

      const resolution = bindings.getEffectiveResolution(
        ctx.getChannelId(),
        parentChannelId,
      );

      const sourceLabel =
        resolution.source === "thread"
          ? "Thread binding"
          : resolution.source === "parent"
          ? "Parent channel binding"
          : "Global default";

      await ctx.editReply({
        embeds: [
          {
            color: 0x5865f2, // blurple
            title: "Current project binding",
            fields: [
              { name: "Source", value: sourceLabel, inline: true },
              { name: "Path", value: `\`${resolution.path}\``, inline: false },
              {
                name: "Effective cwd for next Claude query",
                value: `\`${resolution.path}\``,
                inline: false,
              },
            ],
          },
        ],
      });
    },

    /** /project action:list */
    async handleList(ctx: InteractionContext): Promise<void> {
      await ctx.deferReply();

      const allBindings = bindings.listBindings();

      // Attempt to list git worktrees in the default working directory.
      let worktreeLines: string | null = null;
      try {
        const cmd = new Deno.Command("git", {
          args: ["worktree", "list"],
          cwd: defaultWorkDir,
          stdout: "piped",
          stderr: "piped",
        });
        const output = await cmd.output();
        if (output.code === 0) {
          worktreeLines = new TextDecoder().decode(output.stdout).trim();
        }
      } catch {
        // Suppress — worktree listing is best-effort
      }

      const bindingLines =
        allBindings.length > 0
          ? allBindings
              .map(([channelId, path]) => `<#${channelId}> → \`${path}\``)
              .join("\n")
          : "_No bindings configured._";

      const fields = [
        {
          name: "Bound channels / threads",
          value: bindingLines,
          inline: false,
        },
      ];

      if (worktreeLines) {
        fields.push({
          name: "Available worktrees (not bound)",
          value: `\`\`\`\n${worktreeLines}\n\`\`\``,
          inline: false,
        });
      }

      await ctx.editReply({
        embeds: [
          {
            color: 0x5865f2,
            title: "Project bindings",
            fields,
          },
        ],
      });
    },
  };
}
