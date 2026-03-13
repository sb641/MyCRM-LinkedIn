import { NextResponse } from 'next/server';
import { ValidationError, toErrorResponse } from '@mycrm/core';
import { approveDraft } from '@/lib/services/crm-service';

type RouteContext = {
  params: Promise<{
    draftId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { draftId } = await context.params;
    if (!draftId) {
      throw new ValidationError('draftId is required');
    }

    const body = await request.json();
    const result = await approveDraft(draftId, body);
    return NextResponse.json(result);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}