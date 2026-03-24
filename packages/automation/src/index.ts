import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import {
  getLinkedInAuthBootstrapState,
  readLegacyEnvConfig,
  type LegacyEnvConfig,
  isChromeCdpReachable,
  __authConfigTestables
} from './auth-config';
import {
  createFileSessionStore,
  FileSessionStore,
  InMemorySessionStore,
  type SessionState,
  type SessionStore
} from './session-store';

export {
  createFileSessionStore,
  FileSessionStore,
  InMemorySessionStore,
  type SessionState,
  type SessionStore
} from './session-store';

import { sampleContact } from '@mycrm/test-fixtures';
import {
  importThreadsPayloadSchema,
  importThreadsResultSchema,
  sendMessagePayloadSchema,
  sendMessageResultSchema
} from '@mycrm/core';
import { createMutationRepository } from '@mycrm/db';

export interface ThreadSummary {
  id: string;
  title: string;
  participantName: string;
  company: string | null;
  headline: string | null;
  snippet: string;
  unreadCount: number;
  lastMessageAt: number;
}

export interface MessageRecord {
  id: string;
  threadId: string;
  direction: 'inbound' | 'outbound';
  body: string;
  sentAt: number;
}

export interface ParsedThreadFixture {
  thread: ThreadSummary;
  messages: MessageRecord[];
}

export interface MessagingProvider {
  listThreads(): Promise<ThreadSummary[]>;
  getThreadMessages(threadId: string): Promise<MessageRecord[]>;
  sendMessage?(threadId: string, message: string): Promise<{ sentAt: number }>;
}

type BrowserCookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None' | string;
};

export type BrowserSyncOptions = {
  enableRealBrowserSync: boolean;
  enableRealSend?: boolean;
  sessionStore?: SessionStore;
  db?: Parameters<typeof createMutationRepository>[0];
  sqlite?: Parameters<typeof createMutationRepository>[1];
};

type BrowserSyncProviderResolution = {
  provider: MessagingProvider;
  providerKind: 'cdp' | 'saved-session' | 'direct-profile' | 'persistent-profile' | 'credential-bootstrap';
  fallbackReason?: string;
};

async function createLegacyImportedCookies(userDataDir: string) {
  const cookiesPath = path.resolve(userDataDir, 'Network', 'Cookies');
  try {
    await fs.access(cookiesPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    throw error;
  }

  return JSON.stringify([
    {
      name: 'legacy_profile_imported',
      value: userDataDir,
      domain: '.linkedin.com',
      path: '/'
    }
  ]);
}

function getDefaultLinkedInUserAgent() {
  return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
}

function normalizeChromeProfilePath(userDataDir: string) {
  const normalized = path.resolve(userDataDir);
  const profileName = path.basename(normalized);
  const parentDir = path.dirname(normalized);

  if (/^profile\s+\d+$/i.test(profileName) || /^default$/i.test(profileName)) {
    return {
      userDataDir: parentDir,
      profileDirectory: profileName
    };
  }

  return {
    userDataDir: normalized,
    profileDirectory: 'Default'
  };
}

async function resolvePreferredChromeProfileDirectory(userDataDir: string) {
  const localStatePath = path.join(userDataDir, 'Local State');

  try {
    const raw = await fs.readFile(localStatePath, 'utf8');
    const parsed = JSON.parse(raw) as {
      profile?: {
        last_used?: string;
        info_cache?: Record<
          string,
          {
            name?: string;
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

  return null;
}

function hasUsableLinkedInCookies(session: SessionState) {
  try {
    const parsed = JSON.parse(session.cookiesJson) as BrowserCookie[];
    if (!Array.isArray(parsed)) {
      return false;
    }

    return parsed.some(
      (cookie) =>
        typeof cookie?.name === 'string' &&
        cookie.name.length > 0 &&
        cookie.name !== 'legacy_profile_imported' &&
        typeof cookie.value === 'string' &&
        cookie.value.length > 0 &&
        (cookie.domain?.includes('linkedin.com') ?? true)
    );
  } catch {
    return false;
  }
}

function hasUsableLinkedInCookiesJson(cookiesJson: string) {
  try {
    const parsed = JSON.parse(cookiesJson) as BrowserCookie[];
    if (!Array.isArray(parsed)) {
      return false;
    }

    return parsed.some(
      (cookie) =>
        typeof cookie?.name === 'string' &&
        cookie.name.length > 0 &&
        cookie.name !== 'legacy_profile_imported' &&
        typeof cookie.value === 'string' &&
        cookie.value.length > 0 &&
        (cookie.domain?.includes('linkedin.com') ?? true)
    );
  } catch {
    return false;
  }
}

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

async function resolvePersistentProfileSource(
  userDataDir: string,
  profileDirectory?: string
): Promise<{ sourceUserDataDir: string; launchProfileDirectory?: string }> {
  const normalizedUserDataDir = path.resolve(userDataDir);

  if (!profileDirectory) {
    const preferredProfileDirectory = await resolvePreferredChromeProfileDirectory(normalizedUserDataDir);
    if (preferredProfileDirectory) {
      return {
        sourceUserDataDir: normalizedUserDataDir,
        launchProfileDirectory: preferredProfileDirectory
      };
    }

    return {
      sourceUserDataDir: normalizedUserDataDir,
      launchProfileDirectory: undefined
    };
  }

  const directProfileDir = path.join(normalizedUserDataDir, profileDirectory);
  if (await pathExists(directProfileDir)) {
    return {
      sourceUserDataDir: normalizedUserDataDir,
      launchProfileDirectory: profileDirectory
    };
  }

  const normalizedBaseName = path.basename(normalizedUserDataDir);
  if (normalizedBaseName.localeCompare(profileDirectory, undefined, { sensitivity: 'accent' }) === 0) {
    return {
      sourceUserDataDir: normalizedUserDataDir,
      launchProfileDirectory: undefined
    };
  }

  const knownProfileCandidates = ['Default', 'Profile 1', 'Profile 2', 'Profile 3'];
  for (const candidate of knownProfileCandidates) {
    const candidateDir = path.join(normalizedUserDataDir, candidate);
    if (await pathExists(candidateDir)) {
      return {
        sourceUserDataDir: normalizedUserDataDir,
        launchProfileDirectory: candidate
      };
    }
  }

  return {
    sourceUserDataDir: normalizedUserDataDir,
    launchProfileDirectory: undefined
  };
}

export async function loginAndSaveSession(accountId: string, sessionStore: SessionStore, legacyConfig: LegacyEnvConfig) {
  if (!legacyConfig.linkedinUsername || !legacyConfig.linkedinPassword) {
    return null;
  }

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    proxy: legacyConfig.proxyUrl ? { server: legacyConfig.proxyUrl } : undefined
  });
  try {
    const context = await browser.newContext({
      userAgent: getDefaultLinkedInUserAgent()
    });

    const page = await context.newPage();
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

    await page.fill('input[name="session_key"]', legacyConfig.linkedinUsername);
    await page.fill('input[name="session_password"]', legacyConfig.linkedinPassword);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => undefined)
    ]);

    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    if (currentUrl.includes('/checkpoint') || currentUrl.includes('/login')) {
      const title = await page.title().catch(() => '');
      const bodySnippet = await page
        .evaluate(() => document.body?.innerText?.slice(0, 1200) ?? '')
        .catch(() => '');
      throw new Error(
        `LinkedIn login did not complete for account ${accountId}. url=${currentUrl} title=${title} body=${bodySnippet}`
      );
    }

    const cookies = await context.cookies('https://www.linkedin.com');
    const cookiesJson = JSON.stringify(
      cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expires,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite as BrowserCookie['sameSite']
      }))
    );

    const session: SessionState = {
      accountId,
      cookiesJson,
      userAgent: getDefaultLinkedInUserAgent(),
      capturedAt: Date.now()
    };

    await sessionStore.save(session);
    return session;
  } finally {
    await browser.close();
  }
}

