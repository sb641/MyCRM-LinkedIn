import { NextResponse } from 'next/server';
import { toErrorResponse } from '@mycrm/core';
import { updateReminder } from '@/lib/services/reminders-service';

export async function PATCH(request: Request, context: { params: Promise<{ reminderId: string }> }) {
  try {
    const { reminderId } = await context.params;
    const reminder = await updateReminder(reminderId, await request.json());
    return NextResponse.json({ reminder });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}