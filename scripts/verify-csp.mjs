#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_DIRECTIVES = {
  'default-src': ["'self'"],
  'base-uri': ["'self'"],
  'object-src': ["'none'"],
  'script-src': ["'self'"],
  'style-src': ["'self'"],
  'img-src': ["'self'", 'data:'],
  'font-src': ["'self'"],
  'connect-src': ["'self'"],
  'worker-src': ["'self'"],
  'manifest-src': ["'self'"],
  'media-src': ["'self'", 'data:'],
};

const DISALLOWED_SOURCES = new Set(["'unsafe-inline'", "'unsafe-eval'", 'blob:', 'filesystem:']);

const rootDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');
const indexPath = path.join(distDir, 'index.html');

async function ensureFileExists(targetPath) {
  try {
    await access(targetPath, fsConstants.R_OK);
  } catch (error) {
    throw new Error(`Required file is missing: ${targetPath}. Did you run \"npm run build\"?`, {
      cause: error,
    });
  }
}

async function loadIndexHtml() {
  await ensureFileExists(indexPath);
  return readFile(indexPath, 'utf8');
}

function extractCspMeta(html) {
  const metaRegex = /<meta[^>]*http-equiv=(['"])Content-Security-Policy\1[^>]*>/i;
  const match = metaRegex.exec(html);
  if (!match) {
    throw new Error('Content-Security-Policy meta tag not found in dist/index.html');
  }
  const metaTag = match[0];
  const contentRegex = /content\s*=\s*(["'])(?<value>[\s\S]*?)\1/i;
  const contentMatch = contentRegex.exec(metaTag);
  if (!contentMatch || !contentMatch.groups?.value) {
    throw new Error('Content attribute missing on CSP meta tag');
  }
  return contentMatch.groups.value.trim();
}

function parseCspDirectives(cspValue) {
  const directives = new Map();
  for (const directive of cspValue.split(';')) {
    const trimmed = directive.trim();
    if (!trimmed) {
      continue;
    }
    const [name, ...sources] = trimmed.split(/\s+/);
    directives.set(name, sources);
  }
  return directives;
}

function assertDirectives(directives) {
  const errors = [];

  for (const [name, allowedSources] of Object.entries(REQUIRED_DIRECTIVES)) {
    if (!directives.has(name)) {
      errors.push(`Missing required directive: ${name}`);
      continue;
    }
    const actualSources = directives.get(name) ?? [];
    const extras = actualSources.filter((source) => !allowedSources.includes(source));
    const missing = allowedSources.filter((source) => !actualSources.includes(source));

    for (const disallowed of actualSources) {
      if (DISALLOWED_SOURCES.has(disallowed)) {
        errors.push(`Directive ${name} contains disallowed source ${disallowed}`);
      }
      if (isExternalSource(disallowed) && !allowedSources.includes(disallowed)) {
        errors.push(`Directive ${name} contains external source ${disallowed}`);
      }
    }

    if (extras.length > 0) {
      errors.push(`Directive ${name} contains unexpected sources: ${extras.join(', ')}`);
    }
    if (missing.length > 0) {
      errors.push(`Directive ${name} missing sources: ${missing.join(', ')}`);
    }
  }

  for (const [name, sources] of directives) {
    for (const source of sources) {
      if (DISALLOWED_SOURCES.has(source)) {
        errors.push(`Directive ${name} contains disallowed source ${source}`);
      }
      if (isExternalSource(source) && !isAllowedExternal(name, source)) {
        errors.push(`Directive ${name} references disallowed external source ${source}`);
      }
    }
  }

  if (errors.length > 0) {
    const errorMessage = ['CSP verification failed:', ...errors.map((line) => ` - ${line}`)].join('\n');
    throw new Error(errorMessage);
  }
}

function isExternalSource(source) {
  if (!source) {
    return false;
  }
  if (source === "'self'" || source === "'none'") {
    return false;
  }
  if (source.endsWith(':')) {
    return source !== 'data:';
  }
  return /^(https?:)?\/\//.test(source);
}

function isAllowedExternal(directive, source) {
  if (source === 'data:') {
    return directive === 'img-src' || directive === 'media-src';
  }
  return false;
}

async function main() {
  const html = await loadIndexHtml();
  const cspValue = extractCspMeta(html);
  const directives = parseCspDirectives(cspValue);
  assertDirectives(directives);
  console.log('CSP verification passed.');
}

main().catch((error) => {
  console.error('[verify-csp] check failed:', error.message);
  if (error?.cause) {
    console.error('  cause:', error.cause);
  }
  process.exitCode = 1;
});
