import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ValidationError } from '@mycrm/core';
import { runMigrations } from '../../../../packages/db/src/migrate';
import { seedDatabase } from '../../../../packages/db/src/seed';
import { exportSettings, importSettingsSnapshot, listSettings, updateSettings } from './settings-service';

function createTempDbUrl(name: string) {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mycrm-phase11-settings-')), `${name}.sqlite`);
  return `file:${filePath}`;
}

describe('settings service', () => {
  it('lists and updates settings with secret redaction', async () => {
    const databaseUrl = createTempDbUrl('list-update');
    await runMigrations(databaseUrl);
    await seedDatabase(databaseUrl);

    await updateSettings(
      {
        values: [
          { key: 'followup_days', value: '11', isSecret: false },
          { key: 'gemini_api_key', value: 'phase11-secret', isSecret: true }
        ]
      },
      databaseUrl
    );

    const settings = await listSettings(databaseUrl);

    expect(settings.find((entry) => entry.key === 'followup_days')?.value).toBe('11');
    expect(settings.find((entry) => entry.key === 'gemini_api_key')?.value).toBe('');
    expect(settings.find((entry) => entry.key === 'gemini_api_key')?.redactedValue).toContain('*');
  });

  it('exports and imports settings snapshots', async () => {
    const databaseUrl = createTempDbUrl('export-import');
    await runMigrations(databaseUrl);
    await seedDatabase(databaseUrl);

    const snapshot = await exportSettings({ includeSecrets: true }, databaseUrl);
    await importSettingsSnapshot(
      {
        version: 1,
        mode: 'replace',
        values: snapshot.values.map((entry) =>
          entry.key === 'followup_days' ? { ...entry, value: '13' } : entry
        )
      },
      databaseUrl
    );

    const settings = await listSettings(databaseUrl);
    expect(settings.find((entry) => entry.key === 'followup_days')?.value).toBe('13');
  });

  it('rejects duplicate import keys and empty secret imports', async () => {
    await expect(
      importSettingsSnapshot({
        version: 1,
        mode: 'merge',
        values: [
          { key: 'followup_days', value: '7', isSecret: false },
          { key: 'followup_days', value: '8', isSecret: false }
        ]
      })
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      importSettingsSnapshot({
        version: 1,
        mode: 'merge',
        values: [{ key: 'gemini_api_key', value: '', isSecret: true }]
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects invalid workspace restore payloads that omit settings', async () => {
    await expect(
      importSettingsSnapshot({
        version: 1,
        scope: 'workspace',
        mode: 'replace',
        data: {
          contacts: [],
          conversations: [],
          messages: [],
          drafts: [],
          draftVariants: [],
          jobs: [],
          syncRuns: [],
          auditLog: []
        }
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});