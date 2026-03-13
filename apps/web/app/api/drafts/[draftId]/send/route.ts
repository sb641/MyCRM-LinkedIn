import { NextResponse } from 'next/server';
import { NotFoundError, ValidationError } from '@mycrm/core';
import { queueApprovedDraftSend } from '@/lib/services/crm-service';

export async function POST(
  request: Request,
  context: { params: Promise<{ draftId: string }> }
) {
  const { draftId } = await context.params;
  const body = await request.json();

  try {
    const result = await queueApprovedDraftSend({ ...body, draftId });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    if (error instanceof ValidationError) {
      return NextResponse.json({ message: error.message, details: error.details }, { status: 400 });
    }

    throw error;
  }
}