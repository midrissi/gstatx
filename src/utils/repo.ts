import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import type { RepositoryConfig } from "./config";
import { isGitRepo } from "./git";

const execAsync = promisify(exec);

export async function ensureRepository(
  repo: RepositoryConfig,
): Promise<string | null> {
  // Path must be set at this point (should be normalized before calling this)
  if (!repo.path) {
    console.error(
      `Error: Repository ${repo.name || "unknown"} has no path specified`,
    );
    return null;
  }

  // Check if repository exists and is a git repo
  if (existsSync(repo.path) && (await isGitRepo(repo.path))) {
    return repo.path;
  }

  // If path exists but is not a git repo, return null
  if (existsSync(repo.path)) {
    console.error(
      `Error: Path exists but is not a git repository: ${repo.path}`,
    );
    return null;
  }

  // If URL is not provided, cannot clone
  if (!repo.url) {
    console.error(
      `Error: Repository not found at ${repo.path} and no URL provided for cloning`,
    );
    return null;
  }

  // Clone the repository
  try {
    console.log(`Cloning repository from ${repo.url} to ${repo.path}...`);
    const parentDir = dirname(repo.path);
    const repoName = repo.path.split("/").pop() || "repository";

    // Create parent directory if it doesn't exist
    try {
      await mkdir(parentDir, { recursive: true });
    } catch (_error) {
      // Directory might already exist, ignore error
    }

    // Clone the repository
    await execAsync(`git clone "${repo.url}" "${repo.path}"`);

    console.log(`✓ Successfully cloned ${repo.name || repoName}`);
    return repo.path;
  } catch (error) {
    console.error(`Error: Failed to clone repository: ${error}`);
    return null;
  }
}
