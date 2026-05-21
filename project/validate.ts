/**
 * Validate and canonicalize a user-supplied path as a git work-tree root.
 *
 * Uses `Deno.Command` directly (NOT executeGitCommand) so we can inspect the
 * exit code — executeGitCommand swallows non-zero exits and returns a string.
 */

import { resolve } from "https://deno.land/std@0.208.0/path/mod.ts";

/**
 * Validate `rawPath` and return its canonical git work-tree root.
 *
 * @throws {Error} with a user-friendly message on any failure.
 */
export async function validateProjectPath(rawPath: string): Promise<string> {
  // 1. Expand leading ~
  const home = Deno.env.get("HOME");
  if (!home && rawPath.startsWith("~")) {
    throw new Error("HOME environment variable is not set; cannot expand ~ in path");
  }
  const homeStr = home ?? "";
  const expanded = rawPath.startsWith("~/")
    ? homeStr + rawPath.slice(1)
    : rawPath === "~"
    ? homeStr
    : rawPath;

  // 2. Resolve to absolute path
  const abs = resolve(expanded);

  // 3. realPath — verifies existence
  let real: string;
  try {
    real = await Deno.realPath(abs);
  } catch {
    throw new Error(`Path not found: ${abs}`);
  }

  // 4. stat — verifies it is a directory
  let info: Deno.FileInfo;
  try {
    info = await Deno.stat(real);
  } catch {
    throw new Error(`Path not found: ${real}`);
  }
  if (!info.isDirectory) {
    throw new Error(`Not a directory: ${real}`);
  }

  // 5. git rev-parse --show-toplevel — verifies it is inside a git repo
  const cmd = new Deno.Command("git", {
    args: ["-C", real, "rev-parse", "--show-toplevel"],
    stdout: "piped",
    stderr: "piped",
  });
  const output = await cmd.output();
  if (output.code !== 0) {
    throw new Error(`Not a git repository: ${real}`);
  }

  // 6. Decode the work-tree root reported by git
  const workTreeRoot = new TextDecoder().decode(output.stdout).trim();

  // 7. Canonicalize the root as well (symlinks, etc.)
  let canonicalRoot: string;
  try {
    canonicalRoot = await Deno.realPath(workTreeRoot);
  } catch {
    throw new Error(`Path not found: ${workTreeRoot}`);
  }

  return canonicalRoot;
}
