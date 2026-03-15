import { describe, expect, it, vi } from 'vitest';

const createReminder = vi.fn();
const listReminders = vi.fn();

vi.mock('@/lib/services/reminders-service', () => ({
  createReminder,
  listReminders
}));

describe('reminders collection route', () => {
  it('returns reminders', async () => {
    listReminders.mockResolvedValueOnce([{ id: 'reminder-001' }]);
    const { GET } = await import('./route');

    const response = await GET(new Request('http://localhost/api/reminders?entityType=contact&entityId=contact-001'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ reminders: [{ id: 'reminder-001' }] });
  });

  it('creates a reminder', async () => {
    createReminder.mockResolvedValueOnce({ id: 'reminder-001' });
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/reminders', {
        method: 'POST',
        body: JSON.stringify({ entityType: 'contact', entityId: 'contact-001', dueAt: Date.now() }),
        headers: { 'Content-Type': 'application/json' }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.reminder.id).toBe('reminder-001');
  });
});