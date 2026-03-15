import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '@mycrm/core';

const getAccountDetails = vi.fn();

vi.mock('@/lib/services/accounts-service', () => ({
  getAccountDetails
}));

describe('account detail route', () => {
  it('returns account details', async () => {
    getAccountDetails.mockResolvedValueOnce({ account: { id: 'account-001' }, contacts: [] });
    const { GET } = await import('./route');

    const response = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ accountId: 'account-001' })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.account.id).toBe('account-001');
  });

  it('maps not found errors', async () => {
    getAccountDetails.mockRejectedValueOnce(new NotFoundError('missing'));
    const { GET } = await import('./route');

    const response = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ accountId: 'missing' })
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
  });
});