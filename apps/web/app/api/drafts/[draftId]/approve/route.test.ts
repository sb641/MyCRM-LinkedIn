import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '@mycrm/core';

const approveDraft = vi.fn();

vi.mock('@/lib/services/crm-service', () => ({
  approveDraft
}));

describe('POST /api/drafts/[draftId]/approve', () => {
  it('approves a draft', async () => {
    approveDraft.mockResolvedValueOnce({ success: true });
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ approvedText: 'Approved', sendStatus: 'queued' })
      }),
      { params: Promise.resolve({ draftId: 'draft-001' }) }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });

  it('maps not found errors', async () => {
    approveDraft.mockRejectedValueOnce(new NotFoundError('missing'));
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ approvedText: 'Approved', sendStatus: 'idle' })
      }),
      { params: Promise.resolve({ draftId: 'missing' }) }
    );

    expect(response.status).toBe(404);
  });
});