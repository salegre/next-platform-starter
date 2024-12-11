import { NextRequest, NextResponse } from 'next/server';
import { Project, IAuditResult, ISiteStructure } from 'models/Project';
import connectMongoDB from 'utils/mongodb-connection';
import { getTokenData } from 'utils/auth';
import { performSitewideAudit } from 'utils/enhanced-seo-audit';

const AUDIT_TIMEOUT = 250000; // 25 seconds max for entire operation

interface SitewideAuditResult {
  siteStructure: ISiteStructure;
  pageAudits: {
    [url: string]: IAuditResult[];
  };
  globalIssues: IAuditResult[];
}

interface EssentialResults {
  globalIssues: IAuditResult[];
  pageAudits: {
    [url: string]: IAuditResult[];
  };
}

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

    // Perform the audit with abort signal and proper typing
    const auditResults = await Promise.race([
      performSitewideAudit(project.domain),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new Error('Audit timeout exceeded'));
        });
      })
    ]) as SitewideAuditResult;

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
    
    await project.save();

    clearTimeout(timeoutId);
    
    return NextResponse.json({ 
      success: true,
      results: auditResults,
      siteStructure: auditResults.siteStructure
    });

  } catch (error) {
    clearTimeout(timeoutId);
    
    console.error('Audit error:', error);
    
    // Handle timeout specifically
    if (error instanceof Error && 
        (error.name === 'AbortError' || error.message === 'Audit timeout exceeded')) {
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