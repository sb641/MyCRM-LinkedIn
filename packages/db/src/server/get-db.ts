import fs from 'node:fs';
import path from 'node:path';
import { getEnv } from '@mycrm/core';
import { createNodeDb } from './node-sqlite';

void process.env.NODE_ENV;

type ServerDb = Awaited<ReturnType<typeof createNodeDb>>;
export type ResolvedServerDb = ServerDb & { resolvedDatabaseUrl: string; resolvedDatabasePath: string };

declare global {
  var __mycrmDbByUrl__: Map<string, Promise<ServerDb>> | undefined;
}

function resolveWorkspaceRoot(startDir = process.cwd()) {
  let currentDir = path.resolve(startDir);

  while (true) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    const workspacePath = path.join(currentDir, 'pnpm-workspace.yaml');

    if (fs.existsSync(packageJsonPath) && fs.existsSync(workspacePath)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return path.resolve(startDir);
    }

    currentDir = parentDir;
  }
}

function resolveDatabasePath(configured: string) {
  const filePath = configured.startsWith('file:') ? configured.slice(5) : configured;

  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  return path.resolve(resolveWorkspaceRoot(), filePath);
}

function resolveDatabaseUrl(databaseUrl?: string) {
  const configured = databaseUrl ?? getEnv().DATABASE_URL;
  const filePath = resolveDatabasePath(configured);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  return configured.startsWith('file:') ? `file:${filePath.replace(/\\/g, '/')}` : filePath;
}

export async function getDb(databaseUrl?: string) {
  const resolvedDatabaseUrl = resolveDatabaseUrl(databaseUrl);
  const resolvedDatabasePath = resolvedDatabaseUrl.startsWith('file:')
    ? resolvedDatabaseUrl.slice(5)
    : resolvedDatabaseUrl;
  globalThis.__mycrmDbByUrl__ ??= new Map<string, Promise<ServerDb>>();

  const existing = globalThis.__mycrmDbByUrl__.get(resolvedDatabaseUrl);
  if (existing) {
    return (await existing) as ResolvedServerDb;
  }

  const connection = createNodeDb(resolvedDatabaseUrl).then((db) => ({
    ...db,
    resolvedDatabaseUrl,
    resolvedDatabasePath
  }));
  globalThis.__mycrmDbByUrl__.set(resolvedDatabaseUrl, connection);
  return (await connection) as ResolvedServerDb;
}