import { describe, expect, it, vi } from 'vitest';

const generateDraftsBulk = vi.fn();

vi.mock('@/lib/services/crm-service', () => ({
  generateDraftsBulk
}));

describe('POST /api/drafts/bulk-generate', () => {
  it('returns generated drafts for multiple selections', async () => {
    generateDraftsBulk.mockResolvedValueOnce({
      requestedCount: 2,
      generatedCount: 2,
      goal: 'Book meetings',
      options: {
        includeLink: 'https://example.com',
        callToAction: 'Reply with a time',
        tone: 'Direct',
        constraints: 'Keep it short',
        useRecentConversationContext: true,
        useAccountContext: true,
        varyMessageByRole: true,
        avoidRepeatingAngleWithinAccount: true
      },
      drafts: [
        {
          contactId: 'contact-001',
          conversationId: 'conversation-001',
          draft: {
            draftId: 'draft-generated-1',
            contactId: 'contact-001',
            conversationId: 'conversation-001',
            goalText: 'Book meetings',
            draftStatus: 'generated',
            modelName: 'mock-gemini',
            variants: [{ id: 'variant-1', text: 'Hello', selected: true, score: 90 }]
          }
        }
      ]
    });

    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          selections: [
            { contactId: 'contact-001', conversationId: 'conversation-001' },
            { contactId: 'contact-002', conversationId: 'conversation-002' }
          ],
          goal: 'Book meetings',
          options: {
            includeLink: 'https://example.com',
            callToAction: 'Reply with a time',
            tone: 'Direct',
            constraints: 'Keep it short',
            useRecentConversationContext: true,
            useAccountContext: true,
            varyMessageByRole: true,
            avoidRepeatingAngleWithinAccount: true
          }
        })
      })
    );

    expect(response.status).toBe(200);
    expect((await response.json()).requestedCount).toBe(2);
  });

  it('returns 400 when the bulk draft payload is invalid', async () => {
    generateDraftsBulk.mockRejectedValueOnce(new Error('Invalid bulk draft generation payload'));

    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ goal: '' })
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: 'Invalid bulk draft generation payload' });
  });

  it('returns 400 when bulk draft generation fails unexpectedly', async () => {
    generateDraftsBulk.mockRejectedValueOnce(new Error('AI provider unavailable'));

    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          selections: [{ contactId: 'contact-001', conversationId: 'conversation-001' }],
          goal: 'Book meetings',
          options: {
            includeLink: 'https://example.com',
            callToAction: 'Reply with a time',
            tone: 'Direct',
            constraints: 'Keep it short',
            useRecentConversationContext: true,
            useAccountContext: true,
            varyMessageByRole: true,
            avoidRepeatingAngleWithinAccount: true
          }
        })
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: 'AI provider unavailable' });
  });
});
