import { describe, expect, it, vi } from 'vitest';

const listInboxItems = vi.fn();

vi.mock('@/lib/services/inbox-service', () => ({
  listInboxItems
}));

describe('GET /api/inbox', () => {
  it('returns inbox items', async () => {
    listInboxItems.mockResolvedValueOnce([{ contactId: 'contact-001' }]);
    const { GET } = await import('./route');

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ items: [{ contactId: 'contact-001' }] });
  });
});