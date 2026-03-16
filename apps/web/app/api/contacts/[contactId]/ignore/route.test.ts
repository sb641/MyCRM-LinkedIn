import { describe, expect, it, vi } from 'vitest';

const createNodeDb = vi.fn();
const ignoreContact = vi.fn();

vi.mock('@mycrm/db/server', () => ({
  createNodeDb,
  createMutationRepository: vi.fn(() => ({
    ignoreContact
  }))
}));

describe('POST /api/contacts/[contactId]/ignore', () => {
  it('ignores a contact and returns success', async () => {
    createNodeDb.mockResolvedValueOnce({ db: {}, sqlite: {} });
    ignoreContact.mockResolvedValueOnce(1);

    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/contacts/contact-001/ignore', {
        method: 'POST',
        body: JSON.stringify({ reason: 'not a fit' })
      }),
      { params: { contactId: 'contact-001' } }
    );

    expect(response.status).toBe(200);
    expect(ignoreContact).toHaveBeenCalledWith('contact-001', 'not a fit', true);
    expect(await response.json()).toEqual({ success: true });
  });
});