export async function bootstrapLinkedInSession(accountId: string, sessionStore: SessionStore) {
  const { legacyConfig } = await getLinkedInAuthBootstrapState();
  let lastBootstrapError: unknown = null;

  const configuredCdpUrl = legacyConfig.cdpUrl?.trim() ?? '';
  if (configuredCdpUrl && (await isChromeCdpReachable(configuredCdpUrl))) {
    const browser = await chromium.connectOverCDP(configuredCdpUrl);

    try {
      const context = browser.contexts()[0] ?? (await browser.newContext());
      const page = context.pages()[0] ?? (await context.newPage());
      await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'domcontentloaded' });
      const readyState = await waitForLinkedInMessagingReady(page, 20000);

      if (
        readyState.href.includes('/login') ||
        readyState.href.includes('/uas/login') ||
        readyState.href.includes('/checkpoint') ||
        readyState.href.includes('/challenge')
      ) {
        throw new Error(
          `Configured Chrome DevTools session did not reach an authenticated LinkedIn messaging page for account ${accountId}. url=${readyState.href}`
        );
      }

      const cookies = await context.cookies('https://www.linkedin.com');
      const cookiesJson = JSON.stringify(
        cookies.map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires,
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
          sameSite: cookie.sameSite as BrowserCookie['sameSite']
        }))
      );

      if (!hasUsableLinkedInCookiesJson(cookiesJson)) {
        throw new Error(
          `Configured Chrome DevTools session reached ${readyState.href} but did not expose usable LinkedIn cookies for account ${accountId}.`
        );
      }

      const session: SessionState = {
        accountId,
        cookiesJson,
        userAgent: await page.evaluate(() => navigator.userAgent).catch(() => getDefaultLinkedInUserAgent()),
        capturedAt: Date.now()
      };

      await sessionStore.save(session);
      return session;
    } finally {
      await browser.close();
    }
  }

  if (legacyConfig.userDataDir) {
    try {
      return await captureLinkedInSessionFromDirectPersistentProfile(accountId, sessionStore);
    } catch (directProfileError) {
      lastBootstrapError = directProfileError;
      debugLog('direct persistent-profile bootstrap failed', directProfileError);

      try {
        return await captureLinkedInSessionFromChromeProfile(accountId, sessionStore);
      } catch (cdpProfileError) {
        lastBootstrapError = cdpProfileError;
        debugLog('chrome-profile CDP bootstrap failed', cdpProfileError);
      }
    }
  }

  const session = await loginAndSaveSession(accountId, sessionStore, legacyConfig);

  if (!session || !hasUsableLinkedInCookies(session)) {
    if (lastBootstrapError) {
      throw lastBootstrapError;
    }

    throw new Error(
      `LinkedIn credential bootstrap is not configured for account ${accountId}. Set LINKEDIN_USERNAME and LINKEDIN_PASSWORD in the workspace environment.`
    );
  }

  return session;
}

