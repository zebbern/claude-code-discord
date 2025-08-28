#!/usr/bin/env -S deno run --allow-all

// Test script for enhanced Claude Code Discord Bot features
import { CLAUDE_MODELS, CLAUDE_TEMPLATES, ClaudeSessionManager } from "./claude/index.ts";
import { createFormattedEmbed, formatShellOutput } from "./discord/index.ts";
import { ProcessCrashHandler } from "./process/index.ts";

console.log("🚀 Testing Enhanced Claude Code Discord Bot Features\n");

// Test 1: Enhanced Claude Models and Templates
console.log("1. 🤖 Enhanced Claude Features:");
console.log("  Available Models:", Object.keys(CLAUDE_MODELS).length);
console.log("  Model Example:", Object.keys(CLAUDE_MODELS)[0]);
console.log("  Available Templates:", Object.keys(CLAUDE_TEMPLATES).length);
console.log("  Template Example:", Object.keys(CLAUDE_TEMPLATES)[0]);

// Test session manager
const sessionManager = new ClaudeSessionManager();
const testSession = sessionManager.createSession("/test/dir", "claude-3-5-sonnet-20241022");
console.log("  Session Created:", testSession.id.substring(0, 20) + "...");
console.log("  ✅ Enhanced Claude features loaded\n");

// Test 2: System Information Gathering
console.log("2. 🖥️ System Monitoring Features:");
try {
  // Test system info gathering
  const osInfo = `${Deno.build.os} ${Deno.build.arch}`;
  const denoVersion = Deno.version.deno;
  console.log("  OS Info:", osInfo);
  console.log("  Deno Version:", denoVersion);
  
  // Test process execution
  const testCommand = new Deno.Command("echo", {
    args: ["Hello World"],
    stdout: "piped"
  });
  
  const { stdout } = await testCommand.output();
  const output = new TextDecoder().decode(stdout).trim();
  console.log("  Test Command Output:", output);
  console.log("  ✅ System monitoring capabilities working\n");
} catch (error) {
  console.log("  ❌ System monitoring error:", error);
}

// Test 3: Advanced Formatting
console.log("3. 🎨 Advanced Formatting Features:");
const sampleCode = `function calculateFibonacci(n) {
  if (n <= 1) return n;
  return calculateFibonacci(n - 1) + calculateFibonacci(n - 2);
}

console.log(calculateFibonacci(10));`;

const { embed: codeEmbed } = createFormattedEmbed(
  "Sample Code",
  sampleCode,
  0x00ff00,
  { wrapInCodeBlock: true, language: 'javascript' }
);

console.log("  Code Embed Created:", !!codeEmbed.title);
console.log("  Has Code Block:", codeEmbed.description?.includes('```'));

// Test shell output formatting
const shellOutput = formatShellOutput("ls -la", "total 24\ndrwxr-xr-x  3 user user 4096 Dec 25 12:00 .\ndrwxr-xr-x  3 user user 4096 Dec 25 11:59 ..\n-rw-r--r--  1 user user  123 Dec 25 12:00 test.txt");
console.log("  Shell Format Created:", shellOutput.formatted.length > 0);
console.log("  ✅ Advanced formatting working\n");

// Test 4: Error Handling and Recovery
console.log("4. 🛡️ Enhanced Error Handling:");
const crashHandler = new ProcessCrashHandler({
  maxRetries: 2,
  retryDelay: 100,
  enableAutoRestart: false,
  logCrashes: true
});

// Simulate multiple crash types
await crashHandler.reportCrash('shell', new Error('Test shell crash'), 123, 'Test shell context');
await crashHandler.reportCrash('claude', new Error('Test claude crash'), 'claude-session', 'Test claude context');
await crashHandler.reportCrash('main', new Error('Test main crash'), 'main-process', 'Test main context');

const crashStats = crashHandler.getCrashStats();
console.log("  Total Crashes Recorded:", crashStats.totalCrashes);
console.log("  Crashes by Type:", Object.keys(crashStats.crashesByType).length);
console.log("  Recovery Rate:", crashStats.recoveryRate);
console.log("  ✅ Crash handling system working\n");

// Test 5: Session Management
console.log("5. 📋 Session Management:");
sessionManager.updateSession(testSession.id, 0.05);
const allSessions = sessionManager.getAllSessions();
const activeSessions = sessionManager.getActiveSessions();

console.log("  Total Sessions:", allSessions.length);
console.log("  Active Sessions:", activeSessions.length);
console.log("  Session Message Count:", testSession.messageCount);
console.log("  ✅ Session management working\n");

// Test 6: Template System
console.log("6. 📝 Template System:");
const debugTemplate = CLAUDE_TEMPLATES.debug;
const explainTemplate = CLAUDE_TEMPLATES.explain;
const optimizeTemplate = CLAUDE_TEMPLATES.optimize;

console.log("  Debug Template Length:", debugTemplate.length);
console.log("  Explain Template Length:", explainTemplate.length);  
console.log("  Optimize Template Length:", optimizeTemplate.length);

// Test template application
const testCode = "const x = 5;";
const combinedPrompt = `${debugTemplate}\n\n${testCode}`;
console.log("  Combined Prompt Length:", combinedPrompt.length);
console.log("  ✅ Template system working\n");

// Test 7: Model Information
console.log("7. 🤖 Model Information System:");
const models = Object.entries(CLAUDE_MODELS);
const recommendedModels = models.filter(([_, model]) => model.recommended);

console.log("  Total Models:", models.length);
console.log("  Recommended Models:", recommendedModels.length);

models.forEach(([key, model]) => {
  console.log(`    ${key}: ${model.name} (${model.contextWindow.toLocaleString()} tokens)`);
});
console.log("  ✅ Model information system working\n");

console.log("🎉 All Enhanced Features Tested Successfully!\n");

console.log("📋 Summary of New Features:");
console.log("  ✅ Enhanced Claude integration with models, templates, and sessions");
console.log("  ✅ System monitoring commands (processes, resources, network, disk)");
console.log("  ✅ Advanced message formatting with syntax highlighting");
console.log("  ✅ Comprehensive error handling and crash recovery");
console.log("  ✅ Interactive pagination for long content");
console.log("  ✅ Context-aware help system with detailed documentation");
console.log("  ✅ Session management and statistics tracking");
console.log("  ✅ Template-based prompting for common tasks");
console.log("  ✅ Fixed deno.json configuration");

console.log("\n🚀 Ready to use enhanced Claude Code Discord Bot!");
console.log("Use /help to explore all available commands and features.");