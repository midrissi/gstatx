import { Client } from "../lib";

export function showHelp(): void {
  console.log(
    "Usage: gstatx contributors [options] <repo-path> [repo-path2 ...]",
  );
  console.log("\nList contributors for specified git repositories.");
  console.log("\nOptions:");
  console.log("  --no-commits    Hide commit counts in contributor list");
  console.log("  --help, -h      Show this help message");
  console.log("\nExamples:");
  console.log("  gstatx contributors ./my-repo");
  console.log("  gstatx contributors ./repo1 ./repo2 ./repo3");
  console.log("  gstatx contributors --no-commits ./my-repo");
}

export async function listContributors(
  repoPaths?: string[],
  showCommits: boolean = true,
  configPath?: string,
): Promise<void> {
  const client = new Client({ configPath });

  try {
    const results = await client.listContributors(repoPaths);

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
    console.error(`Error processing repositories:`, error);
  }
}
