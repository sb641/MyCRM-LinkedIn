import { describe, expect, it, vi } from 'vitest';

const listJobs = vi.fn();
const enqueueJob = vi.fn();

vi.mock('@/lib/services/jobs-service', () => ({
  listJobs,
  enqueueJob
}));

describe('/api/jobs', () => {
  it('returns jobs', async () => {
    listJobs.mockResolvedValueOnce([
      {
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
      }
    ]);

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.jobs).toHaveLength(1);
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
});