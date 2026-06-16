import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const script = process.argv[2];

if (!script) {
  console.error("usage: node scripts/run-workspace-script.mjs <script>");
  process.exit(2);
}

const workspaceRoots = ["packages", "plugin"];

function hasWorkspacePackage(root) {
  if (!existsSync(root)) {
    return false;
  }

  return readdirSync(root).some((entry) => {
    const path = join(root, entry);
    return statSync(path).isDirectory() && existsSync(join(path, "package.json"));
  });
}

if (!workspaceRoots.some(hasWorkspacePackage)) {
  process.exit(0);
}

const result = spawnSync("npm", ["run", script, "--workspaces", "--if-present"], {
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
