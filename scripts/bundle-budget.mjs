#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BYTES_PER_KB = 1024;
const DEFAULT_LIMIT_BYTES = 150 * BYTES_PER_KB;

const rootDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');
const manifestPath = path.join(distDir, '.vite', 'manifest.json');

async function ensureFileExists(targetPath) {
  try {
    await access(targetPath, fsConstants.R_OK);
  } catch (error) {
    throw new Error(`Required file is missing: ${targetPath}. Did you run \"npm run build\"?`, {
      cause: error,
    });
  }
}

async function loadManifest() {
  await ensureFileExists(manifestPath);
  const raw = await readFile(manifestPath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse Vite manifest at ${manifestPath}`, { cause: error });
  }
}

function resolveEntry(manifest) {
  const explicit = manifest['src/main.ts'];
  if (explicit) {
    return explicit;
  }

  const entries = Object.values(manifest).filter((entry) => entry && entry.isEntry);
  if (entries.length === 0) {
    throw new Error('No entry with isEntry=true found in manifest.');
  }
  return entries[0];
}

async function measureFile(relativePath) {
  const absolutePath = path.join(distDir, relativePath);
  await ensureFileExists(absolutePath);
  const content = await readFile(absolutePath);
  const gzipSize = gzipSync(content).length;
  return { relativePath, gzipSize };
}

function formatBytes(bytes) {
  return `${(bytes / BYTES_PER_KB).toFixed(2)} KB`;
}

async function main() {
  const manifest = await loadManifest();
  const entry = resolveEntry(manifest);

  const assets = new Map();
  const queue = [];

  if (entry.file) {
    queue.push(entry.file);
  }
  if (Array.isArray(entry.css)) {
    queue.push(...entry.css);
  }
  if (Array.isArray(entry.assets)) {
    queue.push(...entry.assets);
  }

  for (const item of queue) {
    if (!assets.has(item)) {
      assets.set(item, null);
    }
  }

  const measurements = [];
  for (const [assetPath] of assets) {
    const measurement = await measureFile(assetPath);
    measurements.push(measurement);
  }

  const totalGzipBytes = measurements.reduce((sum, item) => sum + item.gzipSize, 0);
  const limit = Number.parseInt(process.env.BUNDLE_BUDGET_BYTES ?? '', 10) || DEFAULT_LIMIT_BYTES;

  /* eslint-disable no-console */
  console.log('Bundle budget report (gzipped sizes):');
  for (const item of measurements.sort((a, b) => b.gzipSize - a.gzipSize)) {
    console.log(`  ${item.relativePath.padEnd(40)} ${formatBytes(item.gzipSize)}`);
  }
  console.log(`  ${'-'.repeat(40)} ${'-'.repeat(12)}`);
  console.log(`  Total`.padEnd(42) + formatBytes(totalGzipBytes));
  console.log(`  Limit`.padEnd(42) + formatBytes(limit));
  /* eslint-enable no-console */

  if (totalGzipBytes > limit) {
    const overBy = totalGzipBytes - limit;
    throw new Error(
      `Bundle exceeded budget by ${formatBytes(overBy)} (limit ${formatBytes(limit)}, actual ${formatBytes(totalGzipBytes)})`,
    );
  }
}

main().catch((error) => {
  /* eslint-disable no-console */
  console.error('[bundle-budget] check failed:', error.message);
  if (error?.cause) {
    console.error('  cause:', error.cause);
  }
  /* eslint-enable no-console */
  process.exitCode = 1;
});
