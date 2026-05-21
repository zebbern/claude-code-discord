# Per-Project Settings Roadmap

Currently, binding a thread to a project only affects the `cwd` passed to the Claude Code SDK. All other settings (model, thinking mode, system prompt, `additionalDirectories`, sandbox) remain global.

## Future: Per-project settings

The planned extension is to support per-project overrides for any `UnifiedBotSettings` field. Proposed shape in `.bot-data/project-settings.json`:

```jsonc
{
  "<absoluteProjectPath>": {
    "defaultModel": "sonnet",
    "thinkingMode": "auto",
    "defaultSystemPrompt": "You are working on the Foo project.",
    "additionalDirectories": ["/shared/libraries"],
    "enableSandbox": true
  }
}
```

These overrides would be applied in `getQueryOptions()` in `core/handler-registry.ts` on top of the global `UnifiedBotSettings`, keyed by the resolved `cwd` for the channel.

A natural UX would be `/project settings <key> <value>` and `/project settings show` to inspect.

## Also out of scope for v1

- `/git`, `/shell`, `/agent` cwds (they still use the global `workDir`)
- AskUser/permission routing
- Widening `isOurChannel()` to include `MONITOR_CHANNEL_ID` for `/project bind` when the monitor channel differs from the bot's main channel
