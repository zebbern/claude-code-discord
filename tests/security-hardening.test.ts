/**
 * Unit tests for PR #23 follow-up security/stability hardening.
 */
import { assertEquals } from "jsr:@std/assert@1";
import {
  validateBranchName,
  validateGitCommandArgs,
  splitGitArgs,
} from "../git/handler.ts";
import { shouldTruncateOutput, MAX_OUTPUT_BUFFER_SIZE } from "../shell/handler.ts";

Deno.test("validateBranchName accepts normal feature branches", () => {
  assertEquals(validateBranchName("feature/foo").valid, true);
  assertEquals(validateBranchName("fix-123").valid, true);
});

Deno.test("validateBranchName rejects shell metacharacters", () => {
  const payloads = [
    "; rm -rf /",
    "main|curl evil.com",
    "$(whoami)",
    "`id`",
    "a&&b",
    "x\ny",
    "evil'",
    'evil"',
  ];
  for (const branch of payloads) {
    const result = validateBranchName(branch);
    assertEquals(result.valid, false, `expected reject for ${JSON.stringify(branch)}`);
  }
});

Deno.test("validateBranchName rejects leading dash, .., and whitespace", () => {
  assertEquals(validateBranchName("-evil").valid, false);
  assertEquals(validateBranchName("foo..bar").valid, false);
  assertEquals(validateBranchName("foo bar").valid, false);
  assertEquals(validateBranchName("").valid, false);
});

Deno.test("validateGitCommandArgs rejects injection payloads", () => {
  const payloads = [
    "status; curl evil.com",
    "status; echo pwned",
    "log | cat /etc/passwd",
    "show $(whoami)",
    "status && rm -rf /",
    "status`id`",
  ];
  for (const command of payloads) {
    const result = validateGitCommandArgs(command);
    assertEquals(result.valid, false, `expected reject for ${JSON.stringify(command)}`);
  }
});

Deno.test("validateGitCommandArgs accepts normal and quoted git args", () => {
  assertEquals(validateGitCommandArgs("status").valid, true);
  assertEquals(validateGitCommandArgs("log --oneline -5").valid, true);
  assertEquals(validateGitCommandArgs("diff HEAD~1").valid, true);
  assertEquals(validateGitCommandArgs('commit -m "fix stuff"').valid, true);
  assertEquals(validateGitCommandArgs("commit -m 'fix stuff'").valid, true);
  assertEquals(validateGitCommandArgs('commit -m "fix; stuff"').valid, true);
  assertEquals(validateGitCommandArgs("git status").valid, true);
});

Deno.test("splitGitArgs tokenizes validated command strings for argv spawn", () => {
  assertEquals(splitGitArgs("status"), ["status"]);
  assertEquals(splitGitArgs("log --oneline -5"), ["log", "--oneline", "-5"]);
  assertEquals(splitGitArgs("  diff HEAD~1  "), ["diff", "HEAD~1"]);
  assertEquals(splitGitArgs('commit -m "fix stuff"'), ["commit", "-m", "fix stuff"]);
  assertEquals(splitGitArgs("commit -m 'fix stuff'"), ["commit", "-m", "fix stuff"]);
  assertEquals(splitGitArgs('commit -m "fix; stuff"'), ["commit", "-m", "fix; stuff"]);
  assertEquals(splitGitArgs("git status"), ["status"]);
  assertEquals(splitGitArgs('git commit -m "msg"'), ["commit", "-m", "msg"]);
});

Deno.test("shouldTruncateOutput triggers at 10 MB boundary", () => {
  assertEquals(shouldTruncateOutput(0, 100), false);
  assertEquals(shouldTruncateOutput(MAX_OUTPUT_BUFFER_SIZE - 10, 5), false);
  assertEquals(shouldTruncateOutput(MAX_OUTPUT_BUFFER_SIZE - 10, 20), true);
  assertEquals(shouldTruncateOutput(MAX_OUTPUT_BUFFER_SIZE, 1), true);
});
