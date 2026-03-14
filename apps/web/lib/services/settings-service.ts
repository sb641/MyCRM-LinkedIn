import {
  backupExportQuerySchema,
  restoreWorkspaceInputSchema,
  restoreImportInputSchema,
  settingsSnapshotSchema,
  toErrorResponse,
  updateSettingsInputSchema,
  ValidationError
} from '@mycrm/core';
import { createSettingsRepository, getDb } from '@mycrm/db/server';

export async function listSettings(databaseUrl?: string) {
  const { db, sqlite } = await getDb();

  try {
    const repository = createSettingsRepository(db, sqlite);
    return repository.listSettings();
  } finally {
  }
}

export async function updateSettings(input: unknown, databaseUrl?: string) {
  const parsed = updateSettingsInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid settings payload', parsed.error.flatten());
  }

  const { db, sqlite } = await getDb();

  try {
    const repository = createSettingsRepository(db, sqlite);
    await repository.upsertSettings(
      parsed.data.values.map((entry) => ({
        key: entry.key,
        value: entry.value,
        isSecret: entry.isSecret ?? (entry.key.endsWith('_key') || entry.key.endsWith('_token')),
        reset: entry.reset
      }))
    );

    return repository.listSettings();
  } finally {
  }
}

export async function exportSettings(input: unknown, databaseUrl?: string) {
  const parsed = backupExportQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid export query', parsed.error.flatten());
  }

  const { db, sqlite } = await getDb();

  try {
    const repository = createSettingsRepository(db, sqlite);

    if (parsed.data.scope === 'workspace') {
      return repository.exportWorkspace(parsed.data.includeSecrets);
    }

    const snapshot = await repository.exportSettings(parsed.data.includeSecrets);
    return settingsSnapshotSchema.parse(snapshot);
  } finally {
  }
}

export async function importSettingsSnapshot(input: unknown, databaseUrl?: string) {
  const workspaceParsed = restoreWorkspaceInputSchema.safeParse(input);
  if (workspaceParsed.success) {
    const { db, sqlite } = await getDb();

    try {
      const repository = createSettingsRepository(db, sqlite);
      await repository.importWorkspace(workspaceParsed.data);
      return repository.listSettings();
    } finally {
    }
  }

  const parsed = restoreImportInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid import payload', parsed.error.flatten());
  }

  const { db, sqlite } = await getDb();

  try {
    const repository = createSettingsRepository(db, sqlite);
    await repository.importSettings({
      values: parsed.data.values,
      mode: parsed.data.mode
    });

    return repository.listSettings();
  } finally {
  }
}

export { toErrorResponse };