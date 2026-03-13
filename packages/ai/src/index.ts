export interface DraftRequest {
  goal: string;
  contactName: string;
}

export interface DraftVariant {
  text: string;
}

export interface AiAdapter {
  generateDrafts(input: DraftRequest): Promise<DraftVariant[]>;
}

export class MockGeminiAdapter implements AiAdapter {
  async generateDrafts(input: DraftRequest): Promise<DraftVariant[]> {
    return [
      { text: `Hi ${input.contactName}, following up on ${input.goal}.` },
      { text: `Hello ${input.contactName}, wanted to revisit ${input.goal}.` }
    ];
  }
}
