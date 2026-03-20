import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { inspectBrowserSyncProvider, selectThreadsForImport } from './index';
import * as automationModule from './index';
import * as authConfigModule from './auth-config';

describe('selectThreadsForImport', () => {
	it('preserves provider order when selecting the first 10 chats', async () => {
		const selected = selectThreadsForImport(
			Array.from({ length: 12 }, (_, index) => ({
				id: `thread-${index + 1}`,
				title: `Thread ${index + 1}`,
				participantName: `Participant ${index + 1}`,
				snippet: `Snippet ${index + 1}`,
				unreadCount: 0,
				lastMessageAt: 12 - index
			}))
		);

		expect(selected.map((thread) => thread.id)).toEqual([
			'thread-1',
			'thread-2',
			'thread-3',
			'thread-4',
			'thread-5',
			'thread-6',
			'thread-7',
			'thread-8',
			'thread-9',
			'thread-10'
		]);
	});
});

describe('inspectBrowserSyncProvider', () => {
	const sessionStore = {
		load: vi.fn(),
		save: vi.fn()
	};

	beforeEach(() => {
		vi.restoreAllMocks();
		sessionStore.load.mockReset();
		sessionStore.save.mockReset();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('prefers reachable CDP over a saved session', async () => {
		sessionStore.load.mockResolvedValue({
			accountId: 'account-1',
			cookiesJson: JSON.stringify([{ name: 'li_at', value: 'cookie', domain: '.linkedin.com' }]),
			userAgent: 'ua',
			capturedAt: Date.now()
		});

		vi.spyOn(authConfigModule, 'readLegacyEnvConfig').mockResolvedValue({
			userDataDir: null,
			proxyUrl: null,
			cdpUrl: 'http://127.0.0.1:9222',
			linkedinUsername: null,
			linkedinPassword: null
		});
		vi.spyOn(authConfigModule, 'isChromeCdpReachable').mockResolvedValue(true);

		const result = await inspectBrowserSyncProvider(
			{
				provider: 'linkedin-browser',
				accountId: 'account-1'
			},
			{
				enableRealBrowserSync: true,
				sessionStore
			}
		);

		expect(result).toEqual({
			providerKind: 'cdp',
			fallbackReason: null
		});
	});

	it('falls back to a saved session when CDP is unreachable', async () => {
		sessionStore.load.mockResolvedValue({
			accountId: 'account-1',
			cookiesJson: JSON.stringify([{ name: 'li_at', value: 'cookie', domain: '.linkedin.com' }]),
			userAgent: 'ua',
			capturedAt: Date.now()
		});

		vi.spyOn(authConfigModule, 'readLegacyEnvConfig').mockResolvedValue({
			userDataDir: null,
			proxyUrl: null,
			cdpUrl: 'http://127.0.0.1:9222',
			linkedinUsername: null,
			linkedinPassword: null
		});
		vi.spyOn(authConfigModule, 'isChromeCdpReachable').mockResolvedValue(false);

		const result = await inspectBrowserSyncProvider(
			{
				provider: 'linkedin-browser',
				accountId: 'account-1'
			},
			{
				enableRealBrowserSync: true,
				sessionStore
			}
		);

		expect(result).toEqual({
			providerKind: 'saved-session',
			fallbackReason: null
		});
	});
});
