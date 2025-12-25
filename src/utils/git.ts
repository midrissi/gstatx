import { exec, execSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Check if .mailmap file exists in the repository
 */
async function hasMailmap(repoPath: string): Promise<boolean> {
  try {
    await access(join(repoPath, ".mailmap"));
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse .mailmap file and create email mapping
 * Returns a Map from old email (lowercase) to canonical email
 */
async function parseMailmap(repoPath: string): Promise<Map<string, string>> {
  const emailMap = new Map<string, string>();
  try {
    const mailmapPath = join(repoPath, ".mailmap");
    const content = await readFile(mailmapPath, "utf-8");
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      // Parse mailmap format: Canonical Name <canonical@email.com> <old1@email.com> <old2@email.com>
      // or: <canonical@email.com> <old@email.com>
      const emailMatches = trimmed.matchAll(/<([^>]+)>/g);
      const emails = Array.from(emailMatches)
        .map((m) => m[1]?.trim())
        .filter((e): e is string => e !== undefined);

      if (emails.length >= 2) {
        const canonicalEmail = emails[0];
        if (canonicalEmail) {
          const canonicalEmailLower = canonicalEmail.toLowerCase();
          // Map all other emails to the canonical one
          for (let i = 1; i < emails.length; i++) {
            const email = emails[i];
            if (email) {
              emailMap.set(email.toLowerCase(), canonicalEmailLower);
            }
          }
        }
      }
    }
  } catch {
    // If we can't parse mailmap, return empty map
  }

  return emailMap;
}

export interface RepoContributor {
  name: string;
  email: string;
  commits: number;
}

export async function isGitRepo(path: string): Promise<boolean> {
  try {
    await access(join(path, ".git"));
    return true;
  } catch {
    return false;
  }
}

export interface CommitFile {
  path: string;
  insertions: number;
  deletions: number;
}

export interface Commit {
  hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
  files: CommitFile[];
}

export async function getContributors(
  repoPath: string,
): Promise<RepoContributor[]> {
  try {
    // Check if .mailmap exists
    const useMailmap = await hasMailmap(repoPath);

    const contributorsMap = new Map<
      string,
      {
        name: string;
        email: string;
        commits: number;
        maxIndividualCommits: number;
      }
    >();

    if (useMailmap) {
      // Parse mailmap to get email mappings
      const emailMapping = await parseMailmap(repoPath);

      // When mailmap exists, use git log with --use-mailmap to get all commits
      // Format: author name|author email
      const { stdout: logOutput } = await execAsync(
        `git log --all --format='%aN|%aE' --use-mailmap`,
        {
          cwd: repoPath,
        },
      );

      // Track name occurrences per email to determine the most common name
      const nameCounts = new Map<string, Map<string, number>>();

      // Count commits per author/email combination
      const commitLines = logOutput.trim().split("\n");
      for (const line of commitLines) {
        if (!line.trim()) continue;
        const [name, email] = line.split("|");
        if (!name || !email) continue;

        // Normalize email using mailmap
        let normalizedEmail = email.toLowerCase();
        const mappedEmail = emailMapping.get(normalizedEmail);
        if (mappedEmail) {
          normalizedEmail = mappedEmail;
        }

        const existing = contributorsMap.get(normalizedEmail);

        // Track name frequency for this email
        if (!nameCounts.has(normalizedEmail)) {
          nameCounts.set(normalizedEmail, new Map());
        }
        const nameMap = nameCounts.get(normalizedEmail);
        if (nameMap) {
          nameMap.set(name, (nameMap.get(name) || 0) + 1);
        }

        if (existing) {
          // If email exists, increment commits
          contributorsMap.set(normalizedEmail, {
            ...existing,
            commits: existing.commits + 1,
          });
        } else {
          // Use canonical email from mapping if available, otherwise use original
          const canonicalEmail = mappedEmail || email;
          contributorsMap.set(normalizedEmail, {
            name,
            email: canonicalEmail,
            commits: 1,
            maxIndividualCommits: 1,
          });
        }
      }

      // Update names to the most frequent one for each email
      for (const [normalizedEmail, nameMap] of nameCounts.entries()) {
        const existing = contributorsMap.get(normalizedEmail);
        if (existing) {
          // Find the name with the most occurrences
          let maxCount = 0;
          let mostCommonName = existing.name;
          for (const [name, count] of nameMap.entries()) {
            if (count > maxCount) {
              maxCount = count;
              mostCommonName = name;
            }
          }
          contributorsMap.set(normalizedEmail, {
            ...existing,
            name: mostCommonName,
          });
        }
      }
    } else {
      // When no mailmap, use git shortlog for better performance
      const { stdout: commitCount } = await execAsync(
        `git shortlog -sn --all`,
        {
          cwd: repoPath,
        },
      );

      const commitLines = commitCount.trim().split("\n");

      for (const line of commitLines) {
        const match = line.match(/^\s*(\d+)\s+(.+)$/);
        if (match) {
          const commits = parseInt(match[1] || "0", 10);
          const name = match[2] || "";

          // Get email for this author
          const { stdout: emailOutput } = await execAsync(
            `git log --format='%aE' --author="${name.replace(/"/g, '\\"')}" -1`,
            { cwd: repoPath },
          );
          const email = emailOutput.trim().split("\n")[0] || "";

          // Aggregate by email address (case-insensitive)
          const emailLower = email.toLowerCase();
          const existing = contributorsMap.get(emailLower);

          if (existing) {
            // If email exists, sum commits and keep name with most individual commits
            const newTotal = existing.commits + commits;
            if (commits > existing.maxIndividualCommits) {
              contributorsMap.set(emailLower, {
                name,
                email,
                commits: newTotal,
                maxIndividualCommits: commits,
              });
            } else {
              contributorsMap.set(emailLower, {
                ...existing,
                commits: newTotal,
              });
            }
          } else {
            contributorsMap.set(emailLower, {
              name,
              email,
              commits,
              maxIndividualCommits: commits,
            });
          }
        }
      }
    }

    const contributors = Array.from(contributorsMap.values()).map((c) => ({
      name: c.name,
      email: c.email,
      commits: c.commits,
    }));

    return contributors.sort((a, b) => b.commits - a.commits);
  } catch (error) {
    throw new Error(`Failed to get contributors from ${repoPath}: ${error}`);
  }
}

export async function getCommits(
  repoPath: string,
  since?: string,
  until?: string,
): Promise<Commit[]> {
  // Check if .mailmap exists and add --use-mailmap flag if it does
  const useMailmap = await hasMailmap(repoPath);
  const mailmapFlag = useMailmap ? " --use-mailmap" : "";

  let gitLogCmd =
    `git log --format="%H|%an|%ae|%ad|%s" --date=iso-strict --numstat${mailmapFlag}`;

  if (since) {
    gitLogCmd += ` --since="${since}"`;
  }

  if (until) {
    gitLogCmd += ` --until="${until}"`;
  }

  const output = execSync(gitLogCmd, {
    encoding: "utf-8",
    cwd: repoPath,
    maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large repositories
  });

  const commits: Commit[] = [];
  const lines = output.split("\n").filter((line) => line.trim());

  let currentCommit: (Partial<Commit> & { files?: CommitFile[] }) | null = null;
  let currentFilesChanged = 0;
  let currentInsertions = 0;
  let currentDeletions = 0;
  let currentFiles: CommitFile[] = [];

  for (const line of lines) {
    // Check if it's a commit header line
    if (line.includes("|")) {
      // Save previous commit if exists
      if (
        currentCommit?.hash &&
        currentCommit?.author &&
        currentCommit?.email &&
        currentCommit?.date &&
        currentCommit?.message
      ) {
        commits.push({
          hash: currentCommit.hash,
          author: currentCommit.author,
          email: currentCommit.email,
          date: currentCommit.date,
          message: currentCommit.message,
          filesChanged: currentFilesChanged,
          insertions: currentInsertions,
          deletions: currentDeletions,
          files: currentFiles,
        });
      }

      // Parse new commit header
      const [hash, author, email, date, ...messageParts] = line.split("|");
      if (hash && author && email && date) {
        currentCommit = {
          hash: hash.trim(),
          author: author.trim(),
          email: email.trim(),
          date: date.trim(),
          message: messageParts.join("|").trim(),
        };
        currentFilesChanged = 0;
        currentInsertions = 0;
        currentDeletions = 0;
        currentFiles = [];
      }
    } else {
      // Parse numstat line (insertions deletions filename)
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2 && parts[0] && parts[1]) {
        const insertions = parseInt(parts[0], 10) || 0;
        const deletions = parseInt(parts[1], 10) || 0;
        const filename = parts.slice(2).join(" ");

        if (filename && !Number.isNaN(insertions) && !Number.isNaN(deletions)) {
          currentFilesChanged++;
          currentInsertions += insertions;
          currentDeletions += deletions;
          currentFiles.push({
            path: filename,
            insertions,
            deletions,
          });
        }
      }
    }
  }

  // Save last commit
  if (
    currentCommit?.hash &&
    currentCommit?.author &&
    currentCommit?.email &&
    currentCommit?.date &&
    currentCommit?.message
  ) {
    commits.push({
      hash: currentCommit.hash,
      author: currentCommit.author,
      email: currentCommit.email,
      date: currentCommit.date,
      message: currentCommit.message,
      filesChanged: currentFilesChanged,
      insertions: currentInsertions,
      deletions: currentDeletions,
      files: currentFiles,
    });
  }

  return commits;
}
