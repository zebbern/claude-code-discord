#!/usr/bin/env -S deno run --allow-all

/**
 * Test script to verify no duplicate command names exist
 * This should help debug Discord API registration issues
 */

// Import all command arrays
import { claudeCommands } from "./claude/command.ts";
import { enhancedClaudeCommands } from "./claude/enhanced-commands.ts";
import { additionalClaudeCommands } from "./claude/additional-commands.ts";
import { advancedSettingsCommands } from "./settings/advanced-settings.ts";
import { unifiedSettingsCommands } from "./settings/unified-settings.ts";
import { agentCommand } from "./agent/index.ts";
import { gitCommands } from "./git/command.ts";
import { shellCommands } from "./shell/command.ts";
import { utilsCommands } from "./util/command.ts";
import { systemCommands } from "./system/commands.ts";
import { helpCommand } from "./help/commands.ts";

function testNoDuplicates() {
  console.log("🔍 Testing for duplicate command names...\n");

  // Combine all commands as they would be registered
  const allCommands = [
    ...claudeCommands,
    ...enhancedClaudeCommands,
    ...additionalClaudeCommands,
    ...advancedSettingsCommands,
    ...unifiedSettingsCommands,
    agentCommand,
    ...gitCommands,
    ...shellCommands,
    ...utilsCommands,
    ...systemCommands,
    helpCommand,
  ];

  console.log(`📊 Total commands to register: ${allCommands.length}`);

  // Extract command names
  const commandNames = allCommands.map(cmd => cmd.name);
  console.log("\n📋 All command names:");
  commandNames.sort().forEach((name, index) => {
    console.log(`  ${index + 1}. ${name}`);
  });

  // Check for duplicates
  const nameCounts = new Map<string, number>();
  commandNames.forEach(name => {
    nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
  });

  const duplicates = Array.from(nameCounts.entries()).filter(([_, count]) => count > 1);

  if (duplicates.length > 0) {
    console.log("\n❌ DUPLICATE COMMAND NAMES FOUND:");
    duplicates.forEach(([name, count]) => {
      console.log(`  🔴 "${name}" appears ${count} times`);
    });
    return false;
  }

  const uniqueNames = new Set(commandNames);
  console.log(`\n✅ No duplicates found! ${uniqueNames.size} unique commands`);

  // Additional verification - check specific problematic commands
  const problematicCommands = ['settings', 'claude-templates'];
  console.log("\n🔍 Checking specific commands that were problematic:");
  
  problematicCommands.forEach(cmdName => {
    const count = commandNames.filter(name => name === cmdName).length;
    if (count === 0) {
      console.log(`  ✅ "${cmdName}" - Not found (expected if removed)`);
    } else if (count === 1) {
      console.log(`  ✅ "${cmdName}" - Found exactly once`);
    } else {
      console.log(`  ❌ "${cmdName}" - Found ${count} times`);
    }
  });

  return true;
}

function printCommandsByCategory() {
  console.log("\n📚 Commands by category:");
  
  const categories = [
    { name: "Claude Core", commands: claudeCommands },
    { name: "Claude Enhanced", commands: enhancedClaudeCommands },
    { name: "Claude Additional", commands: additionalClaudeCommands },
    { name: "Advanced Settings", commands: advancedSettingsCommands },
    { name: "Unified Settings", commands: unifiedSettingsCommands },
    { name: "Agent", commands: [agentCommand] },
    { name: "Git", commands: gitCommands },
    { name: "Shell", commands: shellCommands },
    { name: "Utils", commands: utilsCommands },
    { name: "System", commands: systemCommands },
    { name: "Help", commands: [helpCommand] }
  ];

  categories.forEach(category => {
    console.log(`\n  ${category.name} (${category.commands.length}):`);
    category.commands.forEach(cmd => {
      console.log(`    - ${cmd.name}`);
    });
  });
}

// Run the test
if (import.meta.main) {
  const success = testNoDuplicates();
  printCommandsByCategory();
  
  if (success) {
    console.log("\n🎉 All tests passed! Commands should register successfully.");
  } else {
    console.log("\n💥 Duplicate commands found! This will cause Discord API registration to fail.");
    Deno.exit(1);
  }
}