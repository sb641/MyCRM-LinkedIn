import { describe, expect, it, vi } from 'vitest';

const createAccount = vi.fn();
const listAccounts = vi.fn();

vi.mock('@/lib/services/accounts-service', () => ({
  createAccount,
  listAccounts
}));

describe('accounts collection route', () => {
  it('returns accounts', async () => {
    listAccounts.mockResolvedValueOnce([{ id: 'account-001' }]);
    const { GET } = await import('./route');

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ accounts: [{ id: 'account-001' }] });
  });

  it('creates an account', async () => {
    createAccount.mockResolvedValueOnce({ account: { id: 'account-001' }, contacts: [] });
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/accounts', {
        method: 'POST',
        body: JSON.stringify({ name: 'Acme' }),
        headers: { 'Content-Type': 'application/json' }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.account.id).toBe('account-001');
  });
});