import { describe, expect, it, vi } from 'vitest';

const createNodeDb = vi.fn();
const restoreSuppression = vi.fn();

vi.mock('@mycrm/db/server', () => ({
  createNodeDb,
  createMutationRepository: vi.fn(() => ({
    restoreSuppression
  }))
}));

describe('POST /api/suppressions/[suppressionId]/restore', () => {
  it('restores a suppression and returns success', async () => {
    createNodeDb.mockResolvedValueOnce({ db: {}, sqlite: {} });
    restoreSuppression.mockResolvedValueOnce(1);

    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/suppressions/suppression-001/restore', {
        method: 'POST'
      }),
      { params: { suppressionId: 'suppression-001' } }
    );

    expect(response.status).toBe(200);
    expect(restoreSuppression).toHaveBeenCalledWith('suppression-001');
    expect(await response.json()).toEqual({ success: true });
  });
});