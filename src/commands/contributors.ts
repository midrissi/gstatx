import { Client } from "../lib";

export function showHelp(): void {
  console.log(
    "Usage: gstatx contributors [options] <repo-path> [repo-path2 ...]",
  );
  console.log("\nList contributors for specified git repositories.");
  console.log("\nOptions:");
  console.log("  --no-commits    Hide commit counts in contributor list");
  console.log(
    "  -f, --format <format>  Output format: 'json' or 'text' (default: 'text')",
  );
  console.log(
    "  -u, --unique-emails   List unique email addresses only (deduplicates by email)",
  );
  console.log("  --help, -h      Show this help message");
  console.log("\nExamples:");
  console.log("  gstatx contributors ./my-repo");
  console.log("  gstatx contributors ./repo1 ./repo2 ./repo3");
  console.log("  gstatx contributors --no-commits ./my-repo");
  console.log("  gstatx contributors --format json ./my-repo");
  console.log("  gstatx contributors --unique-emails ./my-repo");
}

export type OutputFormat = "json" | "text";

export async function listContributors(
  repoPaths?: string[],
  showCommits: boolean = true,
  configPath?: string,
  format: OutputFormat = "text",
  uniqueEmails: boolean = false,
): Promise<void> {
  const client = new Client({ configPath });

  try {
    const results = await client.listContributors(repoPaths);

    // If unique-emails is enabled, deduplicate by email address
    if (uniqueEmails) {
      const emailMap = new Map<
        string,
        {
          name: string;
          email: string;
          commits: number;
          maxIndividualCommits: number;
        }
      >();

      // Collect all contributors and deduplicate by email (case-insensitive)
      for (const result of results) {
        for (const contributor of result.contributors) {
          const emailLower = contributor.email.toLowerCase();
          const existing = emailMap.get(emailLower);

          if (existing) {
            // Sum commits and update name if this contributor has more commits
            const newTotal = existing.commits + contributor.commits;
            if (contributor.commits > existing.maxIndividualCommits) {
              emailMap.set(emailLower, {
                name: contributor.name,
                email: contributor.email,
                commits: newTotal,
                maxIndividualCommits: contributor.commits,
              });
            } else {
              emailMap.set(emailLower, {
                ...existing,
                commits: newTotal,
              });
            }
          } else {
            emailMap.set(emailLower, {
              name: contributor.name,
              email: contributor.email,
              commits: contributor.commits,
              maxIndividualCommits: contributor.commits,
            });
          }
        }
      }

      const uniqueContributors = Array.from(emailMap.values()).sort(
        (a, b) => b.commits - a.commits,
      );

      if (format === "json") {
        const jsonOutput = uniqueContributors.map((contributor) => ({
          name: contributor.name,
          email: contributor.email,
          ...(showCommits && { commits: contributor.commits }),
        }));
        console.log(JSON.stringify(jsonOutput, null, 2));
        return;
      }

      // Text format
      console.log(`\n📧 Unique email addresses:`);
      console.log("─".repeat(60));

      if (uniqueContributors.length === 0) {
        console.log("  No contributors found");
      } else {
        for (const contributor of uniqueContributors) {
          if (showCommits) {
            console.log(
              `  ${contributor.name} <${contributor.email}> (${contributor.commits} commits)`,
            );
          } else {
            console.log(`  ${contributor.name} <${contributor.email}>`);
          }
        }
      }
      return;
    }

    // Normal output (not unique emails)
    if (format === "json") {
      const jsonOutput = results.map((result) => ({
        path: result.path,
        contributors: result.contributors.map((contributor) => ({
          name: contributor.name,
          email: contributor.email,
          ...(showCommits && { commits: contributor.commits }),
        })),
      }));
      console.log(JSON.stringify(jsonOutput, null, 2));
      return;
    }

    // Text format (default)
    for (const result of results) {
      console.log(`\n📊 Contributors for ${result.path}:`);
      console.log("─".repeat(60));

      if (result.contributors.length === 0) {
        console.log("  No contributors found");
      } else {
        for (const contributor of result.contributors) {
          if (showCommits) {
            console.log(
              `  ${contributor.name} <${contributor.email}> (${contributor.commits} commits)`,
            );
          } else {
            console.log(`  ${contributor.name} <${contributor.email}>`);
          }
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `\n❌ \x1b[31mError processing repositories:\x1b[0m \x1b[91m${errorMessage}\x1b[0m`,
    );
    process.exit(1);
  }
}
