import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '@mycrm/core';

const getContactConversationDetails = vi.fn();

vi.mock('@/lib/services/inbox-service', () => ({
  getContactConversationDetails
}));

describe('GET /api/contacts/[contactId]', () => {
  it('returns contact details', async () => {
    getContactConversationDetails.mockResolvedValueOnce({ contact: { id: 'contact-001' } });
    const { GET } = await import('./route');

    const response = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ contactId: 'contact-001' })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ contact: { id: 'contact-001' } });
  });

  it('maps service errors to HTTP status', async () => {
    getContactConversationDetails.mockRejectedValueOnce(new NotFoundError('missing'));
    const { GET } = await import('./route');

    const response = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ contactId: 'missing' })
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
  });
});