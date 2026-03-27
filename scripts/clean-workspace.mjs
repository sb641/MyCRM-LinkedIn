import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(scriptPath), '..');
const includeRuntimeData = process.argv.includes('--include-runtime-data');

const removablePaths = [
  '.e2e',
  '.turbo',
  'tmp',
  'apps/web/.next',
  'apps/web/test-results',
  'apps/web/playwright-report',
  'playwright-report',
  'test-results',
  'temp_cloned_cookies',
  'temp_cloned_cookies2',
  'temp_prof1_cookies'
];

if (includeRuntimeData) {
  removablePaths.push('.mycrm');
}

async function removeIfPresent(relativePath) {
  const targetPath = path.join(workspaceRoot, relativePath);

  try {
    await fs.rm(targetPath, { recursive: true, force: true });
    console.log(`removed ${relativePath}`);
  } catch (error) {
    console.error(`failed to remove ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

async function main() {
  console.log(`Cleaning workspace artifacts in ${workspaceRoot}`);
  console.log(includeRuntimeData ? 'Including .mycrm runtime data' : 'Preserving .mycrm runtime data');

  for (const relativePath of removablePaths) {
    await removeIfPresent(relativePath);
  }
}

await main();