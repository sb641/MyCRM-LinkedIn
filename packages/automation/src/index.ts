import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { chromium } from '@playwright/test';

import { sampleContact } from '@mycrm/test-fixtures';
import {
  importThreadsPayloadSchema,
  importThreadsResultSchema,
  sendMessagePayloadSchema,
  sendMessageResultSchema
} from '@mycrm/core';

export interface ThreadSummary {
  id: string;
  title: string;
  participantName: string;
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

export interface SessionState {
  accountId: string;
  cookiesJson: string;
  userAgent: string;
  capturedAt: number;
}

export interface SessionStore {
  load(accountId: string): Promise<SessionState | null>;
  save(session: SessionState): Promise<void>;
}

type LegacyEnvConfig = {
  userDataDir: string | null;
  proxyUrl: string | null;
  cdpUrl: string | null;
  linkedinUsername: string | null;
  linkedinPassword: string | null;
};

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
};

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, SessionState>();

  async load(accountId: string): Promise<SessionState | null> {
    return this.sessions.get(accountId) ?? null;
  }

  async save(session: SessionState): Promise<void> {
    this.sessions.set(session.accountId, session);
  }
}

export class FileSessionStore implements SessionStore {
  constructor(private readonly rootDir: string) {}

  private getSessionPath(accountId: string) {
    const safeAccountId = accountId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.rootDir, `${safeAccountId}.json`);
  }

  async load(accountId: string): Promise<SessionState | null> {
    try {
      const raw = await fs.readFile(this.getSessionPath(accountId), 'utf8');
      return JSON.parse(raw) as SessionState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  async save(session: SessionState): Promise<void> {
    await fs.mkdir(this.rootDir, { recursive: true });
    await fs.writeFile(this.getSessionPath(session.accountId), JSON.stringify(session, null, 2), 'utf8');
  }
}

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

export function createFileSessionStore(rootDir?: string) {
  if (rootDir) {
    return new FileSessionStore(rootDir);
  }

  const fallbackRoot = path.resolve(process.cwd(), '.mycrm', 'sessions');
  const store = new FileSessionStore(fallbackRoot);

  return {
    load: async (accountId: string) => {
      const workspaceRoot = await resolveWorkspaceRoot();
      const workspaceStore = new FileSessionStore(path.resolve(workspaceRoot, '.mycrm', 'sessions'));
      return workspaceStore.load(accountId);
    },
    save: async (session: SessionState) => {
      const workspaceRoot = await resolveWorkspaceRoot();
      const workspaceStore = new FileSessionStore(path.resolve(workspaceRoot, '.mycrm', 'sessions'));
      await workspaceStore.save(session);
    }
  } satisfies SessionStore;
}

async function readLegacyEnvConfig(projectRoot = process.cwd()): Promise<LegacyEnvConfig> {
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
      userDataDir: values.get('USER_DATA_DIR') ?? null,
      proxyUrl: values.get('PROXY_URL') ?? null,
      cdpUrl: values.get('CHROME_CDP_URL') ?? null,
      linkedinUsername: values.get('LINKEDIN_USERNAME') ?? null,
      linkedinPassword: values.get('LINKEDIN_PASSWORD') ?? null
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        userDataDir: null,
        proxyUrl: null,
        cdpUrl: null,
        linkedinUsername: null,
        linkedinPassword: null
      };
    }

    throw error;
  }
}

async function createLegacyImportedCookies(userDataDir: string) {
  const cookiesPath = path.resolve(userDataDir, 'Network', 'Cookies');
  await fs.access(cookiesPath);

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

async function copyDirectorySkippingBusyFiles(sourceDir: string, targetDir: string) {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
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
      if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES') {
        continue;
      }

      throw error;
    }
  }
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
  const session: SessionState = {
    accountId,
    cookiesJson,
    userAgent: getDefaultLinkedInUserAgent(),
    capturedAt: Date.now()
  };

  await sessionStore.save(session);
  return session;
}

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
  profileDirectory: string;
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
    // Don't close the user's browser; just disconnect the Playwright client.
    await browser.close();
  }
}