async function waitForChromeCdp(url: string, timeoutMs: number) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isChromeCdpReachable(url)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for Chrome DevTools at ${url}.`);
}

function getChromeExecutablePath() {
  return 'C:/Program Files/Google/Chrome/Application/chrome.exe';
}

export async function captureLinkedInSessionFromChromeProfile(accountId: string, sessionStore: SessionStore) {
  const { legacyConfig } = await getLinkedInAuthBootstrapState();
  if (!legacyConfig.userDataDir) {
    throw new Error(`Chrome profile capture is not configured for account ${accountId}. Set USER_DATA_DIR first.`);
  }

  const normalizedProfile = normalizeChromeProfilePath(legacyConfig.userDataDir);
  const cdpPort = 9223;
  const cdpUrl = `http://127.0.0.1:${cdpPort}`;
  const chromeProcess = spawn(
    getChromeExecutablePath(),
    [
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${normalizedProfile.userDataDir}`,
      `--profile-directory=${normalizedProfile.profileDirectory}`,
      '--no-first-run',
      '--no-default-browser-check',
      'https://www.linkedin.com/messaging/'
    ],
    {
      detached: false,
      stdio: 'ignore',
      windowsHide: false
    }
  );

  try {
    await waitForChromeCdp(cdpUrl, 20000);
    const browser = await chromium.connectOverCDP(cdpUrl);

    try {
      const context = browser.contexts()[0] ?? (await browser.newContext());
      const page = context.pages()[0] ?? (await context.newPage());
      await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);

      if (page.url().includes('/login') || page.url().includes('/checkpoint') || page.url().includes('/challenge')) {
        throw new Error(
          `LinkedIn session capture did not reach an authenticated messaging page for account ${accountId}. url=${page.url()}`
        );
      }

      const cookies = await context.cookies('https://www.linkedin.com');
      const cookiesJson = JSON.stringify(
        cookies.map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires,
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
          sameSite: cookie.sameSite as BrowserCookie['sameSite']
        }))
      );

      const session: SessionState = {
        accountId,
        cookiesJson,
        userAgent: await page.evaluate(() => navigator.userAgent).catch(() => getDefaultLinkedInUserAgent()),
        capturedAt: Date.now()
      };

      await sessionStore.save(session);
      return session;
    } finally {
      await browser.close();
    }
  } finally {
    chromeProcess.kill();
  }
}

export async function captureLinkedInSessionFromDirectPersistentProfile(accountId: string, sessionStore: SessionStore) {
  const { legacyConfig } = await getLinkedInAuthBootstrapState();
  if (!legacyConfig.userDataDir) {
    throw new Error(`Direct Chrome profile capture is not configured for account ${accountId}. Set USER_DATA_DIR first.`);
  }

  const exactProfile = path.resolve(legacyConfig.userDataDir);
  const normalizedProfile = normalizeChromeProfilePath(legacyConfig.userDataDir);
  const launchAttempts = [
    {
      userDataDir: exactProfile,
      profileDirectory: undefined
    },
    {
      userDataDir: normalizedProfile.userDataDir,
      profileDirectory: normalizedProfile.profileDirectory
    }
  ].filter(
    (attempt, index, attempts) =>
      attempts.findIndex(
        (candidate) =>
          candidate.userDataDir === attempt.userDataDir &&
          candidate.profileDirectory === attempt.profileDirectory
      ) === index
  );

  let lastError: unknown = null;

  for (const attempt of launchAttempts) {
    try {
      const session = await withLinkedInMessagingDirectPersistentProfile(
        {
          proxyUrl: legacyConfig.proxyUrl,
          userDataDir: attempt.userDataDir,
          profileDirectory: attempt.profileDirectory,
          userAgent: getDefaultLinkedInUserAgent()
        },
        async (page) => {
          await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'domcontentloaded' });
          const readyState = await waitForLinkedInMessagingReady(page, 20000);

          debugLog('direct profile capture ready state', readyState);

          if (
            readyState.href.includes('/login') ||
            readyState.href.includes('/checkpoint') ||
            readyState.href.includes('/challenge')
          ) {
            throw new Error(
              `LinkedIn direct profile capture did not reach an authenticated messaging page for account ${accountId}. url=${readyState.href}`
            );
          }

          const context = page.context();
          const cookies = await context.cookies('https://www.linkedin.com');
          const cookiesJson = JSON.stringify(
            cookies.map((cookie) => ({
              name: cookie.name,
              value: cookie.value,
              domain: cookie.domain,
              path: cookie.path,
              expires: cookie.expires,
              httpOnly: cookie.httpOnly,
              secure: cookie.secure,
              sameSite: cookie.sameSite as BrowserCookie['sameSite']
            }))
          );

          debugLog(
            'direct profile capture cookies',
            cookies.map((cookie) => ({
              name: cookie.name,
              domain: cookie.domain,
              expires: cookie.expires
            }))
          );

          if (!hasUsableLinkedInCookiesJson(cookiesJson)) {
            throw new Error(
              `LinkedIn direct profile capture reached ${readyState.href} but did not expose usable LinkedIn cookies for account ${accountId}.`
            );
          }

          return {
            accountId,
            cookiesJson,
            userAgent: await page.evaluate(() => navigator.userAgent).catch(() => getDefaultLinkedInUserAgent()),
            capturedAt: Date.now()
          } satisfies SessionState;
        }
      );

      await sessionStore.save(session);
      return session;
    } catch (error) {
      lastError = error;
      debugLog('direct persistent-profile launch attempt failed', {
        userDataDir: attempt.userDataDir,
        profileDirectory: attempt.profileDirectory,
        error
      });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Direct Chrome profile capture failed for account ${accountId}.`);
}

async function ensureLegacySession(accountId: string, sessionStore: SessionStore) {
  const existing = await sessionStore.load(accountId);
  if (existing) {
    return existing;
  }

  const legacyConfig = await readLegacyEnvConfig();

  // For real live sync, prefer connecting to a running Chrome via CDP.
  // This keeps the exact same browser/session the user already has open.
  if (legacyConfig.cdpUrl) {
    return null;
  }

  // Last fallback: import cookie file from a local Chrome profile.
  if (!legacyConfig.userDataDir) {
    return null;
  }

  const cookiesJson = await createLegacyImportedCookies(legacyConfig.userDataDir);
  if (!cookiesJson) {
    return null;
  }

  const session: SessionState = {
    accountId,
    cookiesJson,
    userAgent: getDefaultLinkedInUserAgent(),
    capturedAt: Date.now()
  };

  await sessionStore.save(session);
  return session;
}

function isLinkedInLoginRedirectError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes('redirected to login') || message.includes('/login') || message.includes('/uas/login');
}

export const __testables = {
  isLinkedInLoginRedirectError,
  setLegacyEnvMask(mask: Iterable<string>) {
    __authConfigTestables.setLegacyEnvMask(mask);
  }
};

export function parseThreadFixture(html: string): ParsedThreadFixture {
  const threadMatch = html.match(/<section[^>]*data-thread-id="([^"]+)"[^>]*data-title="([^"]+)"[^>]*data-participant="([^"]+)"[^>]*data-snippet="([^"]*)"[^>]*data-unread="(\d+)"[^>]*data-last-message-at="(\d+)"/i);

  if (!threadMatch) {
    throw new Error('Invalid thread fixture: missing thread metadata');
  }

  const messages = Array.from(
    html.matchAll(/<article[^>]*data-message-id="([^"]+)"[^>]*data-direction="(inbound|outbound)"[^>]*data-sent-at="(\d+)"[^>]*>([\s\S]*?)<\/article>/gi)
  ).map((match) => ({
    id: match[1],
    threadId: threadMatch[1],
    direction: match[2] as 'inbound' | 'outbound',
    sentAt: Number(match[3]),
    body: match[4].replace(/<[^>]+>/g, '').trim()
  }));

  return {
    thread: {
      id: threadMatch[1],
      title: threadMatch[2],
      participantName: threadMatch[3],
      company: null,
      headline: null,
      snippet: threadMatch[4],
      unreadCount: Number(threadMatch[5]),
      lastMessageAt: Number(threadMatch[6])
    },
    messages
  };
}

export class FakeMessagingProvider implements MessagingProvider {
  constructor(private readonly fixtures: ParsedThreadFixture[]) {}

  async listThreads(): Promise<ThreadSummary[]> {
    return this.fixtures.map((fixture) => fixture.thread);
  }

  async getThreadMessages(threadId: string): Promise<MessageRecord[]> {
    return this.fixtures.find((fixture) => fixture.thread.id === threadId)?.messages ?? [];
  }

  async sendMessage(_threadId: string, _message: string): Promise<{ sentAt: number }> {
    return { sentAt: Date.now() };
  }
}

export class MockMessagingProvider implements MessagingProvider {
  async listThreads(): Promise<ThreadSummary[]> {
    return [
      {
        id: 'thread-1',
        title: `${sampleContact.name} at ${sampleContact.company}`,
        participantName: sampleContact.name,
        company: sampleContact.company ?? null,
        headline: null,
        snippet: 'Mock thread',
        unreadCount: 0,
        lastMessageAt: 1735689600000
      }
    ];
  }

  async getThreadMessages(threadId: string): Promise<MessageRecord[]> {
    return [
      {
        id: `${threadId}-message-1`,
        threadId,
        direction: 'inbound',
        body: 'Mock thread',
        sentAt: 1735689600000
      }
    ];
  }
}

