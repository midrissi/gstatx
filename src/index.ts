#!/usr/bin/env node

/**
 * gstatx - Export stats of a repo or list of repos
 */

import { Command } from "commander";
import { listContributors } from "./commands/contributors";
import { generateHist } from "./commands/hist";
import { loadConfig } from "./utils/config";

const program = new Command();

program
  .name("gstatx")
  .description("A CLI tool to export statistics from git repositories")
  .version("0.1.1")
  .option("-c, --config <path>", "Specify custom config file path")
  .configureHelp({
    helpWidth: 100,
  });

// Contributors command
program
  .command("contributors")
  .description("List contributors for specified repositories")
  .option("--no-commits", "Hide commit counts in contributor list")
  .argument("[repo-paths...]", "Repository paths")
  .action(async (repoPaths: string[], options, command) => {
    const configPath = command.parent?.opts().config as string | undefined;
    const loadedConfig = await loadConfig(configPath);
    const configNoCommits =
      loadedConfig?.config.contributors?.["no-commits"] ?? false;
    const showCommits = !(options.noCommits || configNoCommits);

    // Use config repositories if no paths provided
    const pathsToUse = repoPaths.length === 0 ? undefined : repoPaths;
    await listContributors(pathsToUse, showCommits, configPath);
  })
  .addHelpText(
    "after",
    "\nExamples:\n  gstatx contributors ./my-repo\n  gstatx contributors ./repo1 ./repo2\n  gstatx contributors --no-commits ./my-repo",
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
