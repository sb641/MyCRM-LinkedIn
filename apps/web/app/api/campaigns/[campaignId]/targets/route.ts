import { NextResponse } from 'next/server';
import { ValidationError, toErrorResponse } from '@mycrm/core';
import { addCampaignTargets } from '@/lib/services/campaigns-service';

type RouteContext = {
  params: Promise<{
    campaignId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { campaignId } = await context.params;

    if (!campaignId) {
      throw new ValidationError('campaignId is required');
    }

    const campaign = await addCampaignTargets(campaignId, await request.json());
    return NextResponse.json(campaign);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}