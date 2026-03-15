import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NotFoundError, ValidationError } from '@mycrm/core';
import { runMigrations } from '../../../../packages/db/src/migrate';
import { seedDatabase } from '../../../../packages/db/src/seed';
import {
  assignContactsToAccount,
  createAccount,
  getAccountDetails,
  listAccounts,
  mergeAccounts
} from './accounts-service';

function createTempDbUrl(name: string) {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mycrm-phase5-')), `${name}.sqlite`);
  return `file:${filePath}`;
}

describe('accounts service', () => {
  it('lists accounts from seeded data', async () => {
    const databaseUrl = createTempDbUrl('accounts-list');
    await runMigrations(databaseUrl);
    await seedDatabase(databaseUrl);

    const created = await createAccount({ name: 'Acme Corp', alias: 'Acme' }, databaseUrl);
    const accounts = await listAccounts(databaseUrl);

    expect(accounts.some((account) => account.id === created.account.id)).toBe(true);
  });

  it('creates and loads account details', async () => {
    const databaseUrl = createTempDbUrl('accounts-details');
    await runMigrations(databaseUrl);
    await seedDatabase(databaseUrl);

    const created = await createAccount({ name: 'Northwind', domain: 'northwind.test' }, databaseUrl);
    const details = await getAccountDetails(created.account.id, databaseUrl);

    expect(details.account.name).toBe('Northwind');
    expect(details.account.aliases.some((alias) => alias.alias === 'Northwind')).toBe(true);
  });

  it('assigns contacts to an account', async () => {
    const databaseUrl = createTempDbUrl('accounts-assign');
    await runMigrations(databaseUrl);
    await seedDatabase(databaseUrl);

    const created = await createAccount({ name: 'Assigned Co' }, databaseUrl);
    const details = await assignContactsToAccount(created.account.id, { contactIds: ['contact-001'] }, databaseUrl);

    expect(details.contacts.some((contact) => contact.id === 'contact-001')).toBe(true);
  });

  it('merges accounts and preserves aliases', async () => {
    const databaseUrl = createTempDbUrl('accounts-merge');
    await runMigrations(databaseUrl);
    await seedDatabase(databaseUrl);

    const source = await createAccount({ name: 'Source Co' }, databaseUrl);
    const target = await createAccount({ name: 'Target Co' }, databaseUrl);
    await assignContactsToAccount(source.account.id, { contactIds: ['contact-001'] }, databaseUrl);

    const merged = await mergeAccounts(
      {
        sourceAccountId: source.account.id,
        targetAccountId: target.account.id,
        preserveSourceAsAlias: true
      },
      databaseUrl
    );

    expect(merged.contacts.some((contact) => contact.id === 'contact-001')).toBe(true);
    expect(merged.account.aliases.some((alias) => alias.alias === 'Source Co')).toBe(true);
  });

  it('rejects invalid payloads', async () => {
    const databaseUrl = createTempDbUrl('accounts-invalid');
    await runMigrations(databaseUrl);
    await seedDatabase(databaseUrl);

    await expect(createAccount({}, databaseUrl)).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws not found for missing account', async () => {
    const databaseUrl = createTempDbUrl('accounts-missing');
    await runMigrations(databaseUrl);
    await seedDatabase(databaseUrl);

    await expect(getAccountDetails('missing-account', databaseUrl)).rejects.toBeInstanceOf(NotFoundError);
  });
});