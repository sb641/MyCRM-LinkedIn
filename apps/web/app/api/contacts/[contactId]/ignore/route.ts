import { NextResponse } from 'next/server';
import { ValidationError, createSuppressionInputSchema, toErrorResponse } from '@mycrm/core';
import { createNodeDb, createMutationRepository } from '@mycrm/db/server';

export async function POST(req: Request, { params }: { params: Promise<{ contactId: string }> }) {
  try {
    const { contactId } = await params;

    if (!contactId) {
      throw new ValidationError('contactId is required');
    }

    const body = createSuppressionInputSchema.pick({ reason: true }).parse(await req.json());
    const { db, sqlite } = await createNodeDb();
    const repository = createMutationRepository(db, sqlite);

    await repository.ignoreContact(contactId, body.reason, true);

    return NextResponse.json({ success: true });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}
