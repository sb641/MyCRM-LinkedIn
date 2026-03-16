import { describe, expect, it, vi } from 'vitest';

const getCampaignDetails = vi.fn();
const updateCampaign = vi.fn();

vi.mock('@/lib/services/campaigns-service', () => ({
  getCampaignDetails,
  updateCampaign
}));

describe('campaign detail route', () => {
  it('returns campaign details', async () => {
    getCampaignDetails.mockResolvedValueOnce({ campaign: { id: 'campaign-001' }, targets: [] });
    const { GET } = await import('./route');

    const response = await GET(new Request('http://localhost/api/campaigns/campaign-001'), {
      params: Promise.resolve({ campaignId: 'campaign-001' })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.campaign.id).toBe('campaign-001');
  });

  it('updates a campaign', async () => {
    updateCampaign.mockResolvedValueOnce({ campaign: { id: 'campaign-001', status: 'active' }, targets: [] });
    const { PATCH } = await import('./route');

    const response = await PATCH(
      new Request('http://localhost/api/campaigns/campaign-001', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'active' }),
        headers: { 'Content-Type': 'application/json' }
      }),
      { params: Promise.resolve({ campaignId: 'campaign-001' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.campaign.status).toBe('active');
  });
});