import { describe, expect, it, vi } from 'vitest';

const createCampaign = vi.fn();
const listCampaigns = vi.fn();

vi.mock('@/lib/services/campaigns-service', () => ({
  createCampaign,
  listCampaigns
}));

describe('campaigns collection route', () => {
  it('returns campaigns', async () => {
    listCampaigns.mockResolvedValueOnce([{ id: 'campaign-001' }]);
    const { GET } = await import('./route');

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ campaigns: [{ id: 'campaign-001' }] });
  });

  it('creates a campaign', async () => {
    createCampaign.mockResolvedValueOnce({ campaign: { id: 'campaign-001' }, targets: [] });
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({ name: 'ABM Push', objective: 'Book meetings' }),
        headers: { 'Content-Type': 'application/json' }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.campaign.id).toBe('campaign-001');
  });
});