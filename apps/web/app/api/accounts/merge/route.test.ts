import { describe, expect, it, vi } from 'vitest';

const mergeAccounts = vi.fn();

vi.mock('@/lib/services/accounts-service', () => ({
  mergeAccounts
}));

describe('account merge route', () => {
  it('merges accounts', async () => {
    mergeAccounts.mockResolvedValueOnce({ account: { id: 'account-target' }, contacts: [] });
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ sourceAccountId: 'account-source', targetAccountId: 'account-target' }),
        headers: { 'Content-Type': 'application/json' }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.account.id).toBe('account-target');
  });
});