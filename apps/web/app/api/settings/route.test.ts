import { describe, expect, it, vi } from 'vitest';

const listSettings = vi.fn();
const updateSettings = vi.fn();

vi.mock('@/lib/services/settings-service', () => ({
  listSettings,
  updateSettings,
  toErrorResponse: (error: Error) => ({
    error: { message: error.message },
    status: 500
  })
}));

describe('/api/settings', () => {
  it('returns settings', async () => {
    listSettings.mockResolvedValueOnce([{ key: 'followup_days', value: '7', isSecret: false }]);

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.settings).toHaveLength(1);
  });

  it('updates settings', async () => {
    updateSettings.mockResolvedValueOnce([{ key: 'followup_days', value: '10', isSecret: false }]);

    const { PUT } = await import('./route');
    const response = await PUT(
      new Request('http://localhost/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          values: [{ key: 'followup_days', value: '10', isSecret: false }]
        })
      })
    );

    expect(response.status).toBe(200);
    expect(updateSettings).toHaveBeenCalled();
  });
});