export class PlaywrightMessagingProvider /*PATCH*/ implements MessagingProvider {
  constructor(private readonly session: SessionState) {}

  async listThreads(): Promise<ThreadSummary[]> {
    return withLinkedInMessagingPage(this.session, async (page) => extractLinkedInThreads(page, this.session.accountId));
  }

  async getThreadMessages(threadId: string): Promise<MessageRecord[]> {
    return withLinkedInMessagingPage(this.session, async (page) => extractLinkedInMessages(page, threadId, 15000));
  }

  async sendMessage(threadId: string, message: string): Promise<{ sentAt: number }> {
    return withLinkedInMessagingPage(this.session, async (page) =>
      sendLinkedInMessage(page, this.session.accountId, threadId, message, 15000)
    );
  }
}

type PersistentProfileOptions = {
  proxyUrl: string | null;
  userDataDir: string;
  profileDirectory?: string;
  userAgent: string;
};

function normalizeSameSite(value: string | undefined): 'Strict' | 'Lax' | 'None' | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.toLowerCase();
  if (normalized === 'strict') {
    return 'Strict';
  }
  if (normalized === 'lax') {
    return 'Lax';
  }
  if (normalized === 'none') {
    return 'None';
  }

  return undefined;
}

function parseSessionCookies(session: SessionState) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(session.cookiesJson);
  } catch {
    throw new Error(`Saved browser session for account ${session.accountId} contains invalid cookies JSON.`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Saved browser session for account ${session.accountId} must contain a cookie array.`);
  }

  return parsed
    .filter((cookie): cookie is BrowserCookie => Boolean(cookie && typeof cookie === 'object'))
    .map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain ?? '.linkedin.com',
      path: cookie.path ?? '/',
      expires: typeof cookie.expires === 'number' ? cookie.expires : undefined,
      httpOnly: Boolean(cookie.httpOnly),
      secure: cookie.secure ?? true,
      sameSite: normalizeSameSite(cookie.sameSite),
      url: cookie.domain ? undefined : 'https://www.linkedin.com'
    }))
    .filter((cookie) => typeof cookie.name === 'string' && cookie.name.length > 0 && typeof cookie.value === 'string');
}

async function withLinkedInMessagingPage<T>(session: SessionState, callback: (page: import('@playwright/test').Page) => Promise<T>) {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      userAgent: session.userAgent
    });

    const cookies = parseSessionCookies(session);
    if (cookies.length === 0) {
      throw new Error(`Saved browser session for account ${session.accountId} does not contain usable LinkedIn cookies.`);
    }

    await context.addCookies(
      cookies.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expires,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
        url: cookie.url
      }))
    );

    const page = await context.newPage();
    return await callback(page);
  } finally {
    await browser.close();
  }
}

async function withLinkedInMessagingConnectedChrome<T>(
  cdpUrl: string,
  callback: (page: import('@playwright/test').Page) => Promise<T>
) {
  // Connect to a running Chrome instance over CDP (reuses existing profile + session)
  const browser = await chromium.connectOverCDP(cdpUrl);

  try {
    const contexts = browser.contexts();
    const context = contexts[0] ?? (await browser.newContext());
    const page = context.pages()[0] ?? (await context.newPage());
    return await callback(page);
  } finally {
    // Just disconnect the Playwright client when closing the session.
    // We should not call browser.close() because it might terminate the 
    // user's actual Chrome instance or put it in a frozen state.
    // Instead, we just let the connection go or close the browser object
    // if we are sure it only closes the CDP session. 
    // Wait, Playwright documentation says browser.close() for CDP-connected 
    // browsers DOES NOT close the browser, it just Disconnects.
    // But since the user reports a freeze, we'll be safer.
    // We will only close the page if we created one, but here we'll just
    // disconnect the client.
    await (browser as any)._connection?.close(); // Internal way or just disconnect
    // Actually, simply not calling browser.close() might be safer if it's causing freezes.
    // But let's try browser.close() again but make sure we don't close the browser 
    // by using a different approach if available.
    // For now, let's just use disconnect() if available.
    if ((browser as any).disconnect) {
      await (browser as any).disconnect();
    } else {
      await browser.close();
    }
  }
}

async function withLinkedInMessagingPersistentProfile<T>(
  options: PersistentProfileOptions,
  callback: (page: import('@playwright/test').Page) => Promise<T>
) {
  const tempUserDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mycrm-linkedin-profile-'));
  const resolvedProfile = await resolvePersistentProfileSource(options.userDataDir, options.profileDirectory);
  await copyDirectorySkippingBusyFiles(resolvedProfile.sourceUserDataDir, tempUserDataDir);

  let context: import('@playwright/test').BrowserContext | null = null;

  try {
    context = await chromium.launchPersistentContext(tempUserDataDir, {
      channel: 'chrome',
      headless: false,
      proxy: options.proxyUrl ? { server: options.proxyUrl } : undefined,
      userAgent: options.userAgent,
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--disable-blink-features=AutomationControlled',
        '--remote-debugging-port=9222'
      ].concat(
        resolvedProfile.launchProfileDirectory
          ? [`--profile-directory=${resolvedProfile.launchProfileDirectory}`]
          : []
      )
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Persistent Chrome profile launch failed for LinkedIn sync. userDataDir=${options.userDataDir} profileDirectory=${options.profileDirectory} resolvedProfileDirectory=${resolvedProfile.launchProfileDirectory ?? ''} tempUserDataDir=${tempUserDataDir} message=${message}`
    );
  }

  try {
    const existingPage = context.pages()[0];
    const page = existingPage ?? (await context.newPage());
    return await callback(page);
  } finally {
    await context.close();
    await fs.rm(tempUserDataDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function withLinkedInMessagingDirectPersistentProfile<T>(
  options: PersistentProfileOptions,
  callback: (page: import('@playwright/test').Page) => Promise<T>
) {
  let context: import('@playwright/test').BrowserContext;

  try {
    context = await chromium.launchPersistentContext(options.userDataDir, {
      channel: 'chrome',
      headless: false,
      proxy: options.proxyUrl ? { server: options.proxyUrl } : undefined,
      userAgent: options.userAgent,
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
      ignoreDefaultArgs: ['--enable-automation'],
      args: ['--disable-blink-features=AutomationControlled', '--remote-debugging-port=9222'].concat(
        options.profileDirectory ? [`--profile-directory=${options.profileDirectory}`] : []
      )
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    
    // Explicitly handle background Chrome instances which accept the launch request,
    // open a tab if asked, but exit the spawning process - preventing CDP attachment.
    if (message.includes('Browser closed') || message.includes('Target closed') || message.includes('Timeout')) {
      throw new Error(
        `Direct Chrome profile launch failed. The browser may have opened visually, but automation failed to attach to the DevTools endpoint. ` +
        `This almost always means an existing background Chrome process is locking the profile. \n` +
        `Next steps:\n` +
        `1. Close ALL Chrome windows AND exit Chrome from the Windows system tray.\n` +
        `2. OR use CHROME_CDP_URL to connect to the already-running instance.\n\n` +
        `Playwright internal error: ${message}`
      );
    }

    if (message.includes('Opening in existing browser session')) {
      throw new Error(
        `[CRITICAL] Chrome is already running using this profile. Automation cannot attach to an already-running Chrome window via USER_DATA_DIR.\n\n` +
        `To fix this, you have two options:\n` +
        `Option A (Recommended): Close ALL Chrome windows completely (make sure it's not in the system tray), then run the sync again. Automation will open Chrome for you.\n` +
        `Option B: Keep Chrome open, but you must start it with '--remote-debugging-port=9222' and set CHROME_CDP_URL=http://127.0.0.1:9222 in your .env file.`
      );
    }

    throw error;
  }

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    return await callback(page);
  } finally {
    await context.close();
  }
}

async function withLinkedInMessagingStrictDirectPersistentProfile<T>(
  options: PersistentProfileOptions,
  callback: (page: import('@playwright/test').Page) => Promise<T>
) {
  const context = await chromium.launchPersistentContext(options.userDataDir, {
    channel: 'chrome',
    headless: false,
    proxy: options.proxyUrl ? { server: options.proxyUrl } : undefined,
    userAgent: options.userAgent,
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled', '--remote-debugging-port=9222'].concat(
      options.profileDirectory ? [`--profile-directory=${options.profileDirectory}`] : []
    )
  });

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    return await callback(page);
  } finally {
    await context.close();
  }
}

const DEBUG_LINKEDIN = process.env.LINKEDIN_DEBUG === '1';

function debugLog(...args: Array<unknown>) {
  if (!DEBUG_LINKEDIN) return;
  // eslint-disable-next-line no-console
  console.log('[linkedIn-debug]', ...args);
}

async function waitForLinkedInMessagingReady(
  page: import('@playwright/test').Page,
  timeoutMs: number,
  credentials?: { username: string; password: string } | null
) {
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);

  const startedAt = Date.now();
  let didAttemptLogin = false;

  while (Date.now() - startedAt < timeoutMs) {
    const state = await page
      .evaluate(() => {
        const href = window.location.href;
        const hasMessagingShell = Boolean(
          document.querySelector(
            '.msg-conversations-container, .msg-overlay-list-bubble, .msg-thread, .msg-s-message-list, [data-control-name*="conversation"], [data-control-name*="thread"]'
          )
        );

        return {
          href,
          hasMessagingShell
        };
      })
      .catch(() => ({ href: page.url(), hasMessagingShell: false }));

    if (state.href.includes('/login') || state.href.includes('/uas/login')) {
      // Attempt auto-login if we have credentials and haven't tried yet
      if (credentials && !didAttemptLogin) {
        didAttemptLogin = true;
        console.log('[linkedin-sync] Session expired, attempting credential login...');
        try {
          if (!state.href.includes('/login')) {
            await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
          }
          await page.fill('#username', credentials.username).catch(() => undefined);
          await page.fill('#password', credentials.password).catch(() => undefined);
          await page.click('button[type="submit"]').catch(() => undefined);
          await page.waitForURL(/linkedin\.com\/(?!login|uas\/login)/, { timeout: 30000 }).catch(() => undefined);
          await page.waitForLoadState('domcontentloaded').catch(() => undefined);
          await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'domcontentloaded' });
          await page.waitForLoadState('domcontentloaded').catch(() => undefined);
          continue;
        } catch (loginError) {
          console.warn('[linkedin-sync] Auto-login failed:', loginError instanceof Error ? loginError.message : loginError);
        }
      }
      return state;
    }

    if (state.href.includes('/checkpoint') || state.href.includes('/challenge')) {
      return state;
    }

    if (state.href.includes('/messaging') && state.hasMessagingShell) {
      return state;
    }

    await page.waitForTimeout(500);
  }

  return {
    href: page.url(),
    hasMessagingShell: false
  };
}

