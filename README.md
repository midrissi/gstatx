# gstatx

📊 Export statistics from git repositories

A CLI tool and library to analyze and export statistics from one or multiple git repositories.

## Installation

```bash
npm install -g gstatx
```

Or install as a library:

```bash
npm install gstatx
```

## Quick Start

```bash
# List contributors for a repository
gstatx contributors ./my-repo

# List contributors for multiple repositories
gstatx contributors ./repo1 ./repo2 ./repo3

# Hide commit counts
gstatx contributors --no-commits ./my-repo

# Generate commit history report
gstatx hist ./my-repo

# Generate history report for last month and save to file
gstatx hist --since "1 month ago" --out report.json ./my-repo
```

## User Guide

### Commands

#### `contributors`

List contributors for specified git repositories.

**Usage:**
```bash
gstatx contributors [options] [repo-paths...]
```

**Options:**
- `--no-commits` - Hide commit counts in contributor list
- `--help, -h` - Show help message

**Examples:**
```bash
# List contributors with commit counts
gstatx contributors ./my-repo

# List contributors without commit counts
gstatx contributors --no-commits ./my-repo

# List contributors for multiple repositories
gstatx contributors ./repo1 ./repo2 ./repo3

# Use repositories from config file
gstatx contributors
```

#### `hist`

Generate commit history report with detailed statistics.

**Usage:**
```bash
gstatx hist [options] [repo-paths...]
```

**Options:**
- `-s, --since <date>` - Start date for the report (e.g., "2024-01-01", "1 month ago")
- `-u, --until <date>` - End date for the report (e.g., "2024-12-31", "now")
- `-o, --out <file>` - Output file path (defaults to stdout)
- `--help, -h` - Show help message

**Examples:**
```bash
# Generate history for a repository
gstatx hist ./my-repo

# Generate history for last month
gstatx hist --since "1 month ago" ./my-repo

# Generate history for specific period
gstatx hist --since "2024-01-01" --until "2024-12-31" ./my-repo

# Save to file
gstatx hist --since "1 month ago" --out report.json ./my-repo

# Use repositories from config file
gstatx hist --since "1 month ago" --out report.json
```

The report includes:
- Commit details (hash, author, date, message)
- File-level statistics (files changed, insertions, deletions)
- Summary statistics per repository

### Configuration File

You can create a `.gstatxrc.json` file to set default options and repository paths. The config file is automatically searched in the current directory and parent directories.

**Config File Location:**
- Default: `.gstatxrc.json` (searched from current directory up to root)
- Custom: Use `--config` or `-c` flag to specify a custom path

**Configuration Options:**

```json
{
  "contributors": {
    "no-commits": false
  },
  "cloneIfNotExists": false,
  "repositories": [
    {
      "path": "../my-repo",
      "name": "My Repository",
      "url": "git@github.com:user/repo.git"
    }
  ]
}
```

**Configuration Fields:**
- `contributors.no-commits` (boolean, optional): Hide commit counts by default
- `cloneIfNotExists` (boolean, optional): Automatically clone repositories that don't exist locally
- `repositories` (array, optional): List of repositories to process
  - `path` (string, required): Repository path (relative to config file location)
  - `name` (string, optional): Display name for the repository
  - `url` (string, optional): Git URL for cloning (required if `cloneIfNotExists: true`)

**Important Notes:**
- Repository paths in the config file are resolved relative to the `.gstatxrc.json` file location, not the current working directory
- If `cloneIfNotExists: true` and a repository doesn't exist, it will be cloned from the `url`
- CLI arguments always override config file values
- Both `contributors` and `hist` commands can use repositories from the config file

**Example Config File:**

```json
{
  "contributors": {
    "no-commits": false
  },
  "cloneIfNotExists": true,
  "repositories": [
    {
      "path": "../project-a",
      "name": "Project A",
      "url": "git@github.com:user/project-a.git"
    },
    {
      "path": "../project-b",
      "name": "Project B",
      "url": "git@github.com:user/project-b.git"
    }
  ]
}
```

