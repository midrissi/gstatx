import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Client } from "../lib";
import type { Commit } from "../utils/git";

export interface HistOptions {
  since?: string;
  until?: string;
  out?: string;
}

export interface HistReport {
  generatedAt: string;
  period: {
    since?: string;
    until?: string;
  };
  repositories: Array<{
    path: string;
    commits: Commit[];
    summary: {
      totalCommits: number;
      totalFilesChanged: number;
      totalInsertions: number;
      totalDeletions: number;
    };
  }>;
}

export function showHelp(): void {
  console.log("Usage: gstatx hist [options] <repo-path> [repo-path2 ...]");
  console.log(
    "\nGenerate commit history report for specified git repositories.",
  );
  console.log("\nOptions:");
  console.log(
    '  --since, -s <date>     Start date for the report (e.g., "2024-01-01", "1 month ago")',
  );
  console.log(
    '  --until, -u <date>     End date for the report (e.g., "2024-12-31", "now")',
  );
  console.log("  --out, -o <file>       Output file path (defaults to stdout)");
  console.log("  --help, -h             Show this help message");
  console.log("\nExamples:");
  console.log("  gstatx hist ./my-repo");
  console.log('  gstatx hist --since "1 month ago" ./my-repo');
  console.log(
    '  gstatx hist --since "2024-01-01" --until "2024-12-31" ./my-repo',
  );
  console.log(
    '  gstatx hist --since "1 month ago" --out report.json ./my-repo',
  );
}

export async function generateHist(
  repoPaths?: string[],
  options: HistOptions = {},
  configPath?: string,
): Promise<void> {
  const client = new Client({ configPath });

  try {
    const results = await client.getHistory(
      repoPaths,
      options.since,
      options.until,
    );

    const report: HistReport = {
      generatedAt: new Date().toISOString(),
      period: {
        since: options.since,
        until: options.until,
      },
      repositories: results.map((result) => {
        const totalFilesChanged = new Set(
          result.commits.flatMap((c) => c.files.map((f) => f.path)),
        ).size;
        const totalInsertions = result.commits.reduce(
          (sum, c) => sum + c.insertions,
          0,
        );
        const totalDeletions = result.commits.reduce(
          (sum, c) => sum + c.deletions,
          0,
        );

        return {
          path: result.path,
          commits: result.commits,
          summary: {
            totalCommits: result.commits.length,
            totalFilesChanged,
            totalInsertions,
            totalDeletions,
          },
        };
      }),
    };

    const reportJson = JSON.stringify(report, null, 2);

    if (options.out) {
      const outputPath = resolve(process.cwd(), options.out);
      // Create directory if it doesn't exist
      const outputDir = dirname(outputPath);
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(outputPath, reportJson, "utf-8");
      console.log(`✅ Report saved to: ${outputPath}`);
      console.log(`\n📊 Summary:`);
      for (const repo of report.repositories) {
        console.log(`\n   Repository: ${repo.path}`);
        console.log(`   Commits: ${repo.summary.totalCommits}`);
        console.log(`   Files Changed: ${repo.summary.totalFilesChanged}`);
        console.log(
          `   Lines Added: ${repo.summary.totalInsertions.toLocaleString()}`,
        );
        console.log(
          `   Lines Removed: ${repo.summary.totalDeletions.toLocaleString()}`,
        );
      }
    } else {
      console.log(reportJson);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error(
      `\n❌ \x1b[31mError generating history report:\x1b[0m \x1b[91m${errorMessage}\x1b[0m`,
    );
    process.exit(1);
  }
}
