export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { toErrorResponse } from '@mycrm/core';
import { enqueueJob, enqueueManualBrowserSync, listJobsWithAudit, listSyncRuns } from '@/lib/services/jobs-service';

export async function GET() {
  try {
    const jobs = await listJobsWithAudit();
    const syncRuns = await listSyncRuns();
    return NextResponse.json({ jobs, syncRuns });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}

export async function POST(request: Request) {
  try {
    const mode = new URL(request.url).searchParams.get('mode');
    const rawBody = await request.text();
    const body = rawBody ? JSON.parse(rawBody) : {};
    const result = mode === 'manual-sync' ? await enqueueManualBrowserSync(body) : await enqueueJob(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}