# AGENTS GUIDELINES

- You have skills which have practices, patterns or good information for specific work
- Quality over quantity — fewer high-quality outputs over many low-quality ones and use caution over speed.
- Prefer clean architecture, verifying and using up to date information, flexibility over rigidity, flexible code/development, good dead-code & dependency hygiene (knip) if relevant, for trivial tasks, use judgment.
- TypeScript: keep imports at the top of the file (no inline imports). Switches over unions/enums must be exhaustive (`never` in `default`).

It can be spawned agents for specific tasks, but don't let them run wild. Always review their output and verify it against the real code/real run before accepting it.

## Presentation & UX

Build for flexible, context-aware presentation rather than fixed dimensions or one-size layouts.

- Prefer structures that adapt to the surface (Discord embeds and components, CLI/TUI output, docs, or a future web UI) instead of hard-coded widths, lengths, or one-device assumptions.
- Keep text readable across contexts: scale or truncate thoughtfully, avoid walls of unreadable output, and preserve hierarchy (title → summary → detail).
- When content must fit platform limits (e.g. Discord embed caps), truncate safely with a clear indicator rather than failing or overflowing silently.

## Knowledge Freshness & Research Preferences

Do not rely solely on your internal knowledge or training data when making implementation decisions. Your memory is frequently outdated.

Before implementing anything non-trivial (especially integrations, tools, SDKs, platforms, AI agents, or architectural patterns):

1. Actively look up the **latest** official documentation, release notes, changelogs, and recommended approaches.
2. Check whether newer versions, official solutions, or better patterns already exist that would change how the task should be approached.
3. Prefer using current best practices and existing tools over rebuilding something from scratch based on older knowledge.
4. If there is any uncertainty about the current recommended way to do something, ask clarifying questions instead of defaulting to what you remember.

Why this matters:
Defaulting to internal knowledge often leads to outdated implementations. For example, an agent might implement an older pattern for something like MCP or an AI agent integration simply because that is what it "knows," without checking whether a newer release, official SDK, or simpler approach has become available. Always verify first.

## Testing & Verification Preferences

Do not create test files or full test suites by default.

Only **keep** automated tests when they provide clear and lasting value. Good candidates include complex business logic, algorithms with meaningful edge cases, high-risk code (security, concurrency, money), or behavior that is expensive to verify manually over time.

Do **not** keep tests for:

- Trivial code (simple getters/setters, constructors without logic, pure data classes)
- Configuration, constants, or one-off scripts
- Simple CRUD, glue code, or thin wrappers
- Anything where the cost of writing and maintaining the test outweighs its value

**Temporary tests while working:** You may write short-lived tests to reproduce a bug, drive a fix, or check an edge case. When the work is done, delete those tests unless they meet the keep-criteria above. Do not leave session-only or glue tests in the repo.

Passing automated tests, scripts, or environment checks does **not** mean something works correctly or as intended. Automated tests often confirm that code responded or that elements appeared, but they frequently miss whether the intended outcome actually happened for a user.

### Real runs over green mocks

Automated tests that mock the network, SDK, or filesystem often stay green while production is broken. Prefer a real run for anything that crosses a boundary (HTTP, Discord API, Claude SDK, git/shell, MCP).

Watch for **silent negatives**: empty results, "not found," or soft failures that mean "we never checked" or "the request was invalid," not "there is nothing." Prefer failures that surface the real error over empty success.

When a mock/unit test can't catch the bug class (dead URL, wrong query flag, SDK contract, runtime-only import), either:

1. Verify with a real run / smoke path, or
2. Keep a narrow contract/integration check that exercises the real boundary — and mark network-dependent tests clearly so they aren't treated as proof of uptime.

Do not treat a large green suite as evidence that integrations work.

When verifying that a feature, flow, or change works:

- Test it the way a real user would.
- For anything involving a UI or browser, open the application and perform the actual clicks, navigation, and steps a user would take. Confirm that the final result matches what was intended.
- Prefer observing the real user-facing outcome over assuming that green tests equal a working feature.

This is especially important when verifying your own changes — the same assumptions that produced the code can also produce tests that pass while the feature remains broken for users.

## Systematic Fix Preferences

When fixing a bug, incorrect pattern, anti-pattern, or issue in one place, do not stop at the single occurrence that was reported or noticed.

Many bugs follow recurring patterns (missing checks, incorrect error handling, copy-pasted logic, deprecated usage, etc.). Leaving the same problem elsewhere creates inconsistency and technical debt.

- Search the codebase for similar instances of the same problem or pattern.
- Fix all reasonable occurrences that share the same root cause or approach in the same change.
- Prefer consistent, thorough fixes over narrow one-off patches.

This is especially important for:

- Security-related issues
- Repeated error handling or validation
- Copy-pasted or duplicated logic
- Deprecated or incorrect patterns that appear in multiple places

Keep the scope proportional. Do not turn a focused fix into a large unrelated refactor — limit the change to the same class of problem.

## Claimed vs Wired

Do not ship half-features: APIs, Maps, helpers, or modules that nothing calls, or PR claims that the code does not actually do.

- Either finish the wiring end-to-end (call sites, control paths, cancel/status) or do not land the claim.
- Prefer deleting unused scaffolding over leaving dead "future" code that looks complete.

## Concurrency & Shared State

When touching session, AbortController, query, or similar shared state:

- State explicitly whether it is **per-channel** (or per-session/thread) or **global**.
- Verify both: the intended isolation path and that other channels/sessions are not aborted, overwritten, or left stale.
- Get/set/clear keys must be symmetric (same default key when an id is omitted).

## Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals. Prefer real user-facing checks. Use automated tests only when they meet the keep-criteria in Testing & Verification (or as temporary repros you delete afterward):

- "Add validation" → "Confirm invalid inputs are rejected the way a user would hit them" (keep a unit test only if the logic is high-risk / edge-heavy)
- "Fix the bug" → "Reproduce it, fix it, confirm the user-facing path works; delete any temporary repro test unless it meets keep-criteria"
- "Refactor X" → "Ensure existing verification still passes before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, clarifying questions come before implementation rather than after mistakes, and the repo does not accumulate low-value tests.

@README.md - Info about Project,
@CHANGELOG.md - Hold changelogs,
