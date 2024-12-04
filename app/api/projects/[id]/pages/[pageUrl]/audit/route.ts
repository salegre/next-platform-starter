import { NextRequest, NextResponse } from 'next/server';
import { Project } from 'models/Project';
import connectMongoDB from 'utils/mongodb-connection';
import { getTokenData } from 'utils/auth';
import { auditSinglePage } from 'utils/page-audit';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string; pageUrl: string } }
  ) {
    try {
      await connectMongoDB();
      const userData = await getTokenData(request);
      if (!userData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
      const project = await Project.findOne({ 
        _id: params.id,
        user: userData.id 
      });
  
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  
      // Find the page in the project's pages array
      const decodedUrl = decodeURIComponent(params.pageUrl);
      const pageIndex = project.pages?.findIndex(page => page.url === decodedUrl);
  
      if (pageIndex === -1 || pageIndex === undefined) {
        return NextResponse.json({ error: 'Page not found' }, { status: 404 });
      }
  
      // Perform the audit
      const auditResults = await auditSinglePage(decodedUrl);
  
      if (!Array.isArray(auditResults)) {
        return NextResponse.json(
          { error: 'Invalid audit results format' },
          { status: 500 }
        );
      }
  
      // Create properly structured audit results
      const timestamp = new Date();
      const pageAuditResults = auditResults.map(result => ({
        type: result.type,
        severity: result.severity,
        message: result.message,
        details: result.details || undefined,
        url: decodedUrl,
        timestamp
      }));
  
      // Update the page's audit results
      if (project.pages) {
        project.pages[pageIndex].auditResults = auditResults.map(result => ({
          type: result.type,
          severity: result.severity,
          message: result.message,
          details: result.details || undefined
        }));
      }
  
      // Remove previous audit results for this page from project's overall results
      if (!project.auditResults) {
        project.auditResults = [];
      } else {
        project.auditResults = project.auditResults.filter(result => !result.url || result.url !== decodedUrl);
      }
  
      // Add new audit results to project's overall results
      project.auditResults.push(...pageAuditResults);
  
      // Mark as modified to ensure Mongoose picks up the changes
      project.markModified('pages');
      project.markModified('auditResults');
      
      // Save with validation
      await project.save({ validateBeforeSave: true });
  
      return NextResponse.json({ 
        success: true,
        auditResults 
      });
  
    } catch (error) {
      console.error('Page audit error:', error);
      return NextResponse.json({ 
        error: 'Failed to audit page',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, { status: 500 });
    }
  }