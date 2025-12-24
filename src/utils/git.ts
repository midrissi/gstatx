import { exec, execSync } from "node:child_process";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

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
    // Get commit count per author using git shortlog
    const { stdout: commitCount } = await execAsync(`git shortlog -sn --all`, {
      cwd: repoPath,
    });

    const contributors: RepoContributor[] = [];
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

        contributors.push({ name, email, commits });
      }
    }

    return contributors.sort((a, b) => b.commits - a.commits);
  } catch (error) {
    throw new Error(`Failed to get contributors from ${repoPath}: ${error}`);
  }
}

export function getCommits(
  repoPath: string,
  since?: string,
  until?: string,
): Commit[] {
  let gitLogCmd =
    'git log --format="%H|%an|%ae|%ad|%s" --date=iso-strict --numstat';

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
