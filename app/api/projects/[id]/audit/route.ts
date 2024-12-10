import { NextRequest, NextResponse } from 'next/server';
import { Project } from 'models/Project';
import connectMongoDB from 'utils/mongodb-connection';
import { getTokenData } from 'utils/auth';
import { performSitewideAudit } from 'utils/enhanced-seo-audit';

const AUDIT_TIMEOUT = 25000; // 25 seconds max for entire operation

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUDIT_TIMEOUT);

  try {
    console.log('Starting optimized sitewide SEO audit for project:', params.id);
    
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

    // Perform the audit with abort signal
    const auditResults = await Promise.race([
      performSitewideAudit(project.domain),
      new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new Error('Audit timeout exceeded'));
        });
      })
    ]);

    // Store only essential audit data
    const essentialResults = {
      globalIssues: auditResults.globalIssues.filter(issue => 
        issue.severity === 'error' || 
        (issue.severity === 'warning' && issue.type === 'structure')
      ),
      pageAudits: Object.fromEntries(
        Object.entries(auditResults.pageAudits)
          .map(([url, results]) => [
            url,
            results.filter(result => 
              result.severity === 'error' || 
              (result.severity === 'warning' && result.type === 'meta')
            )
          ])
          .filter(([_, results]) => results.length > 0)
      )
    };

    // Update project with minimal audit data
    project.lastAuditDate = new Date();
    project.auditResults = [
      ...essentialResults.globalIssues,
      ...Object.entries(essentialResults.pageAudits).flatMap(([url, results]) => 
        results.map(result => ({
          ...result,
          url,
          timestamp: new Date()
        }))
      )
    ];
    
    if (auditResults.siteStructure) {
      project.siteStructure = auditResults.siteStructure;
    }
    
    await project.save();

    clearTimeout(timeoutId);
    
    return NextResponse.json({ 
      success: true,
      results: essentialResults,
      siteStructure: auditResults.siteStructure
    });

  } catch (error) {
    clearTimeout(timeoutId);
    
    console.error('Audit error:', error);
    
    // Handle timeout specifically
    if (error.name === 'AbortError' || error.message === 'Audit timeout exceeded') {
      return NextResponse.json({ 
        error: 'Audit timeout - try auditing fewer pages',
        details: 'The audit took too long to complete. Consider reducing the number of pages or depth of crawl.'
      }, { status: 504 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to perform audit',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}