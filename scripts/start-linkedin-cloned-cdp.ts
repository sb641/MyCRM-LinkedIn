import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { getLinkedInAuthBootstrapState } from '../packages/automation/src/auth-config';

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DEFAULT_CDP_PORT = 9222;
const CLONE_INFO_PATH = path.resolve('.mycrm', 'logs', 'cloned-cdp-instance.json');

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

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolvePreferredChromeProfileDirectory(userDataDir: string, requestedProfileDirectory?: string) {
  if (requestedProfileDirectory && (await pathExists(path.join(userDataDir, requestedProfileDirectory)))) {
    return requestedProfileDirectory;
  }

  const localStatePath = path.join(userDataDir, 'Local State');

  try {
    const raw = await fs.readFile(localStatePath, 'utf8');
    const parsed = JSON.parse(raw) as {
      profile?: {
        last_used?: string;
        info_cache?: Record<
          string,
          {
            user_name?: string;
            gaia_name?: string;
            is_using_default_name?: boolean;
            active_time?: number;
          }
        >;
      };
    };

    const infoCache = parsed.profile?.info_cache ?? {};
    const preferredEntry = Object.entries(infoCache)
      .filter(([key, value]) => key && key !== 'undefined')
      .map(([key, value]) => ({
        key,
        score:
          (value?.user_name?.trim() ? 4 : 0) +
          (value?.gaia_name?.trim() ? 2 : 0) +
          (value?.is_using_default_name === false ? 1 : 0)
      }))
      .sort((left, right) => right.score - left.score)[0];

    if (preferredEntry && preferredEntry.score > 0 && (await pathExists(path.join(userDataDir, preferredEntry.key)))) {
      return preferredEntry.key;
    }

    const lastUsed = parsed.profile?.last_used?.trim();
    if (lastUsed && (await pathExists(path.join(userDataDir, lastUsed)))) {
      return lastUsed;
    }
  } catch {
    return null;
  }
}

async function isCdpReachable(cdpUrl: string) {
  try {
    const response = await fetch(new URL('/json/version', cdpUrl), {
      method: 'GET',
      cache: 'no-store'
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForCdp(cdpUrl: string, timeoutMs: number) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isCdpReachable(cdpUrl)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
}

async function main() {
  const authState = await getLinkedInAuthBootstrapState();
  const configuredUserDataDir = authState.legacyConfig.userDataDir?.trim();
  const requestedPortRaw = process.env.CHROME_CDP_PORT?.trim() || String(DEFAULT_CDP_PORT);
  const requestedPort = Number.parseInt(requestedPortRaw, 10);
  const requestedProfileDirectory = process.env.CHROME_PROFILE_DIRECTORY?.trim();

  if (!configuredUserDataDir) {
    throw new Error('USER_DATA_DIR is required to start a cloned CDP Chrome session.');
  }

  if (!Number.isFinite(requestedPort) || requestedPort <= 0) {
    throw new Error(`Invalid Chrome CDP port: ${requestedPort}`);
  }

  const cdpUrl = `http://127.0.0.1:${requestedPort}`;
  if (await isCdpReachable(cdpUrl)) {
    console.log(JSON.stringify({ ok: true, reused: true, cdpUrl }, null, 2));
    return;
  }

  const clonedUserDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mycrm-linkedin-live-cdp-'));
  await copyDirectorySkippingBusyFiles(configuredUserDataDir, clonedUserDataDir);
  const profileDirectory = await resolvePreferredChromeProfileDirectory(clonedUserDataDir, requestedProfileDirectory);

  await fs.mkdir(path.dirname(CLONE_INFO_PATH), { recursive: true });
  await fs.writeFile(
    CLONE_INFO_PATH,
    JSON.stringify(
      {
        clonedUserDataDir,
        profileDirectory,
        cdpUrl
      },
      null,
      2
    ),
    'utf8'
  );

  const args = [
    `--remote-debugging-port=${requestedPort}`,
    `--user-data-dir=${clonedUserDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'https://www.linkedin.com/messaging/'
  ];

  if (profileDirectory) {
    args.splice(2, 0, `--profile-directory=${profileDirectory}`);
  }

  const chrome = spawn(CHROME_PATH, args, {
    detached: false,
    stdio: 'ignore',
    windowsHide: false
  });

  const reachable = await waitForCdp(cdpUrl, 30000);
  if (!reachable) {
    throw new Error(
      `Cloned Chrome started with pid=${chrome.pid ?? 'unknown'} but DevTools did not become reachable at ${cdpUrl}/json/version.`
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        pid: chrome.pid ?? null,
        cdpUrl,
        clonedUserDataDir,
        profileDirectory: profileDirectory ?? null
      },
      null,
      2
    )
  );

  await new Promise(() => undefined);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});