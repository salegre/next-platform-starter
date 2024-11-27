// app/api/rankings/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Ranking } from 'models/Ranking';
import connectMongoDB from 'utils/mongodb-connection';
import { getTokenData } from 'utils/auth';

// Add this type
type RouteSegment = {
  params: { id: string }
};

// Update function signature
export async function GET(
  request: NextRequest,
  segment: RouteSegment
) {
  try {
    await connectMongoDB();
    const userData = await getTokenData(request);
    if (!userData) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const ranking = await Ranking.findOne({ 
      _id: segment.params.id,
      user: userData.id 
    });

    if (!ranking) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(ranking);
  } catch (error) {
    return Response.json({ error: 'Failed to fetch ranking' }, { status: 500 });
  }
}