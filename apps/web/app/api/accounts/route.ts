import { NextResponse } from 'next/server';
import { toErrorResponse } from '@mycrm/core';
import { createAccount, listAccounts } from '@/lib/services/accounts-service';

export async function GET() {
  try {
    const accounts = await listAccounts();
    return NextResponse.json({ accounts });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}

export async function POST(request: Request) {
  try {
    const account = await createAccount(await request.json());
    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}