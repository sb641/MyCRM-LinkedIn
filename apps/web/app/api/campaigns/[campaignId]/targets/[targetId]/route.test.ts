import { describe, expect, it, vi } from 'vitest';

const removeCampaignTarget = vi.fn();

vi.mock('@/lib/services/campaigns-service', () => ({
  removeCampaignTarget
}));

describe('campaign target detail route', () => {
  it('removes a campaign target', async () => {
    removeCampaignTarget.mockResolvedValueOnce({ campaign: { id: 'campaign-001' }, targets: [] });
    const { DELETE } = await import('./route');

    const response = await DELETE(new Request('http://localhost/api/campaigns/campaign-001/targets/target-001'), {
      params: Promise.resolve({ campaignId: 'campaign-001', targetId: 'target-001' })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.targets).toHaveLength(0);
  });
});