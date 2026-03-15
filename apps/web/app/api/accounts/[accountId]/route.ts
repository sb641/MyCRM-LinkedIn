import { NextResponse } from 'next/server';
import { ValidationError, toErrorResponse } from '@mycrm/core';
import { getAccountDetails } from '@/lib/services/accounts-service';

type RouteContext = {
  params: Promise<{
    accountId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { accountId } = await context.params;

    if (!accountId) {
      throw new ValidationError('accountId is required');
    }

    const account = await getAccountDetails(accountId);
    return NextResponse.json(account);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}