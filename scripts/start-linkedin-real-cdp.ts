import { spawn } from 'node:child_process';
import path from 'node:path';
import { getLinkedInAuthBootstrapState } from '../packages/automation/src/auth-config';

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DEFAULT_CDP_PORT = 9222;

function normalizeChromeProfilePath(inputPath: string) {
  const resolvedPath = path.resolve(inputPath);
  const profileDirectory = path.basename(resolvedPath);
  const userDataDir = path.dirname(resolvedPath);
  const looksLikeProfileDirectory = /^profile\s+\d+$/i.test(profileDirectory) || /^default$/i.test(profileDirectory);

  if (looksLikeProfileDirectory) {
    return {
      userDataDir,
      profileDirectory
    };
  }

  return {
    userDataDir: resolvedPath,
    profileDirectory: undefined
  };
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
  const requestedProfileDirectory = process.argv[2]?.trim() || process.env.CHROME_PROFILE_DIRECTORY?.trim() || '';
  const requestedPortRaw = process.argv[3]?.trim() || process.env.CHROME_CDP_PORT?.trim() || String(DEFAULT_CDP_PORT);
  const requestedPort = Number.parseInt(requestedPortRaw, 10);

  if (!configuredUserDataDir) {
    throw new Error('USER_DATA_DIR is required to start Chrome with the real authenticated profile.');
  }

  if (!Number.isFinite(requestedPort) || requestedPort <= 0) {
    throw new Error(`Invalid Chrome CDP port: ${requestedPort}`);
  }

  const normalized = normalizeChromeProfilePath(configuredUserDataDir);
  const profileDirectory = requestedProfileDirectory || normalized.profileDirectory;
  const cdpUrl = `http://127.0.0.1:${requestedPort}`;
  const args = [
    `--remote-debugging-port=${requestedPort}`,
    `--user-data-dir=${normalized.userDataDir}`,
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

  const reachable = await waitForCdp(cdpUrl, 15000);
  if (!reachable) {
    throw new Error(
      `Chrome started with pid=${chrome.pid ?? 'unknown'} but DevTools did not become reachable at ${cdpUrl}/json/version. ` +
        'Chrome likely reused an existing browser process without enabling remote debugging.'
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        pid: chrome.pid ?? null,
        cdpUrl,
        userDataDir: normalized.userDataDir,
        profileDirectory: profileDirectory ?? null
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});