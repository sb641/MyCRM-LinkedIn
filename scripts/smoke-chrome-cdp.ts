import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { getLinkedInAuthBootstrapState, isChromeCdpReachable } from '../packages/automation/src/auth-config';

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9222;
const CDP_URL = `http://127.0.0.1:${CDP_PORT}`;
const REPORT_PATH = path.resolve('.mycrm', 'logs', 'smoke-chrome-cdp.json');

const EXCLUDED_DIRS = new Set([
  'Cache',
  'Code Cache',
  'DawnCache',
  'GPUCache',
  'Media Cache',
  'System Cache',
  'VideoDecodeStats',
  'Service Worker',
  'Crashpad',
  'component_updater',
  'OptGuideOnDeviceModel',
  'OptimizationGuideDictionary',
  'Safe Browsing',
  'Sessions'
]);

async function copyDirectorySkippingBusyFiles(sourceDir: string, targetDir: string) {
  try {
    await fs.mkdir(targetDir, { recursive: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOSPC' || code === 'EACCES' || code === 'EPERM' || code === 'EBUSY') {
      return;
    }
    throw error;
  }

  let entries;
  try {
    entries = await fs.readdir(sourceDir, { withFileTypes: true });
  } catch (error) {
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectorySkippingBusyFiles(sourcePath, targetPath);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    try {
      await fs.copyFile(sourcePath, targetPath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES' || code === 'ENOSPC') {
        continue;
      }

      throw error;
    }
  }
}

async function createClonedUserDataDir(sourceDir: string) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mycrm-linkedin-cdp-'));
  await copyDirectorySkippingBusyFiles(sourceDir, tempDir);
  return tempDir;
}

async function waitForCdp(url: string, timeoutMs: number) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isChromeCdpReachable(url)) {
      return true;
    }

    await delay(500);
  }

  return false;
}

function startChrome(userDataDir: string) {
  return spawn(
    CHROME_PATH,
    [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank'
    ],
    {
      detached: false,
      stdio: 'ignore',
      windowsHide: false
    }
  );
}

async function stopChrome(processRef: ChildProcess | null) {
  if (!processRef || processRef.killed) {
    return;
  }

  processRef.kill();
  await delay(1000).catch(() => undefined);
}

async function main() {
  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  const authState = await getLinkedInAuthBootstrapState();

  if (!authState.legacyConfig.userDataDir) {
    throw new Error('USER_DATA_DIR is required for Chrome CDP smoke test.');
  }

  let chromeProcess: ChildProcess | null = null;
  let clonedUserDataDir: string | null = null;

  try {
    const alreadyReachable = await isChromeCdpReachable(CDP_URL);
    if (!alreadyReachable) {
      clonedUserDataDir = await createClonedUserDataDir(authState.legacyConfig.userDataDir);
      chromeProcess = startChrome(clonedUserDataDir);
    }

    const reachable = alreadyReachable || (await waitForCdp(CDP_URL, 30000));
    const report = {
      ok: reachable,
      cdpUrl: CDP_URL,
      userDataDir: authState.legacyConfig.userDataDir,
      clonedUserDataDir,
      alreadyReachable,
      startedChrome: !alreadyReachable,
      pid: chromeProcess?.pid ?? null
    };

    await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

    if (!reachable) {
      throw new Error(`Chrome CDP did not become reachable at ${CDP_URL}.`);
    }

    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    const report = {
      ok: false,
      cdpUrl: CDP_URL,
      error: error instanceof Error ? error.stack ?? error.message : String(error)
    };
    await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    throw error;
  } finally {
    await stopChrome(chromeProcess);
    if (clonedUserDataDir) {
      await fs.rm(clonedUserDataDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});