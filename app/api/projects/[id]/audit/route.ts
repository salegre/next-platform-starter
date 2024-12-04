import { NextRequest, NextResponse } from 'next/server';
import { Project } from 'models/Project';
import connectMongoDB from 'utils/mongodb-connection';
import { getTokenData } from 'utils/auth';
import { performSEOAudit } from 'utils/seo-audit';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('Starting SEO audit for project:', params.id);
    
    await connectMongoDB();
    const userData = await getTokenData(request);
    
    if (!userData) {
      console.log('Unauthorized audit attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await Project.findOne({ 
      _id: params.id,
      user: userData.id 
    });

    if (!project) {
      console.log('Project not found:', params.id);
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    console.log('Running audit for domain:', project.domain);

    // Perform SEO audit
    const auditResults = await performSEOAudit(project.domain);

    // Even if we get an error result, we save it to the project
    project.lastAuditDate = new Date();
    project.auditResults = auditResults;
    await project.save();

    console.log('Audit completed and saved');

    return NextResponse.json({ 
      success: true,
      auditResults 
    });

  } catch (error) {
    console.error('Audit error:', {
      message: error.message,
      stack: error.stack,
      projectId: params.id
    });

    return NextResponse.json({ 
      error: 'Failed to perform audit',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}