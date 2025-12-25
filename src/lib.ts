/**
 * gstatx - Library API
 * Export stats of a repo or list of repos
 */

import { join } from "node:path";

import {
  extractRepoNameFromUrl,
  type GstatxConfig,
  loadConfig,
  type RepositoryConfig,
} from "./utils/config";
import {
  type Commit,
  getCommits,
  getContributors,
  isGitRepo,
  type RepoContributor,
} from "./utils/git";
import { ensureRepository } from "./utils/repo";

// Re-export all types
export type * from "./types";

export interface ClientOptions extends GstatxConfig {
  cloneIfNotExists?: boolean;
  repositories?: RepositoryConfig[];
  configPath?: string;
}

export class Client {
  private config: ClientOptions;
  private loadedConfig: { config: GstatxConfig; configDir: string } | null =
    null;

  constructor(options: ClientOptions = {}) {
    this.config = options;
  }

  /**
   * Initialize the client by loading config file if needed
   */
  private async initialize(): Promise<void> {
    // If repositories are provided in constructor, use them
    // Otherwise, try to load from config file
    if (!this.config.repositories) {
      this.loadedConfig = await loadConfig(this.config.configPath);
      if (this.loadedConfig?.config.repositories) {
        this.config.repositories = this.loadedConfig.config.repositories;
      }
      // Merge config file settings with constructor options
      if (this.loadedConfig?.config) {
        this.config = {
          ...this.loadedConfig.config,
          ...this.config,
          repositories:
            this.config.repositories || this.loadedConfig.config.repositories,
        };
      }
    }

    // Normalize repositories: generate path from URL if path is missing
    if (this.config.repositories) {
      this.config.repositories = this.config.repositories.map((repo) => {
        // If path is not provided but URL is, we need to generate path
        // For config-loaded repos, this should already be done, but handle constructor repos too
        if (!repo.path && repo.url) {
          // Use configDir if available, otherwise use current working directory
          const baseDir = this.loadedConfig?.configDir || process.cwd();
          const repoName = extractRepoNameFromUrl(repo.url);
          return {
            ...repo,
            path: join(baseDir, repoName),
            name: repo.name || repoName,
          };
        }
        return repo;
      });
    }

    // Ensure repositories exist if cloneIfNotExists is enabled
    if (this.config.cloneIfNotExists && this.config.repositories) {
      const ensuredPaths: string[] = [];
      for (const repo of this.config.repositories) {
        if (!repo.path) {
          console.error(
            `\n❌ \x1b[31mError:\x1b[0m \x1b[91mRepository ${repo.name || "unknown"} has no path and no URL\x1b[0m`,
          );
          ensuredPaths.push("");
          continue;
        }
        const ensuredPath = await ensureRepository(repo);
        if (ensuredPath) {
          ensuredPaths.push(ensuredPath);
        } else {
          ensuredPaths.push(repo.path);
        }
      }
      // Update repository paths to ensured paths
      this.config.repositories = this.config.repositories.map(
        (repo, index) => ({
          ...repo,
          path: ensuredPaths[index] || repo.path,
        }),
      );
    }
  }

  /**
   * Get repository paths to use
   */
  private getRepoPaths(repoPaths?: string[]): string[] {
    if (repoPaths && repoPaths.length > 0) {
      return repoPaths;
    }

    if (this.config.repositories) {
      return this.config.repositories
        .map((repo) => repo.path)
        .filter((path): path is string => path !== undefined);
    }

    return [];
  }

  /**
   * List contributors for specified repositories
   * @param repoPaths Optional array of repository paths. If not provided, uses repositories from config.
   * @returns Array of contributors grouped by repository
   */
  async listContributors(
    repoPaths?: string[],
  ): Promise<Array<{ path: string; contributors: RepoContributor[] }>> {
    await this.initialize();

    const paths = this.getRepoPaths(repoPaths);
    if (paths.length === 0) {
      throw new Error("No repository paths specified");
    }

    const results: Array<{
      path: string;
      contributors: RepoContributor[];
    }> = [];

    for (const repoPath of paths) {
      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        throw new Error(`${repoPath} is not a git repository`);
      }

      try {
        const contributors = await getContributors(repoPath);
        results.push({
          path: repoPath,
          contributors,
        });
      } catch (error) {
        throw new Error(
          `Failed to get contributors from ${repoPath}: ${error}`,
        );
      }
    }

    return results;
  }

  /**
   * Get commit history for specified repositories
   * @param repoPaths Optional array of repository paths. If not provided, uses repositories from config.
   * @param since Optional start date for the history (e.g., "2024-01-01", "1 month ago")
   * @param until Optional end date for the history (e.g., "2024-12-31", "now")
   * @returns Array of commit history grouped by repository
   */
  async getHistory(
    repoPaths?: string[],
    since?: string,
    until?: string,
  ): Promise<Array<{ path: string; commits: Commit[] }>> {
    await this.initialize();

    const paths = this.getRepoPaths(repoPaths);
    if (paths.length === 0) {
      throw new Error("No repository paths specified");
    }

    const results: Array<{
      path: string;
      commits: Commit[];
    }> = [];

    for (const repoPath of paths) {
      const isRepo = await isGitRepo(repoPath);
      if (!isRepo) {
        throw new Error(`${repoPath} is not a git repository`);
      }

      try {
        const commits = await getCommits(repoPath, since, until);
        results.push({
          path: repoPath,
          commits,
        });
      } catch (error) {
        throw new Error(
          `Failed to get commit history from ${repoPath}: ${error}`,
        );
      }
    }

    return results;
  }
}

export { loadConfig } from "./utils/config";
// Export utility functions for direct use
export {
  type Commit,
  getCommits,
  getContributors,
  isGitRepo,
} from "./utils/git";
export { ensureRepository } from "./utils/repo";
