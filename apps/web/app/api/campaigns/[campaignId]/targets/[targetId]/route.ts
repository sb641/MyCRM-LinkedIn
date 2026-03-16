import { NextResponse } from 'next/server';
import { ValidationError, toErrorResponse } from '@mycrm/core';
import { removeCampaignTarget } from '@/lib/services/campaigns-service';

type RouteContext = {
  params: Promise<{
    campaignId: string;
    targetId: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { campaignId, targetId } = await context.params;

    if (!campaignId) {
      throw new ValidationError('campaignId is required');
    }

    if (!targetId) {
      throw new ValidationError('targetId is required');
    }

    const campaign = await removeCampaignTarget(campaignId, targetId);
    return NextResponse.json(campaign);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}