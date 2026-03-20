import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@mycrm/core';

const getBrowserSession = vi.fn();
const saveBrowserSession = vi.fn();
const bootstrapBrowserSession = vi.fn();
const getManualBrowserSyncReadiness = vi.fn();

vi.mock('@/lib/services/browser-session-service', () => ({
  getBrowserSession,
  saveBrowserSession
}));

vi.mock('@/app/api/browser-session/bootstrap-service', () => ({
  bootstrapBrowserSession
}));

vi.mock('@/lib/services/jobs-service', () => ({
  getManualBrowserSyncReadiness
}));

describe('/api/browser-session', () => {
  it('returns a saved browser session by account id', async () => {
    getBrowserSession.mockResolvedValueOnce({
      accountId: 'browser-account',
      cookiesJson: '[]',
      userAgent: 'test-agent',
      capturedAt: 1735689600000
    });
    getManualBrowserSyncReadiness.mockResolvedValueOnce({
      accountId: 'browser-account',
      ready: true,
      reason: 'session_available',
      message: 'Saved LinkedIn session found.',
      checks: {
        enableRealBrowserSync: true,
        hasCdpUrl: false,
        cdpReachable: false,
        hasUserDataDir: false,
        hasSavedSession: true,
        hasLinkedinCredentials: false
      }
    });

    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/browser-session?accountId=browser-account'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.session.accountId).toBe('browser-account');
    expect(body.readiness.reason).toBe('session_available');
  });

  it('rejects missing account id on GET', async () => {
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/browser-session'));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ message: 'accountId is required' });
  });

  it('saves a browser session payload', async () => {
    saveBrowserSession.mockResolvedValueOnce({
      accountId: 'browser-account',
      capturedAt: 1735689600000
    });

    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/browser-session', {
        method: 'POST',
        body: JSON.stringify({
          accountId: 'browser-account',
          cookiesJson: '[]',
          userAgent: 'test-agent',
          capturedAt: 1735689600000
        })
      })
    );

    expect(response.status).toBe(201);
    expect(saveBrowserSession).toHaveBeenCalledWith({
      accountId: 'browser-account',
      cookiesJson: '[]',
      userAgent: 'test-agent',
      capturedAt: 1735689600000
    });
  });

  it('bootstraps a browser session from LinkedIn credentials', async () => {
    bootstrapBrowserSession.mockResolvedValueOnce({
      accountId: 'browser-account',
      capturedAt: 1735689600000,
      userAgent: 'test-agent',
      readiness: {
        accountId: 'browser-account',
        ready: true,
        reason: 'session_available',
        message: 'Saved LinkedIn session found.',
        checks: {
          enableRealBrowserSync: true,
          hasCdpUrl: false,
          cdpReachable: false,
          hasUserDataDir: false,
          hasSavedSession: true,
          hasLinkedinCredentials: true
        }
      }
    });

    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/browser-session?mode=bootstrap', {
        method: 'POST',
        body: JSON.stringify({ accountId: 'browser-account' })
      })
    );

    expect(response.status).toBe(201);
    expect(bootstrapBrowserSession).toHaveBeenCalledWith('browser-account');
  });

  it('returns an actionable bootstrap error when credentials are missing', async () => {
    bootstrapBrowserSession.mockRejectedValueOnce(
      new AppError('LinkedIn credential bootstrap is not configured.', {
        code: 'BROWSER_SESSION_BOOTSTRAP_NOT_CONFIGURED',
        status: 400,
        details: {
          accountId: 'browser-account',
          hasLinkedinUsername: false,
          hasLinkedinPassword: false
        }
      })
    );

    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/browser-session?mode=bootstrap', {
        method: 'POST',
        body: JSON.stringify({ accountId: 'browser-account' })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      code: 'BROWSER_SESSION_BOOTSTRAP_NOT_CONFIGURED',
      message: 'LinkedIn credential bootstrap is not configured.'
    });
  });
});