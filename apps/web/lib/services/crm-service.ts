import {
  approveDraftInputSchema,
  bulkGenerateDraftInputSchema,
  bulkGeneratedDraftResultSchema,
  type DraftSummaryDto,
  type GeneratedDraftResultDto,
  generateDraftInputSchema,
  generatedDraftResultSchema,
  enqueueJobResultSchema,
  mutationResultSchema,
  NotFoundError,
  queueSendRequestSchema,
  updateRelationshipStatusInputSchema,
  ValidationError
} from '@mycrm/core';
import { createAiAdapter, createPromptBuilder } from '@mycrm/ai';
import { createJobRepository, createMutationRepository, createNodeDb, getDb } from '@mycrm/db/server';

let generatedDraftSequence = 0;

function createGeneratedDraftId(contactId: string, conversationId: string) {
  generatedDraftSequence += 1;
  return `draft-generated-${Date.now()}-${generatedDraftSequence}-${contactId}-${conversationId}`;
}

async function getServiceDb(databaseUrl?: string) {
  if (databaseUrl) {
    return createNodeDb(databaseUrl);
  }

  return getDb();
}

export async function updateContactRelationshipStatus(
  contactId: string,
  input: unknown,
  databaseUrl?: string
) {
  const parsed = updateRelationshipStatusInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid relationship status payload', parsed.error.flatten());
  }

  const { db, sqlite } = await getServiceDb(databaseUrl);
  const repository = createMutationRepository(db, sqlite);
  const updated = await repository.updateRelationshipStatus(contactId, parsed.data.relationshipStatus);

  if (updated === 0) {
    throw new NotFoundError(`Contact ${contactId} was not found`, { contactId });
  }

  return mutationResultSchema.parse({ success: true });
}

export async function approveDraft(draftId: string, input: unknown, databaseUrl?: string) {
  const parsed = approveDraftInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid draft approval payload', parsed.error.flatten());
  }

  const { db, sqlite } = await getServiceDb(databaseUrl);
  const repository = createMutationRepository(db, sqlite);
  const updated = await repository.approveDraft(draftId, parsed.data.approvedText, parsed.data.sendStatus);

  if (updated === 0) {
    throw new NotFoundError(`Draft ${draftId} was not found`, { draftId });
  }

  return mutationResultSchema.parse({ success: true });
}

export async function generateDraft(input: unknown, databaseUrl?: string): Promise<GeneratedDraftResultDto> {
  const parsed = generateDraftInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid draft generation payload', parsed.error.flatten());
  }

  const { db, sqlite } = await getServiceDb(databaseUrl);
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
  const draftId = createGeneratedDraftId(parsed.data.contactId, parsed.data.conversationId);
  const saved = await repository.createGeneratedDraft({
    draftId,
    contactId: parsed.data.contactId,
    conversationId: parsed.data.conversationId,
    goalText: parsed.data.goal,
    modelName: 'mock-gemini',
    variants: variants.map((variant: { id?: string; text: string; score?: number | null }, index: number) => ({
      id: `${draftId}-variant-${index + 1}`,
      text: variant.text,
      selected: index === 0,
      score: variant.score ?? null
    }))
  });

  if (!saved) {
    throw new NotFoundError('Contact or conversation was not found for draft generation', parsed.data);
  }

  return generatedDraftResultSchema.parse(saved);
}

export async function generateDraftsBulk(input: unknown, databaseUrl?: string) {
  const parsed = bulkGenerateDraftInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid bulk draft generation payload', parsed.error.flatten());
  }

  const goalSuffixParts = [
    parsed.data.options.includeLink ? `Include this link when relevant: ${parsed.data.options.includeLink}` : null,
    parsed.data.options.callToAction ? `Call to action: ${parsed.data.options.callToAction}` : null,
    parsed.data.options.tone ? `Tone: ${parsed.data.options.tone}` : null,
    parsed.data.options.constraints ? `Constraints: ${parsed.data.options.constraints}` : null,
    parsed.data.options.useRecentConversationContext ? 'Use recent conversation context.' : 'Do not use recent conversation context.',
    parsed.data.options.useAccountContext ? 'Use account context.' : 'Do not use account context.',
    parsed.data.options.varyMessageByRole ? 'Vary the message by role.' : 'Do not vary the message by role.',
    parsed.data.options.avoidRepeatingAngleWithinAccount
      ? 'Avoid repeating the same angle within the same account.'
      : 'Angle repetition within the same account is allowed.'
  ].filter(Boolean);

  const composedGoal = [parsed.data.goal, ...goalSuffixParts].join('\n');
  const drafts: Array<{
    contactId: string;
    conversationId: string;
    draft: GeneratedDraftResultDto;
  }> = [];

  for (const selection of parsed.data.selections) {
    const draft = await generateDraft({
      contactId: selection.contactId,
      conversationId: selection.conversationId,
      goal: composedGoal
    }, databaseUrl);

    drafts.push({
      contactId: selection.contactId,
      conversationId: selection.conversationId,
      draft
    });
  }

  return bulkGeneratedDraftResultSchema.parse({
    requestedCount: parsed.data.selections.length,
    generatedCount: drafts.length,
    drafts,
    goal: parsed.data.goal,
    options: parsed.data.options
  });
}

export async function queueApprovedDraftSend(input: unknown, databaseUrl?: string) {
  const parsed = queueSendRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid send queue payload', parsed.error.flatten());
  }

  const { db, sqlite } = await getServiceDb(databaseUrl);
  const mutationRepository = createMutationRepository(db, sqlite);
  const jobRepository = createJobRepository(db, sqlite);
  const draft = await mutationRepository.findDraftForSend(parsed.data.draftId);

  if (!draft) {
    throw new NotFoundError(`Draft ${parsed.data.draftId} was not found`, { draftId: parsed.data.draftId });
  }

  if (draft.draftStatus !== 'approved' || !draft.approvedText) {
    throw new ValidationError('Draft must be approved before queueing send', {
      draftId: parsed.data.draftId,
      draftStatus: draft.draftStatus
    });
  }

  const result = await jobRepository.enqueueJob('send_message', {
    draftId: parsed.data.draftId,
    conversationId: parsed.data.conversationId,
    accountId: parsed.data.accountId,
    provider: parsed.data.provider,
    messageText: draft.approvedText
  });

  return enqueueJobResultSchema.parse(result);
}