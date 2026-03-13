import { NextResponse } from 'next/server';
import { toErrorResponse } from '@mycrm/core';
import { listInboxItems } from '@/lib/services/inbox-service';

export async function GET() {
  try {
    const items = await listInboxItems();
    return NextResponse.json({ items });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}