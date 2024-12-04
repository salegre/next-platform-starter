import { NextRequest, NextResponse } from 'next/server';
import { Project } from 'models/Project';
import connectMongoDB from 'utils/mongodb-connection';
import { getTokenData } from 'utils/auth';
import { performSitewideAudit } from 'utils/enhanced-seo-audit';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('Starting sitewide SEO audit for project:', params.id);
    
    await connectMongoDB();
    const userData = await getTokenData(request);
    
    if (!userData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await Project.findOne({ 
      _id: params.id,
      user: userData.id 
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const auditResults = await performSitewideAudit(project.domain);

    // Update project with audit results
    project.lastAuditDate = new Date();
    project.auditResults = [
      ...auditResults.globalIssues,
      ...Object.entries(auditResults.pageAudits).flatMap(([url, results]) => 
        results.map(result => ({
          ...result,
          url,
          timestamp: new Date()
        }))
      )
    ];
    project.siteStructure = auditResults.siteStructure;
    
    await project.save();

    return NextResponse.json({ 
      success: true,
      ...auditResults
    });

  } catch (error) {
    console.error('Audit error:', error);
    return NextResponse.json({ 
      error: 'Failed to perform audit',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}