import {
  approveDraftInputSchema,
  type DraftSummaryDto,
  generateDraftInputSchema,
  type GeneratedDraftResultDto,
  generatedDraftResultSchema,
  mutationResultSchema,
  NotFoundError,
  updateRelationshipStatusInputSchema,
  ValidationError
} from '@mycrm/core';
import { createAiAdapter, createPromptBuilder } from '@mycrm/ai';
import { createDb, createMutationRepository } from '@mycrm/db';

export async function updateContactRelationshipStatus(
  contactId: string,
  input: unknown,
  databaseUrl?: string
) {
  const parsed = updateRelationshipStatusInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid relationship status payload', parsed.error.flatten());
  }

  const { db, sqlite } = await createDb(databaseUrl);

  try {
    const repository = createMutationRepository(db, sqlite);
    const updated = await repository.updateRelationshipStatus(contactId, parsed.data.relationshipStatus);

    if (updated === 0) {
      throw new NotFoundError(`Contact ${contactId} was not found`, { contactId });
    }

    return mutationResultSchema.parse({ success: true });
  } finally {
    await sqlite.close();
  }
}

export async function approveDraft(draftId: string, input: unknown, databaseUrl?: string) {
  const parsed = approveDraftInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid draft approval payload', parsed.error.flatten());
  }

  const { db, sqlite } = await createDb(databaseUrl);

  try {
    const repository = createMutationRepository(db, sqlite);
    const updated = await repository.approveDraft(draftId, parsed.data.approvedText, parsed.data.sendStatus);

    if (updated === 0) {
      throw new NotFoundError(`Draft ${draftId} was not found`, { draftId });
    }

    return mutationResultSchema.parse({ success: true });
  } finally {
    await sqlite.close();
  }
}

export async function generateDraft(input: unknown, databaseUrl?: string): Promise<GeneratedDraftResultDto> {
  const parsed = generateDraftInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid draft generation payload', parsed.error.flatten());
  }

  const { db, sqlite } = await createDb(databaseUrl);

  try {
    const repository = createMutationRepository(db, sqlite);
    const promptBuilder = createPromptBuilder();
    const aiAdapter = createAiAdapter();

    const prompt = promptBuilder.buildDraftRequest({
      contactId: parsed.data.contactId,
      conversationId: parsed.data.conversationId,
      goal: parsed.data.goal,
      contactName: `Contact ${parsed.data.contactId}`
    });

    const variants = await aiAdapter.generateDrafts(prompt);
    const draftId = `draft-generated-${Date.now()}`;
    const saved = await repository.createGeneratedDraft({
      draftId,
      contactId: parsed.data.contactId,
      conversationId: parsed.data.conversationId,
      goalText: parsed.data.goal,
      modelName: 'mock-gemini',
      variants: variants.map((variant: { id?: string; text: string; score?: number | null }, index: number) => ({
        id: variant.id ?? `${draftId}-variant-${index + 1}`,
        text: variant.text,
        selected: index === 0,
        score: variant.score ?? null
      }))
    });

    if (!saved) {
      throw new NotFoundError('Contact or conversation was not found for draft generation', parsed.data);
    }

    return generatedDraftResultSchema.parse(saved);
  } finally {
    await sqlite.close();
  }
}