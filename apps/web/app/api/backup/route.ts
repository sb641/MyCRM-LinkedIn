import { NextResponse } from 'next/server';

import { toErrorResponse } from '@/lib/services/settings-service';
import { exportSettings, importSettingsSnapshot } from '@/lib/services/settings-service';

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const includeSecrets = searchParams.get('includeSecrets') === 'true';
    const scope = searchParams.get('scope') === 'workspace' ? 'workspace' : 'settings';
    const snapshot = await exportSettings({ includeSecrets, scope });
    return NextResponse.json(snapshot);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}

export async function POST(request: Request) {
  try {
    const settings = await importSettingsSnapshot(await request.json());
    return NextResponse.json({ settings }, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}