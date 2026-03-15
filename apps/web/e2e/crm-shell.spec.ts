import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('loads the CRM shell smoke flow', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/inbox/);
  await expect(page.getByRole('heading', { name: 'Daily operating workspace' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'People' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Conversation and drafts' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Signals and operations' })).toBeVisible();
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
  await expect(page.getByText(/Sync queued for/)).toBeVisible();

  await page.getByRole('link', { name: /Contact 3/i }).click();
  await expect(page.getByRole('heading', { name: 'Conversation and drafts' })).toBeVisible();
  await expect(page.getByText('Approved draft 3')).toBeVisible();
  await page.getByText('Approved draft 3').locator('..').getByRole('button', { name: 'Send Message' }).click();
  await expect(page.getByText(/Queued send for/).last()).toBeVisible();
});

test('generates drafts in bulk for selected inbox people', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('checkbox', { name: /^Select Contact 1$/ }).evaluate((element: HTMLInputElement) => element.click());
  await page.getByRole('checkbox', { name: /^Select Contact 2$/ }).evaluate((element: HTMLInputElement) => element.click());
  await page.getByRole('button', { name: 'Bulk Generate (2)' }).click();

  await expect(page.getByRole('dialog', { name: 'Generate drafts for selected people' })).toBeVisible();
  await expect(page.getByLabel('Selected people', { exact: true })).toContainText('Contact 1');
  await expect(page.getByLabel('Selected people', { exact: true })).toContainText('Contact 2');

  await page.getByRole('button', { name: 'Generate 2 Drafts' }).click();

  await expect(page.getByText('Generated 2 drafts for 2 selected people.')).toBeVisible();
  await expect(page.getByText('Generated 2 drafts for 2 selected people.').last()).toBeVisible();
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

test('assigns and merges accounts in account mode', async ({ page }) => {
  await page.goto('/inbox?entity=accounts&queue=all&accountId=account-001&sort=recent');

  const assignStakeholdersSection = page.getByLabel('Assign stakeholders');
  const mergeAccountsSection = page.getByLabel('Merge accounts');

  await expect(page.getByRole('heading', { name: 'Account workspace' })).toBeVisible();
  await assignStakeholdersSection.scrollIntoViewIfNeeded();
  await expect(assignStakeholdersSection).toBeInViewport();
  await mergeAccountsSection.scrollIntoViewIfNeeded();
  await expect(mergeAccountsSection).toBeInViewport();

  await assignStakeholdersSection.scrollIntoViewIfNeeded();
  await page.getByRole('checkbox', { name: /^Assign Contact 3$/ }).check();
  await page.getByRole('button', { name: 'Assign selected' }).click();

  await expect(page.getByText('Contact 3')).toBeVisible();

  await mergeAccountsSection.scrollIntoViewIfNeeded();
  await page.getByLabel('Source account').selectOption('account-002');
  await page.getByRole('button', { name: 'Merge into current account' }).click();

  await expect(page.getByRole('heading', { name: 'Company 1' })).toBeVisible();
  await expect(page.getByText('8 stakeholders').first()).toBeVisible();
  await expect(page.getByText('Company 2 Inc')).toBeVisible();
  await expect(page.getByText('Contact 3')).toBeVisible();
});