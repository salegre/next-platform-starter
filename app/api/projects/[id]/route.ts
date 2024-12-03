// app/api/projects/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Project } from 'models/Project';
import { Ranking } from 'models/Ranking';
import connectMongoDB from 'utils/mongodb-connection';
import { getTokenData } from 'utils/auth';

type RouteSegment = {
  params: { id: string }
};

export async function GET(
  request: NextRequest,
  segment: RouteSegment
) {
  try {
    await connectMongoDB();
    const userData = await getTokenData(request);
    if (!userData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const project = await Project.findOne({ 
      _id: segment.params.id,
      user: userData.id 
    });

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Get rankings for this project
    const rankings = await Ranking.find({ project: project._id });

    return NextResponse.json({ project, rankings });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}
