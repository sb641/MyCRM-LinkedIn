import { describe, expect, it, vi } from 'vitest';

const generateDraft = vi.fn();

vi.mock('@/lib/services/crm-service', () => ({
  generateDraft
}));

describe('POST /api/drafts/generate', () => {
  it('returns generated draft variants', async () => {
    generateDraft.mockResolvedValueOnce({
      draftId: 'draft-generated-1',
      contactId: 'contact-001',
      conversationId: 'conversation-001',
      goalText: 'Follow up',
      draftStatus: 'generated',
      modelName: 'mock-gemini',
      variants: [{ id: 'variant-1', text: 'Hello', selected: true, score: 90 }]
    });

    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          contactId: 'contact-001',
          conversationId: 'conversation-001',
          goal: 'Follow up'
        })
      })
    );

    expect(response.status).toBe(200);
    expect((await response.json()).draftId).toBe('draft-generated-1');
  });
});