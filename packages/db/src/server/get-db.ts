import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import { getEnv } from '@mycrm/core';
import { createNodeDb } from './node-sqlite';

type ServerDb = Awaited<ReturnType<typeof createNodeDb>>;

declare global {
  var __mycrmDb__: Promise<ServerDb> | undefined;
}

function resolveDatabaseUrl() {
  const configured = getEnv().DATABASE_URL;
  const filePath = configured.startsWith('file:') ? configured.slice(5) : configured;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  return configured;
}

export async function getDb() {
  globalThis.__mycrmDb__ ??= createNodeDb(resolveDatabaseUrl());
  return globalThis.__mycrmDb__;
}