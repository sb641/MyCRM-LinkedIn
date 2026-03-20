import fs from 'node:fs/promises';
import path from 'node:path';

export type LegacyEnvConfig = {
  userDataDir: string | null;
  proxyUrl: string | null;
  cdpUrl: string | null;
  linkedinUsername: string | null;
  linkedinPassword: string | null;
};

const legacyEnvMask = new Set<string>();

async function resolveWorkspaceRoot(startDir = process.cwd()) {
  let currentDir = path.resolve(startDir);

  while (true) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    const workspacePath = path.join(currentDir, 'pnpm-workspace.yaml');

    try {
      await fs.access(packageJsonPath);
      await fs.access(workspacePath);
      return currentDir;
    } catch {
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        return path.resolve(startDir);
      }

      currentDir = parentDir;
    }
  }
}

export async function readLegacyEnvConfig(projectRoot = process.cwd()): Promise<LegacyEnvConfig> {
  const fromProcessEnv = (key: string) => {
    const value = process.env[key]?.trim();
    return value ? value : null;
  };

  const fromEnvFile = (values: Map<string, string>, key: string) => {
    if (legacyEnvMask.has(key)) {
      return null;
    }

    const value = values.get(key)?.trim();
    return value ? value : null;
  };

  try {
    const workspaceRoot = await resolveWorkspaceRoot(projectRoot);
    const envPath = path.resolve(workspaceRoot, '.env');
    const raw = await fs.readFile(envPath, 'utf8');
    const values = new Map<string, string>();

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      values.set(key, value);
    }

    return {
      userDataDir: fromProcessEnv('USER_DATA_DIR') ?? fromEnvFile(values, 'USER_DATA_DIR'),
      proxyUrl: fromProcessEnv('PROXY_URL') ?? fromEnvFile(values, 'PROXY_URL'),
      cdpUrl: fromProcessEnv('CHROME_CDP_URL') ?? fromEnvFile(values, 'CHROME_CDP_URL'),
      linkedinUsername: fromProcessEnv('LINKEDIN_USERNAME') ?? fromEnvFile(values, 'LINKEDIN_USERNAME'),
      linkedinPassword: fromProcessEnv('LINKEDIN_PASSWORD') ?? fromEnvFile(values, 'LINKEDIN_PASSWORD')
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        userDataDir: fromProcessEnv('USER_DATA_DIR'),
        proxyUrl: fromProcessEnv('PROXY_URL'),
        cdpUrl: fromProcessEnv('CHROME_CDP_URL'),
        linkedinUsername: fromProcessEnv('LINKEDIN_USERNAME'),
        linkedinPassword: fromProcessEnv('LINKEDIN_PASSWORD')
      };
    }

    throw error;
  }
}

export async function isChromeCdpReachable(cdpUrl: string) {
  try {
    const versionUrl = new URL('/json/version', cdpUrl);
    const response = await fetch(versionUrl, {
      method: 'GET',
      cache: 'no-store'
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function getLinkedInAuthBootstrapState(projectRoot = process.cwd()) {
  const legacyConfig = await readLegacyEnvConfig(projectRoot);
  const cdpUrl = legacyConfig.cdpUrl?.trim() ?? '';
  const hasCdpUrl = Boolean(cdpUrl);
  const cdpReachable = hasCdpUrl ? await isChromeCdpReachable(cdpUrl) : false;
  const hasUserDataDir = Boolean(legacyConfig.userDataDir?.trim());
  const hasLinkedinCredentials = Boolean(
    legacyConfig.linkedinUsername?.trim() && legacyConfig.linkedinPassword?.trim()
  );

  return {
    legacyConfig,
    checks: {
      hasCdpUrl,
      cdpReachable,
      hasUserDataDir,
      hasLinkedinCredentials
    }
  };
}

export const __authConfigTestables = {
  setLegacyEnvMask(mask: Iterable<string>) {
    legacyEnvMask.clear();
    for (const key of mask) {
      legacyEnvMask.add(key);
    }
  }
};