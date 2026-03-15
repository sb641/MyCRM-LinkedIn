import { describe, expect, it, vi } from 'vitest';

const assignContactsToAccount = vi.fn();

vi.mock('@/lib/services/accounts-service', () => ({
  assignContactsToAccount
}));

describe('account contacts route', () => {
  it('assigns contacts to an account', async () => {
    assignContactsToAccount.mockResolvedValueOnce({ account: { id: 'account-001' }, contacts: [{ id: 'contact-001' }] });
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ contactIds: ['contact-001'] }),
        headers: { 'Content-Type': 'application/json' }
      }),
      {
        params: Promise.resolve({ accountId: 'account-001' })
      }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.contacts[0].id).toBe('contact-001');
  });
});