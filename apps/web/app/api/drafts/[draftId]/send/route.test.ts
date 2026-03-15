import { describe, expect, it, vi } from 'vitest';
import { NotFoundError, ValidationError } from '@mycrm/core';

const queueApprovedDraftSend = vi.fn();

vi.mock('@/lib/services/crm-service', () => ({
  queueApprovedDraftSend
}));

describe('POST /api/drafts/[draftId]/send', () => {
  it('queues an approved draft for send', async () => {
    queueApprovedDraftSend.mockResolvedValueOnce({ success: true, jobId: 'job-123' });
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'conversation-001',
          accountId: 'local-account',
          provider: 'linkedin-browser'
        })
      }),
      { params: Promise.resolve({ draftId: 'draft-001' }) }
    );

    expect(response.status).toBe(200);
    expect(queueApprovedDraftSend).toHaveBeenCalledWith({
      draftId: 'draft-001',
      conversationId: 'conversation-001',
      accountId: 'local-account',
      provider: 'linkedin-browser'
    });
    expect(await response.json()).toEqual({ success: true, jobId: 'job-123' });
  });

  it('uses the route draft id when the request body omits it', async () => {
    queueApprovedDraftSend.mockResolvedValueOnce({ success: true, jobId: 'job-456' });
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'conversation-003',
          accountId: 'local-account',
          provider: 'linkedin-browser'
        })
      }),
      { params: Promise.resolve({ draftId: 'draft-003' }) }
    );

    expect(response.status).toBe(200);
    expect(queueApprovedDraftSend).toHaveBeenCalledWith({
      draftId: 'draft-003',
      conversationId: 'conversation-003',
      accountId: 'local-account',
      provider: 'linkedin-browser'
    });
  });

  it('maps not found errors', async () => {
    queueApprovedDraftSend.mockRejectedValueOnce(new NotFoundError('missing'));
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'conversation-001',
          accountId: 'local-account',
          provider: 'linkedin-browser'
        })
      }),
      { params: Promise.resolve({ draftId: 'missing' }) }
    );

    expect(response.status).toBe(404);
  });

  it('maps validation errors', async () => {
    queueApprovedDraftSend.mockRejectedValueOnce(new ValidationError('invalid payload', { field: 'provider' }));
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'conversation-001',
          accountId: 'local-account',
          provider: 'linkedin-browser'
        })
      }),
      { params: Promise.resolve({ draftId: 'draft-001' }) }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      message: 'invalid payload',
      details: { field: 'provider' }
    });
  });
});