async function extractLinkedInThreads(
  page: import('@playwright/test').Page,
  accountId: string,
  credentials?: { username: string; password: string } | null
): Promise<ThreadSummary[]> {
  await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'domcontentloaded' });
  const readyState = await waitForLinkedInMessagingReady(page, 25000, credentials);

  if (readyState.href.includes('/login') || readyState.href.includes('/uas/login')) {
    throw new Error('LinkedIn redirected to login. Auto-login was attempted but failed or no credentials were provided. Please ensure your LinkedIn session is active or set LINKEDIN_USERNAME and LINKEDIN_PASSWORD.');
  }

  if (readyState.href.includes('/checkpoint') || readyState.href.includes('/challenge')) {
    throw new Error('LinkedIn security challenge detected. Please open LinkedIn in your browser and resolve any verification before syncing.');
  }

  const conversationList = page
    .locator(
      'li.msg-conversations-container__convo-item, li.msg-conversation-listitem, [data-view-name="messages-list-item"], [data-control-name*="conversation"], [data-control-name*="thread"]'
    )
    .filter({ has: page.locator('a[href*="/messaging/thread/"]') });

  const visibleCount = await conversationList.count().catch(() => 0);
  if (visibleCount > 0) {
    for (let index = 0; index < Math.min(visibleCount, 12); index += 1) {
      await conversationList.nth(index).scrollIntoViewIfNeeded().catch(() => undefined);
      await page.waitForTimeout(150);
    }
  }

  if (DEBUG_LINKEDIN) {
    const info = await page.evaluate(() => {
      const bodyText = document.body.innerText?.slice(0, 4096) ?? '';
      return {
        url: window.location.href,
        title: document.title,
        bodySnippet: bodyText
      };
    });

    debugLog('linkedin page info:', info);
  }

  const threads = await page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-control-name*="conversation"], [data-control-name*="thread"], [data-view-name="messages-list-item"], li.msg-conversation-listitem, li.msg-conversations-container__convo-item'
      )
    );

    const unique = new Map<string, {
      id: string;
      title: string;
      participantName: string;
      company: string | null;
      headline: string | null;
      snippet: string;
      unreadCount: number;
      lastMessageAt: number;
    }>();

    for (const element of candidates) {
      const rawId =
        element.getAttribute('data-id') ??
        element.getAttribute('data-conversation-id') ??
        element.dataset.id ??
        element.id ??
        '';
      const href = element.querySelector<HTMLAnchorElement>('a[href*="/messaging/thread/"]')?.href ?? '';
      const hrefMatch = href.match(/thread\/(.+?)(?:\/|\?|$)/i);
      const id = (hrefMatch?.[1] ?? rawId).trim();

      if (!id || unique.has(id)) {
        continue;
      }

      // Contact name: prefer the name-only selectors, avoid subtitle/lockup ones that may contain company
      const nameEl =
        element.querySelector<HTMLElement>('.msg-conversation-listitem__participant-names') ??
        element.querySelector<HTMLElement>('.msg-conversation-card__participant-names') ??
        element.querySelector<HTMLElement>('.t-14.t-black.t-bold') ??
        element.querySelector<HTMLElement>('.artdeco-entity-lockup__title');
      const title = (nameEl?.innerText?.trim() ?? element.getAttribute('aria-label')?.trim() ?? '').split('\n')[0].trim();

      // Subtitle / headline: often contains company or role+company
      const subtitleEl =
        element.querySelector<HTMLElement>('.artdeco-entity-lockup__subtitle') ??
        element.querySelector<HTMLElement>('.msg-conversation-listitem__participant-company') ??
        element.querySelector<HTMLElement>('.t-12.t-black--light.t-normal');
      const subtitleText = subtitleEl?.innerText?.trim() ?? '';

      // Try to split subtitle into role and company (common pattern: "Role at Company" or just company)
      let company: string | null = null;
      let headline: string | null = null;
      if (subtitleText) {
        const atIndex = subtitleText.toLowerCase().indexOf(' at ');
        if (atIndex > 0) {
          headline = subtitleText.slice(0, atIndex).trim() || null;
          company = subtitleText.slice(atIndex + 4).trim() || null;
        } else {
          // Just a company name with no role
          company = subtitleText;
        }
      }

      const snippet =
        element.querySelector<HTMLElement>('.msg-conversation-listitem__message-snippet')
          ?.innerText?.trim() ??
        element.querySelector<HTMLElement>('.msg-conversation-card__message-snippet')
          ?.innerText?.trim() ??
        element.querySelector<HTMLElement>('.artdeco-entity-lockup__caption')
          ?.innerText?.trim() ??
        '';
      const timeText =
        element.querySelector<HTMLElement>('time, .msg-conversation-listitem__time-stamp, .msg-conversation-card__time-stamp')
          ?.innerText?.trim() ??
        '';
      const unreadText =
        element.querySelector<HTMLElement>('.msg-conversation-listitem__unread-count, .notification-badge__count')?.innerText?.trim() ??
        '0';
      const unreadCount = Number.parseInt(unreadText.replace(/\D+/g, ''), 10) || 0;

      unique.set(id, {
        id,
        title: title || 'LinkedIn conversation',
        participantName: title || 'Unknown participant',
        company,
        headline,
        snippet,
        unreadCount,
        lastMessageAt: timeText ? Date.now() : Date.now()
      });
    }

    return Array.from(unique.values());
  });

  if (threads.length === 0) {
    if (DEBUG_LINKEDIN) {
      debugLog('No threads found; waiting for potential async load');
      await page.waitForTimeout(5000);
      const info2 = await page.evaluate(() => ({ url: window.location.href, title: document.title, bodySnippet: document.body.innerText?.slice(0, 4096) ?? '' }));
      debugLog('post-wait info:', info2);
    }

    if (page.url().includes('/login') || page.url().includes('/uas/login')) {
      throw new Error(
        `LinkedIn redirected to login for account ${accountId}. Open an authenticated Chrome session and set CHROME_CDP_URL, or provide a reusable USER_DATA_DIR profile.`
      );
    }

    if (page.url().includes('/checkpoint') || page.url().includes('/challenge')) {
      throw new Error(`LinkedIn requires checkpoint/challenge verification for account ${accountId}. Complete it in the opened browser and retry.`);
    }

    throw new Error(`No LinkedIn conversations found for account ${accountId}.`);
  }

  return threads;
}

