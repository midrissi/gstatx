import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export interface RepositoryConfig {
  path?: string;
  name?: string;
  url?: string;
  archived?: boolean;
}

export interface ContributorsConfig {
  "no-commits"?: boolean;
  format?: "json" | "text";
}

export interface GstatxConfig {
  contributors?: ContributorsConfig;
  repositories?: RepositoryConfig[];
  cloneIfNotExists?: boolean;
  pullIfExists?: boolean;
  noArchived?: boolean;
}

const CONFIG_FILE_NAME = ".gstatxrc.json";

/**
 * Extract repository name from a Git URL
 * Examples:
 * - git@git.4d-ps.com:4d/web-studio/qodly-workspace.git -> qodly-workspace
 * - https://github.com/user/repo.git -> repo
 * - git@github.com:user/repo.git -> repo
 */
export function extractRepoNameFromUrl(url: string): string {
  // Remove .git suffix if present
  const name = url.replace(/\.git$/, "");

  // Extract the last part after the last slash or colon
  // Handle both SSH (git@host:path/repo) and HTTPS (https://host/path/repo) formats
  const parts = name.split(/[/:]/);
  return parts[parts.length - 1] || "repository";
}

function findConfigFile(startPath: string): string | null {
  let currentPath = resolve(startPath);

  // Limit search to prevent infinite loops
  const maxDepth = 20;
  let depth = 0;

  while (depth < maxDepth) {
    const configPath = join(currentPath, CONFIG_FILE_NAME);
    if (existsSync(configPath)) {
      return configPath;
    }

    const parentPath = dirname(currentPath);
    if (parentPath === currentPath) {
      // Reached filesystem root
      break;
    }
    currentPath = parentPath;
    depth++;
  }

  return null;
}

export interface LoadedConfig {
  config: GstatxConfig;
  configDir: string;
}

export async function loadConfig(
  customPath?: string,
  startPath: string = process.cwd(),
): Promise<LoadedConfig | null> {
  try {
    let configPath: string | null;

    if (customPath) {
      // Use custom config file path
      const resolvedPath = resolve(customPath);
      if (!existsSync(resolvedPath)) {
        console.error(`Error: Config file not found: ${resolvedPath}`);
        return null;
      }
      configPath = resolvedPath;
    } else {
      // Search for default config file
      configPath = findConfigFile(startPath);
      if (!configPath) {
        return null;
      }
    }

    const configContent = await readFile(configPath, "utf-8");
    const config: GstatxConfig = JSON.parse(configContent);

    // Resolve repository paths relative to config file directory
    const configDir = dirname(configPath);
    if (config.repositories) {
      config.repositories = config.repositories.map((repo) => {
        // If path is not provided but URL is, extract name from URL and construct path
        if (!repo.path && repo.url) {
          const repoName = extractRepoNameFromUrl(repo.url);
          return {
            ...repo,
            path: join(configDir, repoName),
            // Set name if not already provided
            name: repo.name || repoName,
          };
        }

        // If path is provided, resolve it relative to config directory
        if (repo.path) {
          return {
            ...repo,
            path: resolve(configDir, repo.path),
          };
        }

        // If neither path nor url is provided, return as-is (will error later)
        return repo;
      });
    }

    return { config, configDir };
  } catch (error) {
    if (customPath) {
      console.error(`Error: Failed to load config file: ${error}`);
    }
    // Silently fail if default config file doesn't exist or is invalid
    return null;
  }
}
