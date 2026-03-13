import { NextResponse } from 'next/server';

import { browserSessionSchema, toErrorResponse } from '@mycrm/core';
import { getBrowserSession, saveBrowserSession } from '@/lib/services/browser-session-service';

export async function GET(request: Request) {
  try {
    const accountId = new URL(request.url).searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ message: 'accountId is required' }, { status: 400 });
    }

    const session = await getBrowserSession(accountId);
    return NextResponse.json({ session });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}

export async function POST(request: Request) {
  try {
    const body = browserSessionSchema.parse(await request.json());
    const result = await saveBrowserSession({
      ...body,
      capturedAt: body.capturedAt ?? Date.now()
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}