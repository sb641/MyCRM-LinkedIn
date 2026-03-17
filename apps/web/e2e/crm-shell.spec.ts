import { expect, test } from '@playwright/test';
import { createNodeDb } from '../../../packages/db/src/server/node-sqlite';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';

const workspaceRoot = path.resolve(__dirname, '../../..');
const e2eDatabasePath = path.join(workspaceRoot, '.e2e', 'playwright.sqlite');
const e2eDatabaseUrl = `file:${e2eDatabasePath.replace(/\\/g, '/')}`;
const normalizedE2eDatabasePath = e2eDatabasePath.replace(/\\/g, '/');
let workerProcess: ChildProcess | null = null;

async function resetJobState() {
  const { sqlite } = await createNodeDb(e2eDatabaseUrl);

  try {
    await sqlite.exec("DELETE FROM audit_log WHERE entity_type = 'job'");
    await sqlite.exec('DELETE FROM jobs');
    await sqlite.exec('DELETE FROM sync_runs');
  } finally {
    await sqlite.close();
  }
}

async function readJobAuditSnapshot() {
  const { sqlite } = await createNodeDb(e2eDatabaseUrl);

  try {
    const jobs = await sqlite.all<{
      id: string;
      status: string;
      createdAt: number;
      updatedAt: number;
    }>(`
      SELECT id, status, created_at AS createdAt, updated_at AS updatedAt
      FROM jobs
      ORDER BY created_at DESC
    `);
    const audit = await sqlite.all<{
      entityId: string;
      action: string;
      createdAt: number;
    }>(`
      SELECT entity_id AS entityId, action, created_at AS createdAt
      FROM audit_log
      WHERE entity_type = 'job'
      ORDER BY created_at DESC
      LIMIT 20
    `);

    return { jobs, audit };
  } finally {
    await sqlite.close();
  }
}

async function readJobById(jobId: string) {
  const { sqlite } = await createNodeDb(e2eDatabaseUrl);

  try {
    const [job] = await sqlite.all<{
      id: string;
      status: string;
      createdAt: number;
      updatedAt: number;
    }>(`
      SELECT id, status, created_at AS createdAt, updated_at AS updatedAt
      FROM jobs
      WHERE id = '${jobId.replace(/'/g, "''")}'
      LIMIT 1
    `);

    return job ?? null;
  } finally {
    await sqlite.close();
  }
}

async function startE2eWorker() {
  if (workerProcess && !workerProcess.killed) {
    return;
  }

  workerProcess = spawn(
    'cmd',
    ['/c', 'pnpm', '--filter', '@mycrm/worker', 'dev'],
    {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        DATABASE_URL: e2eDatabaseUrl,
        ENABLE_AI: 'false',
        ENABLE_AUTOMATION: 'false',
        ENABLE_REAL_BROWSER_SYNC: 'false',
        ENABLE_REAL_SEND: 'false',
        LOG_LEVEL: 'info'
      },
      stdio: 'ignore'
    }
  );

  await new Promise((resolve) => setTimeout(resolve, 2000));
}

async function stopE2eWorker() {
  if (!workerProcess) {
    return;
  }

  workerProcess.kill();
  workerProcess = null;
  await new Promise((resolve) => setTimeout(resolve, 500));
}

test.beforeEach(async () => {
  await startE2eWorker();
});

test.afterEach(async () => {
  await stopE2eWorker();
});

test.describe.configure({ mode: 'serial' });

