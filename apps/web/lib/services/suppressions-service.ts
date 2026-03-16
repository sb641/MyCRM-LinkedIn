import { CreateSuppressionInput, SuppressionDto } from '@mycrm/core';

const API_BASE = '/api';

export async function listSuppressions(): Promise<SuppressionDto[]> {
  const response = await fetch(`${API_BASE}/suppressions`, {
    method: 'GET'
  });
  if (!response.ok) {
    throw new Error('Failed to load ignored people');
  }

  return (await response.json()) as SuppressionDto[];
}

export async function ignoreContact(contactId: string, input?: Pick<CreateSuppressionInput, 'reason'>) {
  const response = await fetch(`${API_BASE}/contacts/${encodeURIComponent(contactId)}/ignore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: input?.reason ?? '' })
  });

  if (!response.ok) {
    throw new Error('Failed to ignore contact');
  }

  return (await response.json()) as { success: true };
}

export async function restoreSuppression(suppressionId: string) {
  const response = await fetch(`${API_BASE}/suppressions/${encodeURIComponent(suppressionId)}/restore`, {
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error('Failed to restore ignored contact');
  }

  return (await response.json()) as { success: true };
}
