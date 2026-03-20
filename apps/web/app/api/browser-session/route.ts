import { NextResponse } from 'next/server';

import {
  browserSessionBootstrapRequestSchema,
  browserSessionBootstrapResultSchema,
  browserSessionSchema,
  toErrorResponse
} from '@mycrm/core';
import {
  getBrowserSession,
  saveBrowserSession
} from '@/lib/services/browser-session-service';
import { getManualBrowserSyncReadiness } from '@/lib/services/jobs-service';

export async function GET(request: Request) {
  try {
    const accountId = new URL(request.url).searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ message: 'accountId is required' }, { status: 400 });
    }

    const session = await getBrowserSession(accountId);
    const readiness = await getManualBrowserSyncReadiness(accountId);
    return NextResponse.json({ session, readiness });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode');

    if (mode === 'bootstrap') {
      const body = browserSessionBootstrapRequestSchema.parse(await request.json());
      const { bootstrapBrowserSession } = await import('@/app/api/browser-session/bootstrap-service');
      const result = browserSessionBootstrapResultSchema.parse(
        await bootstrapBrowserSession(body.accountId)
      );

      return NextResponse.json(result, { status: 201 });
    }

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