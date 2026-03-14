import { describe, expect, it, vi } from 'vitest';

const exportSettings = vi.fn();
const importSettingsSnapshot = vi.fn();

vi.mock('@/lib/services/settings-service', () => ({
  exportSettings,
  importSettingsSnapshot,
  toErrorResponse: (error: Error) => ({
    error: { message: error.message },
    status: 500
  })
}));

describe('/api/backup', () => {
  it('exports backup snapshot', async () => {
    exportSettings.mockResolvedValueOnce({ version: 1, exportedAt: 1, values: [] });

    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/backup?includeSecrets=false'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.version).toBe(1);
  });

  it('exports workspace backup snapshot when requested', async () => {
    exportSettings.mockResolvedValueOnce({
      version: 1,
      scope: 'workspace',
      exportedAt: 1,
      settings: [],
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
    });

    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/backup?includeSecrets=false&scope=workspace'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.scope).toBe('workspace');
    expect(exportSettings).toHaveBeenCalledWith({ includeSecrets: false, scope: 'workspace' });
  });

  it('imports backup snapshot', async () => {
    importSettingsSnapshot.mockResolvedValueOnce([{ key: 'followup_days', value: '7', isSecret: false }]);

    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/backup', {
        method: 'POST',
        body: JSON.stringify({
          version: 1,
          mode: 'merge',
          values: [{ key: 'followup_days', value: '7', isSecret: false }]
        })
      })
    );

    expect(response.status).toBe(201);
    expect(importSettingsSnapshot).toHaveBeenCalled();
  });
});