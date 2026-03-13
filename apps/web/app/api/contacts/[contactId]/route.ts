import { NextResponse } from 'next/server';
import { ValidationError, toErrorResponse } from '@mycrm/core';
import { getContactConversationDetails } from '@/lib/services/inbox-service';

type RouteContext = {
  params: Promise<{
    contactId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { contactId } = await context.params;

    if (!contactId) {
      throw new ValidationError('contactId is required');
    }

    const details = await getContactConversationDetails(contactId);
    return NextResponse.json(details);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}