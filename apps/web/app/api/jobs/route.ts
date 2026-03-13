import { NextResponse } from 'next/server';
import { toErrorResponse } from '@mycrm/core';
import { enqueueJob, listJobs } from '@/lib/services/jobs-service';

export async function GET() {
  try {
    const jobs = await listJobs();
    return NextResponse.json({ jobs });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await enqueueJob(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}