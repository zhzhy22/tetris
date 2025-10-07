#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const REQUIRED_GLOBAL_LINES = 80;
const REQUIRED_GLOBAL_STATEMENTS = 80;
const REQUIRED_CORE_LINES = 90;
const SUMMARY_PATH = path.resolve(process.cwd(), 'coverage', 'coverage-summary.json');

function formatPct(value) {
  return Number.isFinite(value) ? Number.parseFloat(value.toFixed(2)) : 0;
}

async function loadSummary() {
  try {
    const raw = await readFile(SUMMARY_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Unable to read coverage summary at ${SUMMARY_PATH}. Did you run Vitest with coverage enabled?`, { cause: error });
  }
}

function aggregateCore(summary) {
  const totals = {
    lines: { covered: 0, total: 0 },
    statements: { covered: 0, total: 0 },
    branches: { covered: 0, total: 0 },
    functions: { covered: 0, total: 0 },
  };

  for (const [file, metrics] of Object.entries(summary)) {
    if (file === 'total') {
      continue;
    }
    const normalizedPath = file.replaceAll('\\', '/');
    if (!normalizedPath.includes('/src/core/')) {
      continue;
    }
    for (const key of Object.keys(totals)) {
      const metric = metrics[key];
      if (!metric) {
        continue;
      }
      totals[key].covered += metric.covered ?? 0;
      totals[key].total += metric.total ?? 0;
    }
  }

  return totals;
}

function computePercentage(covered, total) {
  if (!total) {
    return 0;
  }
  return (covered / total) * 100;
}

async function main() {
  const summary = await loadSummary();
  const globalMetrics = summary.total ?? summary;
  const globalLinesPct = computePercentage(globalMetrics.lines?.covered ?? 0, globalMetrics.lines?.total ?? 0);
  const globalStatementsPct = computePercentage(globalMetrics.statements?.covered ?? 0, globalMetrics.statements?.total ?? 0);

  if (globalLinesPct < REQUIRED_GLOBAL_LINES) {
    throw new Error(`Global line coverage ${formatPct(globalLinesPct)}% is below required ${REQUIRED_GLOBAL_LINES}% threshold.`);
  }

  if (globalStatementsPct < REQUIRED_GLOBAL_STATEMENTS) {
    throw new Error(`Global statement coverage ${formatPct(globalStatementsPct)}% is below required ${REQUIRED_GLOBAL_STATEMENTS}% threshold.`);
  }

  const coreTotals = aggregateCore(summary);
  const coreLinesPct = computePercentage(coreTotals.lines.covered, coreTotals.lines.total);

  if (coreTotals.lines.total === 0) {
    throw new Error('Coverage summary does not contain src/core entries. Ensure Vitest include patterns cover source files.');
  }

  if (coreLinesPct < REQUIRED_CORE_LINES) {
    throw new Error(`src/core line coverage ${formatPct(coreLinesPct)}% is below required ${REQUIRED_CORE_LINES}% threshold.`);
  }

  console.log(
    `Coverage OK → Global lines: ${formatPct(globalLinesPct)}% (requires ≥${REQUIRED_GLOBAL_LINES}%), ` +
      `global statements: ${formatPct(globalStatementsPct)}% (requires ≥${REQUIRED_GLOBAL_STATEMENTS}%), ` +
      `src/core lines: ${formatPct(coreLinesPct)}% (requires ≥${REQUIRED_CORE_LINES}%)`,
  );
}

main().catch((error) => {
  console.error('[verify-coverage] check failed:', error.message);
  if (error?.cause) {
    console.error('  cause:', error.cause);
  }
  process.exitCode = 1;
});
