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
  const saveSettingsResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/settings') && response.request().method() === 'PUT'
  );
  await page.getByRole('button', { name: 'Save settings' }).click();
  const saveSettingsResponse = await saveSettingsResponsePromise;
  expect(saveSettingsResponse.ok()).toBeTruthy();

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

  await page.goto('/inbox?queue=all&contactId=contact-003&conversationId=conversation-003&sort=recent');
  await expect(page.getByRole('heading', { name: 'Conversation and drafts' })).toBeVisible();
  const approvedDraftCard = page.locator('.draft-card', { hasText: 'Approved draft 3' });
  await expect(approvedDraftCard).toBeVisible();
  const sendResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/drafts/draft-003/send') && response.request().method() === 'POST'
  );
  await approvedDraftCard.getByRole('button', { name: 'Send Message' }).click();
  const sendResponse = await sendResponsePromise;
  expect(sendResponse.ok()).toBeTruthy();
  await expect(page.getByText(/Queued send for/).last()).toBeVisible();
});

test('generates drafts in bulk for selected inbox people', async ({ page }) => {
  await page.goto('/inbox?queue=all&entity=people&contactId=contact-001&conversationId=conversation-001&sort=recent');
  const conversationList = page.getByLabel('Conversation list');

  await conversationList.getByRole('checkbox', { name: /^Select Contact 1$/ }).first().click();
  await expect(page.getByRole('button', { name: 'Bulk Generate (1)' })).toBeVisible();
  await conversationList.getByRole('checkbox', { name: /^Select Contact 3$/ }).first().click();
  await expect(page.getByRole('button', { name: 'Bulk Generate (2)' })).toBeVisible();
  await page.getByRole('button', { name: 'Bulk Generate (2)' }).click();

  await expect(page.getByRole('dialog', { name: 'Generate drafts for selected people' })).toBeVisible();
  await expect(page.getByLabel('Selected people', { exact: true })).toContainText('Contact 1');
  await expect(page.getByLabel('Selected people', { exact: true })).toContainText('Contact 3');

  const bulkGenerateResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/drafts/bulk-generate') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Generate 2 Drafts' }).click();
  const bulkGenerateResponse = await bulkGenerateResponsePromise;
  expect(bulkGenerateResponse.ok()).toBeTruthy();

  await expect(page.getByText('Generated 2 drafts for 2 selected people.')).toBeVisible();
  await expect(page.getByText('Generated 2 drafts for 2 selected people.').last()).toBeVisible();
});

test('ignores a person from inbox and restores them from settings', async ({ page }) => {
  await page.goto('/inbox?queue=all&contactId=contact-003&sort=recent');

  await expect(page.getByRole('button', { name: 'Ignore Person' })).toBeVisible();
  await page.getByRole('button', { name: 'Ignore Person' }).click();

  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('textbox', { name: 'Reason' }).fill('E2E ignore coverage');
  const ignoreResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/contacts/contact-003/ignore') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Ignore Forever' }).click();
  const ignoreResponse = await ignoreResponsePromise;
  expect(ignoreResponse.ok()).toBeTruthy();

  await expect(page.getByLabel('Conversation list').getByRole('link', { name: /Contact 3/i })).toHaveCount(0);

  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByLabel('Ignored people list')).toContainText('linkedin-profile-3');
  await expect(page.getByLabel('Ignored people list')).toContainText('E2E ignore coverage');

  const restoreResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/suppressions/') && response.url().includes('/restore') && response.request().method() === 'POST'
  );
  await page
    .getByLabel('Ignored people list')
    .locator('article', { hasText: 'linkedin-profile-3' })
    .getByRole('button', { name: /Restore|Restoring\.\.\./ })
    .click();
  const restoreResponse = await restoreResponsePromise;
  expect(restoreResponse.ok()).toBeTruthy();
  await expect(
    page.getByLabel('Ignored people list').locator('article', { hasText: 'linkedin-profile-3' })
  ).toHaveCount(0);

  await page.goto('/');
  await expect(page.getByRole('link', { name: /Contact 3/i }).first()).toBeVisible();
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
  await assignStakeholdersSection.getByRole('checkbox', { name: /^Assign Contact 3$/ }).first().click();
  const assignResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/accounts/account-001/contacts') && response.request().method() === 'POST'
  );
  await assignStakeholdersSection.getByRole('button', { name: 'Assign selected' }).click();
  const assignResponse = await assignResponsePromise;
  expect(assignResponse.ok()).toBeTruthy();

  await expect(page.getByLabel('Stakeholders').getByText('Contact 3').first()).toBeVisible();

  await mergeAccountsSection.scrollIntoViewIfNeeded();
  await mergeAccountsSection.getByLabel('Source account').selectOption('account-002');
  await expect(mergeAccountsSection.getByRole('button', { name: 'Merge into current account' })).toBeEnabled();
  const mergeResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/accounts/merge') && response.request().method() === 'POST'
  );
  await mergeAccountsSection.getByRole('button', { name: 'Merge into current account' }).click();
  const mergeResponse = await mergeResponsePromise;
  expect(mergeResponse.ok()).toBeTruthy();

  await expect(page.getByRole('heading', { name: 'Company 1' })).toBeVisible();
  await expect(page.getByText('9 stakeholders').first()).toBeVisible();
  await expect(page.getByText('Company 2 Inc')).toBeVisible();
  await expect(page.getByText('Contact 3')).toBeVisible();
});