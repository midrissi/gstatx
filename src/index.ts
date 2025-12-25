#!/usr/bin/env node

/**
 * gstatx - Export stats of a repo or list of repos
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { listContributors } from "./commands/contributors";
import { generateHist } from "./commands/hist";
import { loadConfig } from "./utils/config";

// Get version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
  version: string;
};
const version = packageJson.version;

const program = new Command();

program
  .name("gstatx")
  .description("A CLI tool to export statistics from git repositories")
  .version(version)
  .option("-c, --config <path>", "Specify custom config file path")
  .configureHelp({
    helpWidth: 100,
  });

// Contributors command
program
  .command("contributors")
  .description("List contributors for specified repositories")
  .option("--no-commits", "Hide commit counts in contributor list")
  .option(
    "-f, --format <format>",
    "Output format: 'json' or 'text' (default: 'text')",
  )
  .option(
    "-u, --unique-emails",
    "List unique email addresses only (deduplicates by email)",
  )
  .argument("[repo-paths...]", "Repository paths")
  .action(async (repoPaths: string[], options, command) => {
    const configPath = command.parent?.opts().config as string | undefined;
    const loadedConfig = await loadConfig(configPath);
    const configNoCommits =
      loadedConfig?.config.contributors?.["no-commits"] ?? false;
    const showCommits = !(options.noCommits || configNoCommits);

    // Get format from CLI option or config file (CLI overrides config)
    // Default to "text" if neither CLI option nor config is provided
    const configFormat =
      (loadedConfig?.config.contributors?.format as string) || "text";
    const format = (options.format as string | undefined) || configFormat;
    if (format !== "json" && format !== "text") {
      console.error(
        `\n❌ \x1b[31mError:\x1b[0m \x1b[91mInvalid format '${format}'. Must be 'json' or 'text'\x1b[0m`,
      );
      process.exit(1);
    }

    // Use config repositories if no paths provided
    const pathsToUse = repoPaths.length === 0 ? undefined : repoPaths;
    const uniqueEmails = options.uniqueEmails || false;
    await listContributors(
      pathsToUse,
      showCommits,
      configPath,
      format,
      uniqueEmails,
    );
  })
  .addHelpText(
    "after",
    "\nExamples:\n  gstatx contributors ./my-repo\n  gstatx contributors ./repo1 ./repo2\n  gstatx contributors --no-commits ./my-repo\n  gstatx contributors --format json ./my-repo\n  gstatx contributors --unique-emails ./my-repo",
  );

// Hist command
program
  .command("hist")
  .description("Generate commit history report")
  .option(
    "-s, --since <date>",
    'Start date for the report (e.g., "2024-01-01", "1 month ago")',
  )
  .option(
    "-u, --until <date>",
    'End date for the report (e.g., "2024-12-31", "now")',
  )
  .option("-o, --out <file>", "Output file path (defaults to stdout)")
  .argument("[repo-paths...]", "Repository paths")
  .action(async (repoPaths: string[], options, command) => {
    const configPath = command.parent?.opts().config as string | undefined;
    const histOptions = {
      since: options.since as string | undefined,
      until: options.until as string | undefined,
      out: options.out as string | undefined,
    };

    // Use config repositories if no paths provided
    const pathsToUse = repoPaths.length === 0 ? undefined : repoPaths;
    await generateHist(pathsToUse, histOptions, configPath);
  })
  .addHelpText(
    "after",
    '\nExamples:\n  gstatx hist ./my-repo\n  gstatx hist --since "1 month ago" ./my-repo\n  gstatx hist --since "2024-01-01" --until "2024-12-31" ./my-repo\n  gstatx hist --since "1 month ago" --out report.json ./my-repo',
  );

// Add configuration help
program.addHelpText(
  "after",
  `
Configuration:
  You can create a .gstatxrc.json file to set default options
  and repository paths. CLI arguments override config values.
  Set 'cloneIfNotExists: true' to automatically clone repositories
  that don't exist locally (requires 'url' in repository config).
`,
);

program.parse();
