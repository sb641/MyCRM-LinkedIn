import { describe, expect, it, vi } from 'vitest';

const addCampaignTargets = vi.fn();

vi.mock('@/lib/services/campaigns-service', () => ({
  addCampaignTargets
}));

describe('campaign targets route', () => {
  it('adds campaign targets', async () => {
    addCampaignTargets.mockResolvedValueOnce({ campaign: { id: 'campaign-001' }, targets: [{ id: 'target-001' }] });
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/campaigns/campaign-001/targets', {
        method: 'POST',
        body: JSON.stringify({ contactIds: ['contact-001'] }),
        headers: { 'Content-Type': 'application/json' }
      }),
      { params: Promise.resolve({ campaignId: 'campaign-001' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.targets).toHaveLength(1);
  });
});