export interface DraftRequest {
  contactId: string;
  conversationId: string;
  goal: string;
  contactName: string;
  company?: string | null;
  relationshipStatus?: string;
  recentMessages?: string[];
}

export interface DraftVariant {
  id?: string;
  text: string;
  score?: number | null;
}

export interface PromptBuilder {
  buildDraftRequest(input: DraftRequest): DraftRequest;
}

export interface AiAdapter {
  generateDrafts(input: DraftRequest): Promise<DraftVariant[]>;
}

export class DefaultPromptBuilder implements PromptBuilder {
  buildDraftRequest(input: DraftRequest): DraftRequest {
    return {
      ...input,
      recentMessages: input.recentMessages?.slice(0, 3) ?? []
    };
  }
}

export class MockGeminiAdapter implements AiAdapter {
  async generateDrafts(input: DraftRequest): Promise<DraftVariant[]> {
    return [
      {
        id: 'variant-1',
        text: `Hi ${input.contactName}, following up on ${input.goal}.`,
        score: 92
      },
      {
        id: 'variant-2',
        text: `Hello ${input.contactName}, wanted to revisit ${input.goal}.`,
        score: 88
      }
    ];
  }
}

export function createAiAdapter() {
  return new MockGeminiAdapter();
}

export function createPromptBuilder() {
  return new DefaultPromptBuilder();
}
