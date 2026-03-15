import { describe, expect, it, vi } from 'vitest';

const updateReminder = vi.fn();

vi.mock('@/lib/services/reminders-service', () => ({
  updateReminder
}));

describe('reminder detail route', () => {
  it('updates a reminder', async () => {
    updateReminder.mockResolvedValueOnce({ id: 'reminder-001', status: 'completed' });
    const { PATCH } = await import('./route');

    const response = await PATCH(
      new Request('http://localhost/api/reminders/reminder-001', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed', completedAt: Date.now() }),
        headers: { 'Content-Type': 'application/json' }
      }),
      { params: Promise.resolve({ reminderId: 'reminder-001' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reminder.status).toBe('completed');
  });
});