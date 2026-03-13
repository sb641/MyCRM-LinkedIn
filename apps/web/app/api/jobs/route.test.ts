import { describe, expect, it, vi } from 'vitest';

const listJobsWithAudit = vi.fn();
const enqueueJob = vi.fn();
const enqueueManualBrowserSync = vi.fn();
const listSyncRuns = vi.fn();

vi.mock('@/lib/services/jobs-service', () => ({
  listJobsWithAudit,
  enqueueJob,
  enqueueManualBrowserSync,
  listSyncRuns
}));

describe('/api/jobs', () => {
  it('returns jobs', async () => {
    listJobsWithAudit.mockResolvedValueOnce([
      {
        job: {
          id: 'job-001',
          type: 'generate_draft',
          status: 'queued',
          payload: '{}',
          attemptCount: 0,
          lockedAt: null,
          lastError: null,
          scheduledFor: 1,
          createdAt: 1,
          updatedAt: 1
        },
        auditEntries: [
          {
            id: 'audit-1',
            entityType: 'job',
            entityId: 'job-001',
            action: 'job.enqueued',
            payload: '{"status":"queued"}',
            createdAt: 1
          }
        ]
      }
    ]);
    listSyncRuns.mockResolvedValueOnce([
      {
        id: 'sync-001',
        provider: 'fake-linkedin',
        status: 'completed',
        startedAt: 1,
        finishedAt: 2,
        itemsScanned: 3,
        itemsImported: 2,
        error: null
      }
    ]);

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.jobs).toHaveLength(1);
    expect(body.jobs[0].auditEntries).toHaveLength(1);
    expect(body.syncRuns).toHaveLength(1);
  });

  it('enqueues a job', async () => {
    enqueueJob.mockResolvedValueOnce({ jobId: 'job-generated-1', status: 'queued' });

    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/jobs', {
        method: 'POST',
        body: JSON.stringify({
          type: 'generate_draft',
          payload: { contactId: 'contact-001' }
        })
      })
    );

    expect(response.status).toBe(201);
    expect((await response.json()).status).toBe('queued');
  });

  it('enqueues a manual browser sync job', async () => {
    enqueueManualBrowserSync.mockResolvedValueOnce({ jobId: 'job-generated-2', status: 'queued' });

    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/jobs?mode=manual-sync', {
        method: 'POST',
        body: JSON.stringify({
          accountId: 'browser-account',
          provider: 'linkedin-browser'
        })
      })
    );

    expect(response.status).toBe(201);
    expect(enqueueManualBrowserSync).toHaveBeenCalledWith({
      accountId: 'browser-account',
      provider: 'linkedin-browser'
    });
  });
});