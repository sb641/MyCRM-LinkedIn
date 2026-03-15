import { NextResponse } from 'next/server';
import { generateDraftsBulk } from '@/lib/services/crm-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await generateDraftsBulk(body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate drafts';
    return NextResponse.json({ message }, { status: 400 });
  }
}
