import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '@mycrm/core';

const updateContactRelationshipStatus = vi.fn();

vi.mock('@/lib/services/crm-service', () => ({
  updateContactRelationshipStatus
}));

describe('PATCH /api/contacts/[contactId]/status', () => {
  it('updates relationship status', async () => {
    updateContactRelationshipStatus.mockResolvedValueOnce({ success: true });
    const { PATCH } = await import('./route');

    const response = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ relationshipStatus: 'archived' })
      }),
      { params: Promise.resolve({ contactId: 'contact-001' }) }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });

  it('maps validation errors', async () => {
    updateContactRelationshipStatus.mockRejectedValueOnce(new ValidationError('bad payload'));
    const { PATCH } = await import('./route');

    const response = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ relationshipStatus: 'bad' })
      }),
      { params: Promise.resolve({ contactId: 'contact-001' }) }
    );

    expect(response.status).toBe(400);
  });
});