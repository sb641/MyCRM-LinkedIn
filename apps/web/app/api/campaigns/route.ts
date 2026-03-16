import { NextResponse } from 'next/server';
import { toErrorResponse } from '@mycrm/core';
import { createCampaign, listCampaigns } from '@/lib/services/campaigns-service';

export async function GET() {
  try {
    const campaigns = await listCampaigns();
    return NextResponse.json({ campaigns });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}

export async function POST(request: Request) {
  try {
    const campaign = await createCampaign(await request.json());
    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.error, { status: response.status });
  }
}