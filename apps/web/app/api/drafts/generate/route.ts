import { NextResponse } from 'next/server';
import { toErrorResponse } from '@mycrm/core';
import { generateDraft } from '@/lib/services/crm-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await generateDraft(body);
    return NextResponse.json(result);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}