async function extractLinkedInMessages(
  page: import('@playwright/test').Page,
  threadId: string,
  timeoutMs: number
): Promise<MessageRecord[]> {
  await page.goto(`https://www.linkedin.com/messaging/thread/${threadId}/`, { waitUntil: 'domcontentloaded' });
  await waitForLinkedInMessagingReady(page, timeoutMs);

  return page.evaluate((currentThreadId) => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.msg-s-message-list__event, .msg-s-message-group__messages li, li.msg-s-message-list__event'
      )
    );

    return nodes
      .map((node, index) => {
        const body =
          node.querySelector<HTMLElement>('.msg-s-event-listitem__body, .msg-s-event-listitem__message-bubble, p')?.innerText?.trim() ??
          node.innerText?.trim() ??
          '';
        if (!body) {
          return null;
        }

        const isOutbound =
          node.className.includes('msg-s-message-group--self') ||
          node.getAttribute('data-event-urn')?.includes('memberTo') ||
          false;

        return {
          id: node.getAttribute('data-id') ?? node.id ?? `${currentThreadId}-message-${index + 1}`,
          threadId: currentThreadId,
          direction: isOutbound ? 'outbound' : 'inbound',
          body,
          sentAt: Date.now() - (nodes.length - index) * 1000
        };
      })
      .filter((message): message is MessageRecord => Boolean(message));
  }, threadId);
}

async function sendLinkedInMessage(
  page: import('@playwright/test').Page,
  accountId: string,
  threadId: string,
  message: string,
  timeoutMs: number
): Promise<{ sentAt: number }> {
  await page.goto(`https://www.linkedin.com/messaging/thread/${threadId}/`, { waitUntil: 'domcontentloaded' });
  await waitForLinkedInMessagingReady(page, timeoutMs);

  if (page.url().includes('/login') || page.url().includes('/uas/login')) {
    throw new Error(
      `LinkedIn redirected to login before sending for account ${accountId}. Open an authenticated Chrome session and retry.`
    );
  }

  if (page.url().includes('/checkpoint') || page.url().includes('/challenge')) {
    throw new Error(`LinkedIn requires checkpoint/challenge verification for account ${accountId}. Complete it in the browser and retry.`);
  }

  const composer = page
    .locator(
      '[contenteditable="true"][role="textbox"], div.msg-form__contenteditable[contenteditable="true"], .msg-form__contenteditable[contenteditable="true"]'
    )
    .first();

  await composer.waitFor({ state: 'visible', timeout: timeoutMs }).catch(() => {
    throw new Error(`LinkedIn message composer was not available for account ${accountId} in thread ${threadId}.`);
  });

  await composer.click();
  await composer.fill(message).catch(async () => {
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => undefined);
    await page.keyboard.type(message, { delay: 10 });
  });

  const sendButton = page
    .locator(
      'button.msg-form__send-button, button[aria-label*="Send"], button[data-control-name*="send"]'
    )
    .first();

  await sendButton.waitFor({ state: 'visible', timeout: timeoutMs }).catch(() => {
    throw new Error(`LinkedIn send button was not available for account ${accountId} in thread ${threadId}.`);
  });

  await Promise.all([
    sendButton.click(),
    waitForLinkedInMessagingReady(page, timeoutMs)
  ]);

  return { sentAt: Date.now() };
}

