import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NotFoundError, ValidationError } from '@mycrm/core';
import { runMigrations } from '../../../../packages/db/src/migrate';
import { seedDatabase } from '../../../../packages/db/src/seed';
import {
  addCampaignTargets,
  createCampaign,
  getCampaignDetails,
  listCampaigns,
  removeCampaignTarget,
  updateCampaign
} from './campaigns-service';

function createTempDbUrl(name: string) {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mycrm-phase7-')), `${name}.sqlite`);
  return `file:${filePath}`;
}

describe('campaigns service', () => {
  it('lists campaigns after creation', async () => {
    const databaseUrl = createTempDbUrl('campaigns-list');
    await runMigrations(databaseUrl);
    await seedDatabase(databaseUrl);

    const created = await createCampaign(
      {
        name: 'Expansion Push',
        objective: 'Open expansion conversations',
        status: 'draft',
        tags: ['expansion']
      },
      databaseUrl
    );
    const campaigns = await listCampaigns(databaseUrl);

    expect(campaigns.some((campaign) => campaign.id === created.campaign.id)).toBe(true);
  });

  it('creates, updates, and loads campaign details', async () => {
    const databaseUrl = createTempDbUrl('campaigns-details');
    await runMigrations(databaseUrl);
    await seedDatabase(databaseUrl);

    const created = await createCampaign(
      {
        name: 'Stakeholder Mapping',
        objective: 'Map buying committee',
        status: 'draft'
      },
      databaseUrl
    );

    const updated = await updateCampaign(
      created.campaign.id,
      {
        status: 'active',
        defaultPrompt: 'Keep the ask specific.',
        tags: ['abm', 'committee']
      },
      databaseUrl
    );

    const details = await getCampaignDetails(created.campaign.id, databaseUrl);

    expect(updated.campaign.status).toBe('active');
    expect(details.campaign.tags).toEqual(['abm', 'committee']);
  });

  it('adds and removes campaign targets', async () => {
    const databaseUrl = createTempDbUrl('campaigns-targets');
    await runMigrations(databaseUrl);
    await seedDatabase(databaseUrl);

    const created = await createCampaign(
      {
        name: 'Follow-up Sprint',
        objective: 'Re-engage warm contacts',
        status: 'draft'
      },
      databaseUrl
    );

    const withTargets = await addCampaignTargets(created.campaign.id, { contactIds: ['contact-001'] }, databaseUrl);
    expect(withTargets.targets).toHaveLength(1);

    const afterRemoval = await removeCampaignTarget(created.campaign.id, withTargets.targets[0].id, databaseUrl);
    expect(afterRemoval.targets).toHaveLength(0);
  });

  it('rejects invalid payloads', async () => {
    const databaseUrl = createTempDbUrl('campaigns-invalid');
    await runMigrations(databaseUrl);
    await seedDatabase(databaseUrl);

    await expect(createCampaign({}, databaseUrl)).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws not found for missing campaign', async () => {
    const databaseUrl = createTempDbUrl('campaigns-missing');
    await runMigrations(databaseUrl);
    await seedDatabase(databaseUrl);

    await expect(getCampaignDetails('missing-campaign', databaseUrl)).rejects.toBeInstanceOf(NotFoundError);
  });
});