import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('loads the CRM shell smoke flow', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/inbox/);
  await expect(page.getByRole('heading', { name: 'People-first outreach workspace' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Conversations' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Flags and actions' })).toBeVisible();
  await expect(page.getByText('Sync History')).toBeVisible();
  await expect(page.getByLabel('Workspace settings')).toBeVisible();
  await expect(
    page.getByLabel('Top bar actions').getByRole('button', { name: 'Sync Conversations' })
  ).toBeVisible();
});

test('saves settings and exports a backup snapshot', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('textbox', { name: 'followup_days' }).fill('11');
  await page.getByRole('button', { name: 'Save settings' }).click();

  await expect(page.getByText('Saved 2 settings')).toBeVisible();

  await page.getByRole('button', { name: 'Export Workspace Data' }).click();

  await expect(page.getByText('Backup exported without secrets')).toBeVisible();
  await expect(page.getByLabel('Restore workspace payload')).toContainText('"version": 1');
  await expect(page.getByLabel('Restore workspace payload')).toContainText('"followup_days"');
});

test('queues manual sync and approved draft send', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Top bar actions').getByRole('button', { name: 'Sync Conversations' }).click();
  await expect(page.getByText(/Manual sync queued:/)).toBeVisible();

  await page.getByRole('button', { name: 'Send Message' }).first().click();
  await expect(page.getByText(/Queued send job/).last()).toBeVisible();
});

test('blocks workspace replace restore until confirmation is provided', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Restore workspace payload').fill(
    JSON.stringify(
      {
        version: 1,
        scope: 'workspace',
        mode: 'replace',
        settings: [{ key: 'followup_days', value: '14', isSecret: false }],
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
      },
      null,
      2
    )
  );

  await expect(page.getByLabel('Restore payload preview')).toBeVisible();
  await page.getByRole('button', { name: 'Restore Workspace Data' }).click();

  await expect(page.getByText('Type REPLACE WORKSPACE to confirm workspace replace restore')).toBeVisible();
});