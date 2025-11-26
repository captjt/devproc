#!/usr/bin/env bun
/**
 * Build script for creating standalone DevProc binaries
 *
 * Usage:
 *   bun run scripts/build.ts          # Build for current platform
 *   bun run scripts/build.ts --all    # Build for all platforms
 */

import { $ } from "bun";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import solidPlugin from "../node_modules/@opentui/solid/scripts/solid-plugin";

const VERSION = process.env.VERSION || "0.1.0";
const DIST_DIR = "dist";
const ENTRY = "./src/index.tsx";

interface Target {
  name: string;
  bunTarget: "bun-darwin-arm64" | "bun-darwin-x64" | "bun-linux-x64" | "bun-linux-arm64";
  outputName: string;
}

const TARGETS: Target[] = [
  { name: "darwin-arm64", bunTarget: "bun-darwin-arm64", outputName: "devproc-darwin-arm64" },
  { name: "darwin-x64", bunTarget: "bun-darwin-x64", outputName: "devproc-darwin-x64" },
  { name: "linux-x64", bunTarget: "bun-linux-x64", outputName: "devproc-linux-x64" },
  { name: "linux-arm64", bunTarget: "bun-linux-arm64", outputName: "devproc-linux-arm64" },
];

async function clean() {
  console.log("Cleaning dist directory...");
  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });
}

async function buildTarget(target: Target): Promise<string> {
  console.log(`Building for ${target.name}...`);

  const outputPath = join(DIST_DIR, target.outputName);

  try {
    const result = await Bun.build({
      entrypoints: [ENTRY],
      target: "bun",
      plugins: [solidPlugin],
      minify: true,
      compile: {
        target: target.bunTarget,
        outfile: outputPath,
      },
    });

    if (!result.success) {
      console.error(`  ✗ Build errors for ${target.name}:`);
      for (const log of result.logs) {
        console.error(`    ${log}`);
      }
      throw new Error(`Build failed for ${target.name}`);
    }

    console.log(`  ✓ Built ${target.outputName}`);
    return outputPath;
  } catch (error) {
    console.error(`  ✗ Failed to build ${target.name}:`, error);
    throw error;
  }
}

async function createTarball(binaryPath: string, target: Target): Promise<string> {
  const tarballName = `devproc-v${VERSION}-${target.name}.tar.gz`;
  const tarballPath = join(DIST_DIR, tarballName);
  const renamedBinary = join(DIST_DIR, "devproc");
  
  // Rename binary to 'devproc' for the tarball (portable across BSD/GNU tar)
  await $`mv ${binaryPath} ${renamedBinary}`;
  await $`tar -czf ${tarballPath} -C ${DIST_DIR} devproc`;
  await $`mv ${renamedBinary} ${binaryPath}`;
  
  console.log(`  ✓ Created ${tarballName}`);
  return tarballPath;
}

async function computeSha256(filePath: string): Promise<string> {
  const result = await $`shasum -a 256 ${filePath}`.text();
  return result.split(" ")[0]!;
}

async function buildAll() {
  await clean();

  const checksums: Record<string, string> = {};

  for (const target of TARGETS) {
    try {
      const binaryPath = await buildTarget(target);
      const tarballPath = await createTarball(binaryPath, target);
      const sha256 = await computeSha256(tarballPath);
      checksums[target.name] = sha256;

      // Remove the raw binary, keep only tarball
      await rm(binaryPath, { force: true });
    } catch (error) {
      console.error(`Skipping ${target.name} due to error`);
    }
  }

  // Write checksums file
  const checksumContent =
    Object.entries(checksums)
      .map(([name, hash]) => `${hash}  devproc-v${VERSION}-${name}.tar.gz`)
      .join("\n") + "\n";

  await Bun.write(join(DIST_DIR, "checksums.txt"), checksumContent);
  console.log("\n✓ Checksums written to dist/checksums.txt");

  // Print checksums for easy copy-paste into Homebrew formula
  console.log("\nSHA256 checksums for Homebrew formula:");
  for (const [name, hash] of Object.entries(checksums)) {
    console.log(`  ${name}: ${hash}`);
  }
}

async function buildCurrent() {
  await clean();

  // Detect current platform
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  const platform = process.platform === "darwin" ? "darwin" : "linux";
  const targetName = `${platform}-${arch}`;

  const target = TARGETS.find((t) => t.name === targetName);
  if (!target) {
    console.error(`Unsupported platform: ${targetName}`);
    process.exit(1);
  }

  await buildTarget(target);
  console.log(`\n✓ Binary built: ${DIST_DIR}/${target.outputName}`);
}

// Main
const args = process.argv.slice(2);

if (args.includes("--all")) {
  await buildAll();
} else if (args.includes("--help") || args.includes("-h")) {
  console.log(`
DevProc Build Script

Usage:
  bun run scripts/build.ts          Build for current platform
  bun run scripts/build.ts --all    Build for all platforms

Environment:
  VERSION    Set the version number (default: 0.1.0)
`);
} else {
  await buildCurrent();
}
