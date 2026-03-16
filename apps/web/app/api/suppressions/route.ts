import { NextResponse } from 'next/server';
import { createNodeDb, createMutationRepository } from '@mycrm/db/server';

export async function GET() {
  const { db, sqlite } = await createNodeDb();
  const repository = createMutationRepository(db, sqlite);

  const suppressions = await repository.listSyncSuppressions();
  return NextResponse.json(suppressions);
}
