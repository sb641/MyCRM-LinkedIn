import { NextResponse } from 'next/server';
import { toErrorResponse } from '@mycrm/core';
import { mergeAccounts } from '@/lib/services/accounts-service';

export async function POST(request: Request) {
  try {
    const account = await mergeAccounts(await request.json());
    return NextResponse.json(account);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}