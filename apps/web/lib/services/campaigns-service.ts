import {
  addCampaignTargetsInputSchema,
  campaignDetailSchema,
  campaignSummarySchema,
  createCampaignInputSchema,
  NotFoundError,
  ValidationError,
  updateCampaignInputSchema
} from '@mycrm/core';
import { createCampaignRepository, createNodeDb, getDb } from '@mycrm/db/server';

async function getServiceDb(databaseUrl?: string) {
  if (databaseUrl) {
    return createNodeDb(databaseUrl);
  }

  return getDb();
}

export async function listCampaigns(databaseUrl?: string) {
  const { db, sqlite } = await getServiceDb(databaseUrl);
  const repository = createCampaignRepository(db, sqlite);
  const campaigns = await repository.listCampaigns();
  return campaignSummarySchema.array().parse(campaigns);
}

export async function getCampaignDetails(campaignId: string, databaseUrl?: string) {
  if (!campaignId) {
    throw new ValidationError('campaignId is required');
  }

  const { db, sqlite } = await getServiceDb(databaseUrl);
  const repository = createCampaignRepository(db, sqlite);
  const details = await repository.findCampaignById(campaignId);

  if (!details) {
    throw new NotFoundError(`Campaign ${campaignId} was not found`, { campaignId });
  }

  return campaignDetailSchema.parse(details);
}

export async function createCampaign(input: unknown, databaseUrl?: string) {
  const parsed = createCampaignInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid campaign payload', parsed.error.flatten());
  }

  const { db, sqlite } = await getServiceDb(databaseUrl);
  const repository = createCampaignRepository(db, sqlite);
  const created = await repository.createCampaign(parsed.data);

  if (!created) {
    throw new Error('Campaign was not created');
  }

  return campaignDetailSchema.parse(created);
}

export async function updateCampaign(campaignId: string, input: unknown, databaseUrl?: string) {
  if (!campaignId) {
    throw new ValidationError('campaignId is required');
  }

  const parsed = updateCampaignInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid campaign payload', parsed.error.flatten());
  }

  const { db, sqlite } = await getServiceDb(databaseUrl);
  const repository = createCampaignRepository(db, sqlite);
  const updated = await repository.updateCampaign(campaignId, parsed.data);

  if (!updated) {
    throw new NotFoundError(`Campaign ${campaignId} was not found`, { campaignId });
  }

  return campaignDetailSchema.parse(updated);
}

export async function addCampaignTargets(campaignId: string, input: unknown, databaseUrl?: string) {
  if (!campaignId) {
    throw new ValidationError('campaignId is required');
  }

  const parsed = addCampaignTargetsInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid campaign targets payload', parsed.error.flatten());
  }

  const { db, sqlite } = await getServiceDb(databaseUrl);
  const repository = createCampaignRepository(db, sqlite);
  const updated = await repository.addTargets(campaignId, parsed.data);

  if (!updated) {
    throw new NotFoundError(`Campaign ${campaignId} was not found`, { campaignId });
  }

  return campaignDetailSchema.parse(updated);
}

export async function removeCampaignTarget(campaignId: string, targetId: string, databaseUrl?: string) {
  if (!campaignId) {
    throw new ValidationError('campaignId is required');
  }

  if (!targetId) {
    throw new ValidationError('targetId is required');
  }

  const { db, sqlite } = await getServiceDb(databaseUrl);
  const repository = createCampaignRepository(db, sqlite);
  const updated = await repository.removeTarget(campaignId, targetId);

  if (!updated) {
    throw new NotFoundError(`Campaign target ${targetId} was not found`, { campaignId, targetId });
  }

  return campaignDetailSchema.parse(updated);
}