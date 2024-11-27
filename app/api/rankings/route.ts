// app/api/rankings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Ranking } from 'models/Ranking';
import connectMongoDB from 'utils/mongodb-connection';
import { getTokenData } from 'utils/auth';

export async function GET(request: NextRequest) {
  try {
    await connectMongoDB();
    
    const userData = await getTokenData(request);
    if (!userData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rankings = await Ranking.find({ user: userData.id }).sort({ createdAt: -1 });
    return NextResponse.json(rankings);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch rankings' }, { status: 500 });
  }
}