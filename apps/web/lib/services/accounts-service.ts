import {
  accountDetailSchema,
  accountSummarySchema,
  assignContactsToAccountInputSchema,
  createAccountInputSchema,
  mergeAccountsInputSchema,
  NotFoundError,
  ValidationError
} from '@mycrm/core';
import { createAccountRepository, createNodeDb, getDb } from '@mycrm/db/server';

async function getServiceDb(databaseUrl?: string) {
  if (databaseUrl) {
    return createNodeDb(databaseUrl);
  }

  return getDb();
}

export async function listAccounts(databaseUrl?: string) {
  const { db, sqlite } = await getServiceDb(databaseUrl);
  const repository = createAccountRepository(db, sqlite);
  const accounts = await repository.listAccounts();
  return accountSummarySchema.array().parse(accounts);
}

export async function getAccountDetails(accountId: string, databaseUrl?: string) {
  if (!accountId) {
    throw new ValidationError('accountId is required');
  }

  const { db, sqlite } = await getServiceDb(databaseUrl);
  const repository = createAccountRepository(db, sqlite);
  const details = await repository.findAccountById(accountId);

  if (!details) {
    throw new NotFoundError(`Account ${accountId} was not found`, { accountId });
  }

  return accountDetailSchema.parse(details);
}

export async function createAccount(input: unknown, databaseUrl?: string) {
  const parsed = createAccountInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid account payload', parsed.error.flatten());
  }

  const { db, sqlite } = await getServiceDb(databaseUrl);
  const repository = createAccountRepository(db, sqlite);
  const created = await repository.createAccount(parsed.data);

  if (!created) {
    throw new Error('Account was not created');
  }

  return accountDetailSchema.parse(created);
}

export async function assignContactsToAccount(accountId: string, input: unknown, databaseUrl?: string) {
  if (!accountId) {
    throw new ValidationError('accountId is required');
  }

  const parsed = assignContactsToAccountInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid account assignment payload', parsed.error.flatten());
  }

  const { db, sqlite } = await getServiceDb(databaseUrl);
  const repository = createAccountRepository(db, sqlite);
  const updatedCount = await repository.assignContactsToAccount(accountId, parsed.data);

  if (updatedCount === 0) {
    throw new NotFoundError(`Account ${accountId} was not found`, { accountId });
  }

  const details = await repository.findAccountById(accountId);
  if (!details) {
    throw new NotFoundError(`Account ${accountId} was not found`, { accountId });
  }

  return accountDetailSchema.parse(details);
}

export async function mergeAccounts(input: unknown, databaseUrl?: string) {
  const parsed = mergeAccountsInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid account merge payload', parsed.error.flatten());
  }

  const { db, sqlite } = await getServiceDb(databaseUrl);
  const repository = createAccountRepository(db, sqlite);
  const merged = await repository.mergeAccounts(parsed.data);

  if (!merged) {
    throw new NotFoundError('Source or target account was not found', {
      sourceAccountId: parsed.data.sourceAccountId,
      targetAccountId: parsed.data.targetAccountId
    });
  }

  return accountDetailSchema.parse(merged);
}