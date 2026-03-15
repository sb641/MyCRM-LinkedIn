import { NextResponse } from 'next/server';
import { toErrorResponse } from '@mycrm/core';
import { createReminder, listReminders } from '@/lib/services/reminders-service';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const entityType = url.searchParams.get('entityType') as 'contact' | 'account' | 'campaign' | null;
    const entityId = url.searchParams.get('entityId');
    const reminders = await listReminders(
      entityType || entityId
        ? {
            entityType: entityType ?? undefined,
            entityId: entityId ?? undefined
          }
        : undefined
    );
    return NextResponse.json({ reminders });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}

export async function POST(request: Request) {
  try {
    const reminder = await createReminder(await request.json());
    return NextResponse.json({ reminder }, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}