class CdpMessagingProvider implements MessagingProvider {
  constructor(
    private readonly cdpUrl: string,
    private readonly accountId: string,
    private readonly credentials?: { username: string; password: string } | null
  ) {}

  async listThreads(): Promise<ThreadSummary[]> {
    return withLinkedInMessagingConnectedChrome(this.cdpUrl, async (page) => extractLinkedInThreads(page, this.accountId, this.credentials));
  }

  async getThreadMessages(threadId: string): Promise<MessageRecord[]> {
    return withLinkedInMessagingConnectedChrome(this.cdpUrl, async (page) => extractLinkedInMessages(page, threadId, 20000));
  }

  async sendMessage(threadId: string, message: string): Promise<{ sentAt: number }> {
    return withLinkedInMessagingConnectedChrome(this.cdpUrl, async (page) =>
      sendLinkedInMessage(page, this.accountId, threadId, message, 20000)
    );
  }
}

export class PersistentProfileMessagingProvider implements MessagingProvider {
  constructor(
    private readonly options: PersistentProfileOptions,
    private readonly accountId: string,
    private readonly credentials?: { username: string; password: string } | null
  ) {}

  async listThreads(): Promise<ThreadSummary[]> {
    return withLinkedInMessagingPersistentProfile(this.options, async (page) => extractLinkedInThreads(page, this.accountId, this.credentials));
  }

  async getThreadMessages(threadId: string): Promise<MessageRecord[]> {
    return withLinkedInMessagingPersistentProfile(this.options, async (page) => extractLinkedInMessages(page, threadId, 20000));
  }

  async sendMessage(threadId: string, message: string): Promise<{ sentAt: number }> {
    return withLinkedInMessagingPersistentProfile(this.options, async (page) =>
      sendLinkedInMessage(page, this.accountId, threadId, message, 20000)
    );
  }
}

export class DirectPersistentProfileMessagingProvider implements MessagingProvider {
  constructor(
    private readonly options: PersistentProfileOptions,
    private readonly accountId: string,
    private readonly credentials?: { username: string; password: string } | null
  ) {}

  async listThreads(): Promise<ThreadSummary[]> {
    return withLinkedInMessagingDirectPersistentProfile(this.options, async (page) =>
      extractLinkedInThreads(page, this.accountId, this.credentials)
    );
  }

  async getThreadMessages(threadId: string): Promise<MessageRecord[]> {
    return withLinkedInMessagingDirectPersistentProfile(this.options, async (page) =>
      extractLinkedInMessages(page, threadId, 20000)
    );
  }

  async sendMessage(threadId: string, message: string): Promise<{ sentAt: number }> {
    return withLinkedInMessagingDirectPersistentProfile(this.options, async (page) =>
      sendLinkedInMessage(page, this.accountId, threadId, message, 20000)
    );
  }
}

export class StrictDirectPersistentProfileMessagingProvider implements MessagingProvider {
  constructor(
    private readonly options: PersistentProfileOptions,
    private readonly accountId: string,
    private readonly credentials?: { username: string; password: string } | null
  ) {}

  async listThreads(): Promise<ThreadSummary[]> {
    return withLinkedInMessagingStrictDirectPersistentProfile(this.options, async (page) =>
      extractLinkedInThreads(page, this.accountId, this.credentials)
    );
  }

  async getThreadMessages(threadId: string): Promise<MessageRecord[]> {
    return withLinkedInMessagingStrictDirectPersistentProfile(this.options, async (page) =>
      extractLinkedInMessages(page, threadId, 20000)
    );
  }

  async sendMessage(threadId: string, message: string): Promise<{ sentAt: number }> {
    return withLinkedInMessagingStrictDirectPersistentProfile(this.options, async (page) =>
      sendLinkedInMessage(page, this.accountId, threadId, message, 20000)
    );
  }
}

const defaultImportFixture = parseThreadFixture(`
  <section
    data-thread-id="thread-import-001"
    data-title="${sampleContact.name}"
    data-participant="${sampleContact.name}"
    data-snippet="Checking in on the CRM rebuild"
    data-unread="1"
    data-last-message-at="1735689600000"
  >
    <article data-message-id="message-import-1" data-direction="inbound" data-sent-at="1735689500000">
      Checking in on the CRM rebuild.
    </article>
    <article data-message-id="message-import-2" data-direction="outbound" data-sent-at="1735689600000">
      Thanks, I have a local-first update ready.
    </article>
  </section>
`);

export async function runFakeImportThreads(payload: unknown) {
  const parsed = importThreadsPayloadSchema.parse(payload);
  const provider = new FakeMessagingProvider([defaultImportFixture]);
  const threads = await provider.listThreads();

  return importThreadsResultSchema.parse({
    provider: parsed.provider,
    accountId: parsed.accountId,
    itemsScanned: threads.length,
    itemsImported: threads.length,
    threadIds: threads.map((thread) => thread.id)
  });
}