async function withLinkedInMessagingPersistentProfile<T>(
  options: PersistentProfileOptions,
  callback: (page: import('@playwright/test').Page) => Promise<T>
) {
  const tempUserDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mycrm-linkedin-profile-'));
  const sourceProfileDir = path.join(options.userDataDir, options.profileDirectory);
  const targetProfileDir = path.join(tempUserDataDir, options.profileDirectory);

  await copyDirectorySkippingBusyFiles(sourceProfileDir, targetProfileDir);

  const context = await chromium.launchPersistentContext(tempUserDataDir, {
    channel: 'chrome',
    headless: false,
    proxy: options.proxyUrl ? { server: options.proxyUrl } : undefined,
    userAgent: options.userAgent,
    args: [`--profile-directory=${options.profileDirectory}`]
  });

  try {
    const existingPage = context.pages()[0];
    const page = existingPage ?? (await context.newPage());
    return await callback(page);
  } finally {
    await context.close();
    await fs.rm(tempUserDataDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

const DEBUG_LINKEDIN = process.env.LINKEDIN_DEBUG === '1';

function debugLog(...args: Array<unknown>) {
  if (!DEBUG_LINKEDIN) return;
  // eslint-disable-next-line no-console
  console.log('[linkedIn-debug]', ...args);
}

async function extractLinkedInThreads(page: import('@playwright/test').Page, accountId: string): Promise<ThreadSummary[]> {
  await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);

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
        '[data-control-name*="conversation"], [data-control-name*="thread"], li.msg-conversation-listitem, li.msg-conversations-container__convo-item'
      )
    );

    const unique = new Map<string, {
      id: string;
      title: string;
      participantName: string;
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

      const title =
        element.querySelector<HTMLElement>('.msg-conversation-listitem__participant-names, .msg-conversation-card__participant-names, .t-14.t-black.t-bold')
          ?.innerText?.trim() ??
        element.getAttribute('aria-label')?.trim() ??
        '';
      const snippet =
        element.querySelector<HTMLElement>('.msg-conversation-listitem__message-snippet, .msg-conversation-card__message-snippet, .t-12.t-black--light')
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
        snippet,
        unreadCount,
        lastMessageAt: Date.now()
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
  await page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => undefined);

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
  await page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => undefined);

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
    page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => undefined)
  ]);

  return { sentAt: Date.now() };
}

class CdpMessagingProvider implements MessagingProvider {
  constructor(private readonly cdpUrl: string, private readonly accountId: string) {}

  async listThreads(): Promise<ThreadSummary[]> {
    return withLinkedInMessagingConnectedChrome(this.cdpUrl, async (page) => extractLinkedInThreads(page, this.accountId));
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
  constructor(private readonly options: PersistentProfileOptions, private readonly accountId: string) {}

  async listThreads(): Promise<ThreadSummary[]> {
    return withLinkedInMessagingPersistentProfile(this.options, async (page) => extractLinkedInThreads(page, this.accountId));
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

export async function createBrowserSyncProvider(payload: unknown, options: BrowserSyncOptions): Promise<MessagingProvider> {
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

  if (legacyConfig.cdpUrl) {
    return new CdpMessagingProvider(legacyConfig.cdpUrl, parsed.accountId);
  }

  if (legacyConfig.userDataDir) {
    const normalizedProfile = normalizeChromeProfilePath(legacyConfig.userDataDir);
    return new PersistentProfileMessagingProvider(
      {
        proxyUrl: legacyConfig.proxyUrl,
        userDataDir: normalizedProfile.userDataDir,
        profileDirectory: normalizedProfile.profileDirectory,
        userAgent: session?.userAgent ?? getDefaultLinkedInUserAgent()
      },
      parsed.accountId
    );
  }

  if (session && hasUsableLinkedInCookies(session)) {
    return new PlaywrightMessagingProvider(session);
  }

  throw new Error(
    `No reusable LinkedIn browser session found for account ${parsed.accountId}. Configure CHROME_CDP_URL for an authenticated Chrome session, provide USER_DATA_DIR for a reusable profile, or import a saved LinkedIn cookie session.`
  );
}

export async function runImportThreads(payload: unknown, options: BrowserSyncOptions) {
  if (!options.enableRealBrowserSync) {
    return runFakeImportThreads(payload);
  }

  const parsed = importThreadsPayloadSchema.parse(payload);
  const provider = await createBrowserSyncProvider(parsed, options);
  const threads = await provider.listThreads();

  return importThreadsResultSchema.parse({
    provider: parsed.provider,
    accountId: parsed.accountId,
    itemsScanned: threads.length,
    itemsImported: threads.length,
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
