import { NextResponse } from 'next/server';

import { toErrorResponse } from '@/lib/services/settings-service';
import { listSettings, updateSettings } from '@/lib/services/settings-service';

export async function GET() {
  try {
    const settings = await listSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}

export async function PUT(request: Request) {
  try {
    const settings = await updateSettings(await request.json());
    return NextResponse.json({ settings });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}