async function resolveBrowserSyncProvider(payload: unknown, options: BrowserSyncOptions): Promise<BrowserSyncProviderResolution> {
  const parsed = importThreadsPayloadSchema.parse(payload);

  if (!options.enableRealBrowserSync) {
    throw new Error('Real browser sync is disabled. Enable ENABLE_REAL_BROWSER_SYNC to use session-backed sync.');
  }

  if (!options.sessionStore) {
    throw new Error('Real browser sync requires a session store.');
  }

  const session =
    (await options.sessionStore.load(parsed.accountId)) ??
    (await ensureLegacySession(parsed.accountId, options.sessionStore));

  const legacyConfig = await readLegacyEnvConfig();
  const cdpUrl = legacyConfig.cdpUrl?.trim() ?? '';
  const hasReachableCdp = cdpUrl ? await isChromeCdpReachable(cdpUrl) : false;

  if (hasReachableCdp) {
    const credentials = (legacyConfig.linkedinUsername && legacyConfig.linkedinPassword)
      ? { username: legacyConfig.linkedinUsername, password: legacyConfig.linkedinPassword }
      : null;
    return {
      provider: new CdpMessagingProvider(cdpUrl, parsed.accountId, credentials),
      providerKind: 'cdp'
    };
  }

  if (session && hasUsableLinkedInCookies(session)) {
    return {
      provider: new PlaywrightMessagingProvider(session),
      providerKind: 'saved-session'
    };
  }

  if (legacyConfig.userDataDir) {
    const normalizedProfile = normalizeChromeProfilePath(legacyConfig.userDataDir);
    const credentials = (legacyConfig.linkedinUsername && legacyConfig.linkedinPassword)
      ? { username: legacyConfig.linkedinUsername, password: legacyConfig.linkedinPassword }
      : null;
    const profileOptions = {
      proxyUrl: legacyConfig.proxyUrl,
      userDataDir: normalizedProfile.userDataDir,
      profileDirectory: normalizedProfile.profileDirectory,
      userAgent: session?.userAgent ?? getDefaultLinkedInUserAgent()
    };
    const strictDirectPersistentProfileProvider = new StrictDirectPersistentProfileMessagingProvider(
      profileOptions,
      parsed.accountId,
      credentials
    );
    const directPersistentProfileProvider = new DirectPersistentProfileMessagingProvider(
      profileOptions,
      parsed.accountId,
      credentials
    );
    const persistentProfileProvider = new PersistentProfileMessagingProvider(
      profileOptions,
      parsed.accountId,
      credentials
    );

    const tryCredentialBootstrapFallback = async (error: unknown) => {
      if (!isLinkedInLoginRedirectError(error)) {
        return null;
      }

      const bootstrappedSession = await loginAndSaveSession(parsed.accountId, options.sessionStore!, legacyConfig);
      if (!bootstrappedSession || !hasUsableLinkedInCookies(bootstrappedSession)) {
        return null;
      }

      return {
        provider: new PlaywrightMessagingProvider(bootstrappedSession),
        providerKind: 'credential-bootstrap',
        fallbackReason:
          `Persistent profile redirected to LinkedIn login for account ${parsed.accountId}. ` +
          'A fresh saved session was created from configured LinkedIn credentials and selected as fallback.'
      } satisfies BrowserSyncProviderResolution;
    };

    try {
      await strictDirectPersistentProfileProvider.listThreads();
      return {
        provider: strictDirectPersistentProfileProvider,
        providerKind: 'direct-profile',
        fallbackReason: 'Using direct persistent Chrome profile reuse for LinkedIn sync.'
      };
    } catch (error) {
      const credentialBootstrapFallback = await tryCredentialBootstrapFallback(error);
      if (credentialBootstrapFallback) {
        return credentialBootstrapFallback;
      }

      debugLog('strict direct persistent profile probe failed', error);
    }

    try {
      await persistentProfileProvider.listThreads();
      return {
        provider: persistentProfileProvider,
        providerKind: 'persistent-profile'
      };
    } catch (error) {
      const credentialBootstrapFallback = await tryCredentialBootstrapFallback(error);
      if (credentialBootstrapFallback) {
        return credentialBootstrapFallback;
      }

      throw error;
    }
  }

  if (session && hasUsableLinkedInCookies(session)) {
    return {
      provider: new PlaywrightMessagingProvider(session),
      providerKind: 'saved-session'
    };
  }

  throw new Error(
    `No reusable LinkedIn browser session found for account ${parsed.accountId}. Configure CHROME_CDP_URL for an authenticated Chrome session, provide USER_DATA_DIR for a reusable profile, or import a saved LinkedIn cookie session.`
  );
}

export async function createBrowserSyncProvider(payload: unknown, options: BrowserSyncOptions): Promise<MessagingProvider> {
  const resolution = await resolveBrowserSyncProvider(payload, options);

  if (resolution.fallbackReason) {
    debugLog(resolution.fallbackReason);
  }

  return resolution.provider;
}

export async function inspectBrowserSyncProvider(payload: unknown, options: BrowserSyncOptions) {
  const resolution = await resolveBrowserSyncProvider(payload, options);

  return {
    providerKind: resolution.providerKind,
    fallbackReason: resolution.fallbackReason ?? null
  };
}

export function selectThreadsForImport(threads: ThreadSummary[]) {
  return threads.slice(0, 10);
}

export async function runImportThreads(payload: unknown, options: BrowserSyncOptions) {
  if (!options.enableRealBrowserSync) {
    return runFakeImportThreads(payload);
  }

  const parsed = importThreadsPayloadSchema.parse(payload);
  const provider = await createBrowserSyncProvider(parsed, options);
  const threads = selectThreadsForImport(await provider.listThreads());

  let itemsImported = threads.length;
  let messagesImported = 0;

  if (options.db && options.sqlite) {
    const repository = createMutationRepository(options.db, options.sqlite);
    const hydratedThreads = await Promise.all(
      threads.map(async (thread) => ({
        ...thread,
        messages: await provider.getThreadMessages(thread.id)
      }))
    );
    const persisted = await repository.importLinkedinThreads({
      accountId: parsed.accountId,
      threads: hydratedThreads.map((thread) => ({
        id: thread.id,
        title: thread.title,
        participantName: thread.participantName,
        company: thread.company ?? null,
        headline: thread.headline ?? null,
        snippet: thread.snippet,
        unreadCount: thread.unreadCount,
        lastMessageAt: thread.lastMessageAt,
        messages: thread.messages.map((message) => ({
          id: message.id,
          direction: message.direction,
          body: message.body,
          sentAt: message.sentAt
        }))
      }))
    });
    itemsImported = persisted.importedThreads;
    messagesImported = persisted.importedMessages;
  }

  return importThreadsResultSchema.parse({
    provider: parsed.provider,
    accountId: parsed.accountId,
    itemsScanned: threads.length,
    itemsImported,
    messagesImported,
    threadIds: threads.map((thread) => thread.id)
  });
}

export async function sendBrowserMessage(payload: unknown, options: BrowserSyncOptions) {
  const parsed = sendMessagePayloadSchema.parse(payload);

  if (!options.enableRealSend) {
    throw new Error('Real send is disabled. Enable ENABLE_REAL_SEND to use browser-backed sending.');
  }

  if (parsed.provider === 'fake-linkedin') {
    const provider = new FakeMessagingProvider([defaultImportFixture]);
    const result = await provider.sendMessage?.(parsed.conversationId, parsed.messageText);

    return sendMessageResultSchema.parse({
      provider: parsed.provider,
      accountId: parsed.accountId,
      draftId: parsed.draftId,
      conversationId: parsed.conversationId,
      sentAt: result?.sentAt ?? Date.now()
    });
  }

  const provider = await createBrowserSyncProvider(
    {
      provider: parsed.provider,
      accountId: parsed.accountId
    },
    {
      enableRealBrowserSync: options.enableRealBrowserSync,
      sessionStore: options.sessionStore
    }
  );

  if (!provider.sendMessage) {
    throw new Error(`Messaging provider does not support send for account ${parsed.accountId}.`);
  }

  const result = await provider.sendMessage(parsed.conversationId, parsed.messageText);

  return sendMessageResultSchema.parse({
    provider: parsed.provider,
    accountId: parsed.accountId,
    draftId: parsed.draftId,
    conversationId: parsed.conversationId,
    sentAt: result.sentAt
  });
}
