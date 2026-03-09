#!/usr/bin/env npx tsx
/**
 * Interaction Engine CLI — Functional test harness
 *
 * Usage:
 *   npx tsx src/lib/interaction-engine/cli.ts lex "Sacrifice a creature: Add {C}{C}."
 *   npx tsx src/lib/interaction-engine/cli.ts lex --file path/to/oracle.txt
 *   npx tsx src/lib/interaction-engine/cli.ts keywords flying
 *   npx tsx src/lib/interaction-engine/cli.ts keywords --category simple
 *
 * Future phases will add: parse, profile, interact
 */

import {
  lookupKeyword,
  expandKeyword,
  getKeywordsByCategory,
  getAllKeywordNames,
} from "./keyword-database";
import type { KeywordCategory } from "./keyword-database";
import { tokenize } from "./lexer";
import { parseAbilities } from "./parser";
import { readFileSync } from "fs";

// ─── CLI Framework ───

interface Command {
  name: string;
  description: string;
  usage: string;
  run: (args: string[]) => void;
}

const commands: Command[] = [];

function registerCommand(cmd: Command) {
  commands.push(cmd);
}

function printHelp() {
  console.log("Interaction Engine CLI\n");
  console.log("Commands:");
  for (const cmd of commands) {
    console.log(`  ${cmd.name.padEnd(12)} ${cmd.description}`);
  }
  console.log("\nRun '<command> --help' for command-specific usage.");
}

// ─── Keywords Command ───

registerCommand({
  name: "keywords",
  description: "Look up and expand keyword abilities",
  usage: `Usage:
  keywords <name> [parameter]    Expand a keyword (e.g., "keywords ward 3")
  keywords --list                List all keywords
  keywords --category <cat>      List keywords by category`,
  run(args) {
    if (args.length === 0 || args[0] === "--help") {
      console.log(this.usage);
      return;
    }

    if (args[0] === "--list") {
      const names = getAllKeywordNames();
      console.log(`${names.length} keywords in database:\n`);
      console.log(names.join(", "));
      return;
    }

    if (args[0] === "--category") {
      const category = args[1] as KeywordCategory;
      if (!category) {
        console.error("Missing category. Available: simple, cost_modifying, zone_casting, permanent_type, complex, damage_routing, copy_generation, counter_interaction, alternative_casting, trigger_pattern, maintenance, attachment, progression, resource_token");
        process.exit(1);
      }
      const keywords = getKeywordsByCategory(category);
      console.log(`Keywords in category '${category}':\n`);
      for (const kw of keywords) {
        console.log(`  ${kw.keyword}${kw.hasParameter ? " <param>" : ""}  (${kw.crReference})`);
      }
      return;
    }

    const keyword = args[0];
    const parameter = args[1];
    const entry = lookupKeyword(keyword);

    if (!entry) {
      console.error(`Unknown keyword: "${keyword}"`);
      console.error(`Try: keywords --list`);
      process.exit(1);
    }

    console.log(`Keyword: ${entry.keyword}`);
    console.log(`Category: ${entry.category}`);
    console.log(`CR Reference: ${entry.crReference}`);
    console.log(`Has Parameter: ${entry.hasParameter}`);
    console.log(`\nExpanded abilities:`);

    const abilities = expandKeyword(keyword, parameter, "TestCard");
    console.log(JSON.stringify(abilities, null, 2));
  },
});

// ─── Lex Command (placeholder for Phase 2) ───

registerCommand({
  name: "lex",
  description: "Tokenize oracle text into MTG-meaningful tokens",
  usage: `Usage:
  lex "<oracle text>"              Tokenize oracle text string
  lex --file <path>                Tokenize oracle text from file
  lex "<text>" --name "Card Name"  Replace card name with self-reference`,
  run(args) {
    if (args.length === 0 || args[0] === "--help") {
      console.log(this.usage);
      return;
    }

    // Extract --name flag before processing text
    let cardName = "";
    const nameIdx = args.indexOf("--name");
    if (nameIdx !== -1 && args[nameIdx + 1]) {
      cardName = args[nameIdx + 1];
      args.splice(nameIdx, 2);
    }

    let text: string;
    if (args[0] === "--file") {
      if (!args[1]) {
        console.error("Missing file path");
        process.exit(1);
      }
      text = readFileSync(args[1], "utf-8").trim();
    } else {
      text = args.join(" ");
    }

    console.log(`Input: "${text}"`);
    if (cardName) console.log(`Card: ${cardName}`);
    console.log();

    const result = tokenize(text, cardName);

    for (let i = 0; i < result.blocks.length; i++) {
      if (result.blocks.length > 1) {
        console.log(`── Ability Block ${i + 1} ──`);
      }
      for (const token of result.blocks[i]) {
        const norm = token.normalized ? ` (${token.normalized})` : "";
        console.log(
          `  ${token.type.padEnd(18)} ${token.value}${norm}`
        );
      }
      if (i < result.blocks.length - 1) console.log();
    }

    console.log(`\nTotal: ${result.blocks.reduce((sum, b) => sum + b.length, 0)} tokens across ${result.blocks.length} ability block(s)`);
  },
});

// ─── Parse Command ───

registerCommand({
  name: "parse",
  description: "Parse oracle text into AbilityNode ASTs",
  usage: `Usage:
  parse "<oracle text>"              Parse oracle text string
  parse --file <path>                Parse oracle text from file
  parse "<text>" --name "Card Name"  Include card name for self-reference`,
  run(args) {
    if (args.length === 0 || args[0] === "--help") {
      console.log(this.usage);
      return;
    }

    let cardName = "";
    const nameIdx = args.indexOf("--name");
    if (nameIdx !== -1 && args[nameIdx + 1]) {
      cardName = args[nameIdx + 1];
      args.splice(nameIdx, 2);
    }

    let text: string;
    if (args[0] === "--file") {
      if (!args[1]) {
        console.error("Missing file path");
        process.exit(1);
      }
      text = readFileSync(args[1], "utf-8").trim();
    } else {
      text = args.join(" ");
    }

    console.log(`Input: "${text}"`);
    if (cardName) console.log(`Card: ${cardName}`);
    console.log();

    const { blocks } = tokenize(text, cardName);
    const abilities = parseAbilities(blocks);

    for (let i = 0; i < abilities.length; i++) {
      const a = abilities[i];
      console.log(`── Ability ${i + 1}: ${a.abilityType} ──`);
      console.log(JSON.stringify(a, null, 2));
      console.log();
    }

    console.log(`Total: ${abilities.length} ability node(s)`);
  },
});

// ─── Main ───

const [subcommand, ...args] = process.argv.slice(2);

if (!subcommand || subcommand === "--help" || subcommand === "-h") {
  printHelp();
  process.exit(0);
}

const cmd = commands.find((c) => c.name === subcommand);
if (!cmd) {
  console.error(`Unknown command: "${subcommand}"`);
  printHelp();
  process.exit(1);
}

cmd.run(args);
