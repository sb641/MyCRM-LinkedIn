import { describe, expect, it, vi } from 'vitest';

const createNodeDb = vi.fn();
const listSyncSuppressions = vi.fn();

vi.mock('@mycrm/db/server', () => ({
  createNodeDb,
  createMutationRepository: vi.fn(() => ({
    listSyncSuppressions
  }))
}));

describe('GET /api/suppressions', () => {
  it('returns active suppressions', async () => {
    createNodeDb.mockResolvedValueOnce({ db: {}, sqlite: {} });
    listSyncSuppressions.mockResolvedValueOnce([
      {
        id: 'suppression-001',
        contactId: 'contact-001',
        linkedinProfileId: 'linkedin-profile-001',
        reason: 'not a fit',
        createdAt: 1,
        deletedAt: null
      }
    ]);

    const { GET } = await import('./route');
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        id: 'suppression-001',
        contactId: 'contact-001',
        linkedinProfileId: 'linkedin-profile-001',
        reason: 'not a fit',
        createdAt: 1,
        deletedAt: null
      }
    ]);
  });
});