test('loads the CRM shell smoke flow', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/inbox/);
  await expect(page.getByRole('heading', { name: 'Operator workspace' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'People' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Conversation and drafts' })).toBeVisible();
  await expect(page.getByLabel('Top bar actions')).toBeVisible();
  await expect(page.getByLabel('Sync history')).toBeAttached();
  await expect(
    page.getByLabel('Top bar actions').getByRole('button', { name: 'Sync Conversations' })
  ).toBeVisible();
});

test('saves settings and exports a backup snapshot', async ({ page }) => {
  await page.goto('/');

  const adminTools = page.getByLabel('Workspace admin tools');
  const saveSettingsResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/settings') && response.request().method() === 'PUT'
  );
  await adminTools.getByRole('button', { name: 'Save settings' }).click();
  const saveSettingsResponse = await saveSettingsResponsePromise;
  expect(saveSettingsResponse.ok()).toBeTruthy();

  await expect(page.getByText(/Saved \d+ settings/)).toBeVisible();

  await adminTools.getByRole('button', { name: 'Export backup' }).click();

  await expect(page.getByText('Backup exported without secrets')).toBeVisible();
  await adminTools.getByText('Restore workspace data').click();
  await expect(page.getByRole('textbox', { name: 'Restore/import payload' })).toContainText('"version": 1');
  await expect(page.getByRole('textbox', { name: 'Restore/import payload' })).toContainText('"followup_days"');
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

test('processes People panel sync beyond queued state when worker is running', async ({ page, request }) => {
  await resetJobState();
  await page.goto('/');

  const syncButton = page.getByRole('button', { name: 'Sync Conversations' }).last();
  const enqueueResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/jobs?mode=manual-sync') && response.request().method() === 'POST'
  );

  await page.route('**/api/jobs?mode=manual-sync', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    url.searchParams.set('debugVerify', '1');

    await route.continue({ url: url.toString() });
  });

  await syncButton.click();

  const enqueueResponse = await enqueueResponsePromise;
  expect(enqueueResponse.ok()).toBeTruthy();
  const enqueueBody = (await enqueueResponse.json()) as {
    jobId?: string;
    job?: { id?: string };
    verifiedJob?: { id?: string; status?: string } | null;
    databaseUrl?: string | null;
    resolvedDatabaseUrl?: string | null;
    resolvedDatabasePath?: string | null;
  };
  const enqueuedJobId = enqueueBody.jobId ?? enqueueBody.job?.id;
  expect(enqueuedJobId).toBeTruthy();
  expect(enqueueBody.verifiedJob?.id ?? null).toBe(enqueuedJobId);
  expect(['queued', 'running', 'succeeded']).toContain(enqueueBody.verifiedJob?.status ?? null);
  expect(enqueueBody.resolvedDatabasePath ?? null).toBe(normalizedE2eDatabasePath);
  await expect
    .poll(async () => {
      const job = await readJobById(enqueuedJobId as string);
      return job?.id === enqueuedJobId ? job.status : null;
    }, {
      timeout: 5_000,
      intervals: [250, 500, 1000]
    })
    .toBeTruthy();
  await expect
    .poll(async () => {
      const job = await readJobById(enqueuedJobId as string);
      return job?.status ?? null;
    }, {
      timeout: 5_000,
      intervals: [250, 500, 1000]
    })
    .toBeTruthy();
  expect(['queued', 'running', 'succeeded']).toContain(
    await (async () => {
      const job = await readJobById(enqueuedJobId as string);
      return job?.status ?? null;
    })()
  );
  await expect(page.getByText(/Sync queued for/).last()).toBeVisible();

  await expect
    .poll(
      async () => {
        const response = await request.get('/api/jobs');
        const body = (await response.json()) as {
          jobs: Array<{
            job: {
              id: string;
              type: string;
              status: string;
              lastError: string | null;
            };
          }>;
          syncRuns: Array<{
            provider: string;
            status: string;
            error: string | null;
          }>;
        };
        const dbSnapshot = await readJobAuditSnapshot();

        const trackedImportJob = body.jobs.find((entry) => entry.job.id === enqueuedJobId)?.job;
        const latestSyncRun = body.syncRuns[0] ?? null;
        const trackedDbJob = dbSnapshot.jobs.find((job) => job.id === enqueuedJobId) ?? null;
        const trackedAuditActions = dbSnapshot.audit
          .filter((entry) => entry.entityId === enqueuedJobId)
          .map((entry) => entry.action);

        return {
          trackedImportJobStatus: trackedImportJob?.status ?? null,
          trackedImportJobError: trackedImportJob?.lastError ?? null,
          trackedDbJobStatus: trackedDbJob?.status ?? null,
          trackedAuditActions,
          latestSyncRunStatus: latestSyncRun?.status ?? null,
          latestSyncRunError: latestSyncRun?.error ?? null
        };
      },
      {
        timeout: 10_000,
        intervals: [500, 1000, 1500]
      }
    )
    .toMatchObject({
      trackedImportJobStatus: 'succeeded',
      trackedDbJobStatus: 'succeeded',
      latestSyncRunStatus: 'succeeded'
    });
});

