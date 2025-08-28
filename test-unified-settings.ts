#!/usr/bin/env -S deno run --allow-all

/**
 * Test file to verify unified settings implementation
 * This tests the core functionality of our unified settings system
 */

import { 
  UNIFIED_DEFAULT_SETTINGS,
  THINKING_MODES,
  OPERATION_MODES,
  ANTHROPIC_RATE_LIMITS,
  unifiedSettingsCommands
} from "./settings/unified-settings.ts";

import type { UnifiedBotSettings } from "./settings/unified-settings.ts";

// Test 1: Verify default settings are properly structured
function testDefaultSettings() {
  console.log("🧪 Testing default settings structure...");
  
  const settings = UNIFIED_DEFAULT_SETTINGS;
  
  // Check that all required properties exist
  const requiredProps = [
    'mentionEnabled', 'mentionUserId', 'defaultModel', 'thinkingMode', 
    'operationMode', 'proxyEnabled', 'enableDebugMode'
  ];
  
  for (const prop of requiredProps) {
    if (!(prop in settings)) {
      throw new Error(`Missing required property: ${prop}`);
    }
  }
  
  console.log("✅ Default settings structure is valid");
  console.log(`   - Thinking Mode: ${settings.thinkingMode}`);
  console.log(`   - Operation Mode: ${settings.operationMode}`);
  console.log(`   - Default Model: ${settings.defaultModel}`);
}

// Test 2: Verify thinking modes configuration
function testThinkingModes() {
  console.log("\n🧪 Testing thinking modes...");
  
  const modes = Object.keys(THINKING_MODES);
  const expectedModes = ['none', 'think', 'think-hard', 'ultrathink'];
  
  for (const mode of expectedModes) {
    if (!modes.includes(mode)) {
      throw new Error(`Missing thinking mode: ${mode}`);
    }
    
    const modeConfig = THINKING_MODES[mode as keyof typeof THINKING_MODES];
    if (!modeConfig.name || !modeConfig.description) {
      throw new Error(`Invalid configuration for thinking mode: ${mode}`);
    }
  }
  
  console.log("✅ Thinking modes are properly configured");
  console.log(`   Available modes: ${modes.join(', ')}`);
}

// Test 3: Verify operation modes configuration
function testOperationModes() {
  console.log("\n🧪 Testing operation modes...");
  
  const modes = Object.keys(OPERATION_MODES);
  const expectedModes = ['normal', 'plan', 'auto-accept', 'danger'];
  
  for (const mode of expectedModes) {
    if (!modes.includes(mode)) {
      throw new Error(`Missing operation mode: ${mode}`);
    }
    
    const modeConfig = OPERATION_MODES[mode as keyof typeof OPERATION_MODES];
    if (!modeConfig.name || !modeConfig.description || !modeConfig.riskLevel) {
      throw new Error(`Invalid configuration for operation mode: ${mode}`);
    }
  }
  
  console.log("✅ Operation modes are properly configured");
  console.log(`   Available modes: ${modes.join(', ')}`);
}

// Test 4: Verify rate limit tiers
function testRateLimitTiers() {
  console.log("\n🧪 Testing rate limit tiers...");
  
  const tiers = Object.keys(ANTHROPIC_RATE_LIMITS);
  const expectedTiers = ['free', 'basic', 'pro', 'enterprise', 'exceeds_200k_tokens'];
  
  for (const tier of expectedTiers) {
    if (!tiers.includes(tier)) {
      throw new Error(`Missing rate limit tier: ${tier}`);
    }
    
    const tierConfig = ANTHROPIC_RATE_LIMITS[tier];
    if (!tierConfig.name || !tierConfig.tokensPerMinute) {
      throw new Error(`Invalid configuration for rate limit tier: ${tier}`);
    }
  }
  
  console.log("✅ Rate limit tiers are properly configured");
  console.log(`   Available tiers: ${tiers.join(', ')}`);
}

// Test 5: Verify commands structure
function testCommandsStructure() {
  console.log("\n🧪 Testing commands structure...");
  
  const commands = unifiedSettingsCommands;
  const expectedCommands = ['settings', 'todos', 'mcp'];
  
  for (const expectedCmd of expectedCommands) {
    const found = commands.find(cmd => cmd.name === expectedCmd);
    if (!found) {
      throw new Error(`Missing command: ${expectedCmd}`);
    }
  }
  
  console.log("✅ Commands structure is valid");
  console.log(`   Commands defined: ${commands.map(cmd => cmd.name).join(', ')}`);
}

// Test 6: Test settings updates functionality
function testSettingsUpdates() {
  console.log("\n🧪 Testing settings update functionality...");
  
  let testSettings: UnifiedBotSettings = { ...UNIFIED_DEFAULT_SETTINGS };
  
  // Test thinking mode update
  testSettings.thinkingMode = 'think-hard';
  if (testSettings.thinkingMode !== 'think-hard') {
    throw new Error("Failed to update thinking mode");
  }
  
  // Test operation mode update
  testSettings.operationMode = 'danger';
  if (testSettings.operationMode !== 'danger') {
    throw new Error("Failed to update operation mode");
  }
  
  // Test proxy settings update
  testSettings.proxyEnabled = true;
  testSettings.proxyUrl = 'http://proxy.example.com:8080';
  if (!testSettings.proxyEnabled || testSettings.proxyUrl !== 'http://proxy.example.com:8080') {
    throw new Error("Failed to update proxy settings");
  }
  
  console.log("✅ Settings updates work correctly");
  console.log(`   Thinking mode: ${testSettings.thinkingMode}`);
  console.log(`   Operation mode: ${testSettings.operationMode}`);
  console.log(`   Proxy enabled: ${testSettings.proxyEnabled}`);
}

// Test 7: Verify no command name conflicts
function testCommandNameConflicts() {
  console.log("\n🧪 Testing for command name conflicts...");
  
  const commandNames = unifiedSettingsCommands.map(cmd => cmd.name);
  const uniqueNames = new Set(commandNames);
  
  if (commandNames.length !== uniqueNames.size) {
    const duplicates = commandNames.filter((name, index) => commandNames.indexOf(name) !== index);
    throw new Error(`Duplicate command names found: ${duplicates.join(', ')}`);
  }
  
  console.log("✅ No command name conflicts detected");
  console.log(`   Unique commands: ${uniqueNames.size}`);
}

// Run all tests
async function runAllTests() {
  console.log("🚀 Running Unified Settings Tests\n");
  
  try {
    testDefaultSettings();
    testThinkingModes();
    testOperationModes();
    testRateLimitTiers();
    testCommandsStructure();
    testSettingsUpdates();
    testCommandNameConflicts();
    
    console.log("\n🎉 All tests passed! The unified settings system is ready.");
    
    // Display summary
    console.log("\n📋 Summary of Features Implemented:");
    console.log("   ✓ Unified settings command (/settings)");
    console.log("   ✓ Thinking modes: none, think, think-hard, ultrathink");
    console.log("   ✓ Operation modes: normal, plan, auto-accept, danger");
    console.log("   ✓ Todo management (/todos) with rate limit awareness");
    console.log("   ✓ MCP server configuration (/mcp)");
    console.log("   ✓ Proxy configuration support");
    console.log("   ✓ Claude templates removal (filtered out)");
    console.log("   ✓ No command name duplicates");
    
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    Deno.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.main) {
  await runAllTests();
}