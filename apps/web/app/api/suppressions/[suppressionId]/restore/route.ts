import { NextResponse } from 'next/server';
import { createNodeDb, createMutationRepository } from '@mycrm/db/server';

export async function POST(req: Request, { params }: { params: Promise<{ suppressionId: string }> }) {
  const { suppressionId } = await params;
  const { db, sqlite } = await createNodeDb();
  const repository = createMutationRepository(db, sqlite);

  await repository.restoreSuppression(suppressionId);

  return NextResponse.json({ success: true });
}
