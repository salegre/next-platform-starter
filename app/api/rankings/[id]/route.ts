// app/api/rankings/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Ranking } from 'models/Ranking';
import connectMongoDB from 'utils/mongodb-connection';
import { getTokenData } from 'utils/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectMongoDB();
    const userData = await getTokenData(request);
    if (!userData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ranking = await Ranking.findOne({ 
      _id: params.id,
      user: userData.id 
    });

    if (!ranking) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(ranking);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch ranking' }, { status: 500 });
  }
}