### Global Options

- `--help, -h` - Show help message
- `--config, -c <path>` - Specify custom config file path
- `--version, -V` - Show version number

**Examples:**
```bash
# Use custom config file
gstatx --config ./custom-config.json contributors

# Short form
gstatx -c ./custom-config.json contributors

# Show version
gstatx --version
```

### Using Config File Repositories

If you have repositories defined in your config file, you can run commands without specifying paths:

```bash
# Uses repositories from .gstatxrc.json
gstatx contributors

# Generate history for all config repositories
gstatx hist --since "1 month ago" --out report.json
```

The tool will automatically use the repositories listed in your config file.

### Auto-Cloning Repositories

When `cloneIfNotExists: true` is set in your config:

1. The tool checks if each repository exists at the specified path
2. If the repository doesn't exist and a `url` is provided, it will be cloned automatically
3. If the repository already exists, it will be used as-is
4. If the path exists but isn't a git repository, an error is shown

**Example:**
```json
{
  "cloneIfNotExists": true,
  "repositories": [
    {
      "path": "../new-repo",
      "name": "New Repository",
      "url": "git@github.com:user/repo.git"
    }
  ]
}
```

Running `gstatx contributors` will automatically clone the repository if it doesn't exist.

## Library Usage

gstatx can also be used as a library in your TypeScript/JavaScript projects.

### Installation

```bash
npm install gstatx
```

### Basic Usage

```typescript
import { Client } from "gstatx";

const client = new Client({
  cloneIfNotExists: true,
  repositories: [
    {
      path: "/path/to/repository",
    },
  ],
  contributors: {
    "no-commits": false
  },
});

// List contributors
const contributors = await client.listContributors();
// Returns: Array<{ path: string; contributors: RepoContributor[] }>

// Get commit history
const history = await client.getHistory(
  undefined, // use config repositories
  "1 month ago", // since
  "now" // until
);
// Returns: Array<{ path: string; commits: Commit[] }>
```

### Available Exports

```typescript
import {
  Client,
  getContributors,
  getCommits,
  isGitRepo,
  ensureRepository,
  loadConfig,
  type RepoContributor,
  type Commit,
  type GstatxConfig,
  type RepositoryConfig,
} from "gstatx";
```

### Client Options

```typescript
interface ClientOptions {
  cloneIfNotExists?: boolean;
  repositories?: RepositoryConfig[];
  configPath?: string;
  contributors?: {
    "no-commits"?: boolean;
  };
}
```

## Development

### Prerequisites

- Node.js >= 18.0.0
- Bun (for development)

### Setup

```bash
# Install dependencies
bun install
# Git hooks are automatically configured via postinstall script

# Build the project
bun run build

# Run locally
bun run src/index.ts contributors ./my-repo
```

**Note:** Git hooks are automatically set up when you run `bun install` (or `npm install`). The hooks configure `npm version` to use commit messages in the format `chore(version): bump v{VERSION}` and create tags named `v{VERSION}`. If you need to manually set up hooks, run:

```bash
npm run setup:hooks
```

### Version Management

The project uses `npm version` to bump versions. When you run `npm version patch|minor|major`:

- The version in `package.json` is updated
- A commit is created with message: `chore(version): bump v{VERSION}`
- A git tag is created: `v{VERSION}`

**If you get an error that a tag already exists:**
- The version bump likely already succeeded. Check with `git tag -l` and `git log --oneline -5`
- If you need to re-run, delete the tag first: `git tag -d v{VERSION}`
- Or use `--force` flag: `npm version patch --force` (use with caution)

### Scripts

- `bun run build` - Build the project
- `bun run start` - Run the CLI locally
- `bun run check` - Check code quality
- `bun run check:fix` - Fix code quality issues
- `bun run lint` - Lint the code
- `bun run format` - Format the code

## License

MIT
