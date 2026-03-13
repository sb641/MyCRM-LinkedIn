import { NextResponse } from 'next/server';
import { ValidationError, toErrorResponse } from '@mycrm/core';
import { updateContactRelationshipStatus } from '@/lib/services/crm-service';

type RouteContext = {
  params: Promise<{
    contactId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { contactId } = await context.params;
    if (!contactId) {
      throw new ValidationError('contactId is required');
    }

    const body = await request.json();
    const result = await updateContactRelationshipStatus(contactId, body);
    return NextResponse.json(result);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}