test('generates drafts in bulk for selected inbox people', async ({ page }) => {
  await page.goto('/inbox?queue=all&entity=people&contactId=contact-001&conversationId=conversation-001&sort=recent');
  const conversationList = page.getByLabel('Conversation list');
  const selectConversation = async (label: string) => {
    const toggle = conversationList.getByRole('button', { name: label, exact: true });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  };

  await selectConversation('Select Contact 1');
  await expect(page.getByRole('button', { name: 'Bulk Generate (1)' })).toBeVisible();
  await selectConversation('Select Contact 3');
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

  await page.goto('/inbox?queue=all&entity=people&contactId=contact-003&conversationId=conversation-003&sort=recent');
  await expect(page.getByLabel('Conversation list').getByRole('link', { name: /Contact 3/i }).first()).toBeVisible();
});

test('blocks workspace replace restore until confirmation is provided', async ({ page }) => {
  await page.goto('/inbox?queue=all&entity=people&contactId=contact-001&conversationId=conversation-001&sort=recent');
  await expect(page.getByLabel('Workspace admin tools')).toBeVisible();
  await page.getByText('Restore workspace data', { exact: true }).click();

  await page.getByLabel('Restore/import payload').fill(
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

  await expect(page.getByText('Scope:', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Restore' }).click();

  await expect(page.getByText('Type REPLACE WORKSPACE to confirm workspace replace restore')).toBeVisible();
});

test('assigns and merges accounts in account mode', async ({ page }) => {
  await page.goto('/inbox?entity=accounts&queue=all&accountId=account-001&sort=recent');

  const mergeAccountsSection = page.getByLabel('Merge accounts');
  const sourceAccountSelect = mergeAccountsSection.getByLabel('Source account');

  await expect(page.getByRole('heading', { name: 'Account workspace' })).toBeVisible();
  await mergeAccountsSection.scrollIntoViewIfNeeded();
  await expect(mergeAccountsSection).toBeInViewport();
  await expect(page.getByRole('heading', { name: 'Company 1' })).toBeVisible();
  const mergeSourceAccountId = await sourceAccountSelect.evaluate((element) => {
    const select = element as HTMLSelectElement;
    return Array.from(select.options).find((option) => option.value.trim().length > 0)?.value ?? '';
  });
  expect(mergeSourceAccountId).not.toBe('');
  await sourceAccountSelect.selectOption(mergeSourceAccountId);
  await expect(mergeAccountsSection.getByRole('button', { name: 'Merge into current account' })).toBeEnabled();
  const mergeResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/accounts/merge') && response.request().method() === 'POST'
  );
  await mergeAccountsSection.getByRole('button', { name: 'Merge into current account' }).click();
  const mergeResponse = await mergeResponsePromise;
  expect(mergeResponse.ok()).toBeTruthy();

  await expect(page.getByRole('heading', { name: 'Company 1' })).toBeVisible();
  await expect(page.getByLabel('Account aliases').getByText(/Inc/).first()).toBeVisible();
  await expect(page.getByLabel('Stakeholders', { exact: true }).getByText(/Company [23] ·/).first()).toBeVisible();
  await expect(page.getByLabel('Stakeholders', { exact: true }).getByText('Contact 14')).toBeVisible();
});