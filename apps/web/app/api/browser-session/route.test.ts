import { describe, expect, it, vi } from 'vitest';

const getBrowserSession = vi.fn();
const saveBrowserSession = vi.fn();

vi.mock('@/lib/services/browser-session-service', () => ({
  getBrowserSession,
  saveBrowserSession
}));

describe('/api/browser-session', () => {
  it('returns a saved browser session by account id', async () => {
    getBrowserSession.mockResolvedValueOnce({
      accountId: 'browser-account',
      cookiesJson: '[]',
      userAgent: 'test-agent',
      capturedAt: 1735689600000
    });

    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/browser-session?accountId=browser-account'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.session.accountId).toBe('browser-account');
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
});