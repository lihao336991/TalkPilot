import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    stdio: "pipe",
    encoding: "utf8",
  }).trim();
}

function runStreaming(command, args, cwd) {
  execFileSync(command, args, {
    cwd,
    stdio: "inherit",
    encoding: "utf8",
  });
}

function pathExists(targetPath) {
  return fs.existsSync(targetPath);
}

function readLegalConfig() {
  const configPath = path.join(projectRoot, "data", "legal", "legal.json");
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function ensureRepo(localRepoPath, remoteUrl) {
  const absoluteRepoPath = path.resolve(projectRoot, localRepoPath);

  if (!pathExists(absoluteRepoPath)) {
    fs.mkdirSync(path.dirname(absoluteRepoPath), { recursive: true });
    runStreaming("git", ["clone", remoteUrl, absoluteRepoPath], projectRoot);
  }

  if (!pathExists(path.join(absoluteRepoPath, ".git"))) {
    throw new Error(`Target path is not a git repository: ${absoluteRepoPath}`);
  }

  const currentOrigin = run(
    "git",
    ["remote", "get-url", "origin"],
    absoluteRepoPath,
  );
  if (currentOrigin !== remoteUrl) {
    runStreaming("git", ["remote", "set-url", "origin", remoteUrl], absoluteRepoPath);
  }

  return absoluteRepoPath;
}

function hasHead(repoPath) {
  try {
    run("git", ["rev-parse", "--verify", "HEAD"], repoPath);
    return true;
  } catch {
    return false;
  }
}

function copyDirectory(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }

    fs.copyFileSync(sourcePath, targetPath);
  }
}

function writeRootIndex(repoPath, legalDirName) {
  const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0; url=./${legalDirName}/terms.html" />
    <title>TalkPilot Legal Pages</title>
  </head>
  <body>
    <p>Redirecting to <a href="./${legalDirName}/terms.html">TalkPilot Legal Pages</a>...</p>
  </body>
</html>
`;

  fs.writeFileSync(path.join(repoPath, "index.html"), indexHtml, "utf8");
  fs.writeFileSync(path.join(repoPath, ".nojekyll"), "", "utf8");
}

function stageAndPush(repoPath, commitMessage) {
  runStreaming("git", ["add", "."], repoPath);
  const status = run("git", ["status", "--porcelain"], repoPath);

  if (!status) {
    process.stdout.write("No changes to publish.\n");
    return;
  }

  runStreaming("git", ["commit", "-m", commitMessage], repoPath);
  runStreaming("git", ["push", "-u", "origin", "main"], repoPath);
}

function main() {
  const legal = readLegalConfig();
  const repoPath = ensureRepo(
    legal.meta.hosting.repo_local_path,
    legal.meta.hosting.repo_url,
  );

  runStreaming("node", ["scripts/generate-legal-html.mjs"], projectRoot);

  runStreaming("git", ["checkout", "-B", "main"], repoPath);
  if (hasHead(repoPath)) {
    runStreaming("git", ["pull", "--ff-only", "origin", "main"], repoPath);
  }

  const publishDir = path.join(repoPath, legal.meta.hosting.publish_subdirectory);
  const sourceDir = path.join(projectRoot, "dist", "legal");

  copyDirectory(sourceDir, publishDir);
  writeRootIndex(repoPath, legal.meta.hosting.publish_subdirectory);

  const readmePath = path.join(repoPath, "README.md");
  const readme = `# TalkPilotPages

Static legal pages for TalkPilot.

- Terms: ${legal.meta.hosting.terms_url}
- Privacy: ${legal.meta.hosting.privacy_url}
`;
  fs.writeFileSync(readmePath, readme, "utf8");

  stageAndPush(repoPath, "Update TalkPilot legal pages");
}

main();
