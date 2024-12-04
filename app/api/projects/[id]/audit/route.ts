import { NextRequest, NextResponse } from 'next/server';
import { Project } from 'models/Project';
import connectMongoDB from 'utils/mongodb-connection';
import { getTokenData } from 'utils/auth';
import { performSitewideAudit } from 'utils/enhanced-seo-audit';
import { auditSinglePage } from 'utils/page-audit';

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

    if (!project.domain) {
      return NextResponse.json({ 
        error: 'Invalid project configuration',
        details: 'Project domain is missing'
      }, { status: 400 });
    }

    console.log('Starting structure analysis for domain:', project.domain);

    try {
      // First perform structure analysis
      const siteStructure = await performSitewideAudit(project.domain);

      if (!siteStructure || !siteStructure.siteStructure) {
        throw new Error('Site structure analysis failed');
      }

      // Store base structure
      project.siteStructure = {
        totalPages: siteStructure.siteStructure.totalPages,
        maxDepth: siteStructure.siteStructure.maxDepth,
        internalLinks: siteStructure.siteStructure.internalLinks,
        externalLinks: siteStructure.siteStructure.externalLinks
      };

      // Clear previous audit results
      project.auditResults = [];
      project.pages = [];

      console.log('Starting individual page audits');
      const pageUrls = Object.keys(siteStructure.pageAudits);
      
      // Store pages and perform individual audits
      for (const url of pageUrls) {
        console.log(`Auditing page: ${url}`);
        try {
          const pageAuditResults = await auditSinglePage(url);
          
          if (!Array.isArray(pageAuditResults)) {
            throw new Error('Invalid audit results format');
          }

          // Create properly formatted audit results
          const formattedPageAuditResults = pageAuditResults.map(result => ({
            type: result.type,
            severity: result.severity,
            message: result.message,
            details: result.details || undefined,
            url: url,
            timestamp: new Date()
          }));

          // Add audit results to project's overall results
          project.auditResults.push(...formattedPageAuditResults);

          // Create page object with audit results
          project.pages.push({
            url,
            title: '', // This will be updated when we implement page content analysis
            links: [], // This will be updated when we implement link analysis
            level: 0,  // This will be updated when we implement structure analysis
            auditResults: pageAuditResults.map(result => ({
              type: result.type,
              severity: result.severity,
              message: result.message,
              details: result.details || undefined
            }))
          });

        } catch (error) {
          console.error(`Error auditing page ${url}:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          // Add error result for the failed page
          const errorResult = {
            type: 'error',
            severity: 'error',
            message: 'Failed to audit page',
            details: errorMessage,
            url: url,
            timestamp: new Date()
          };

          project.auditResults.push(errorResult);
          project.pages.push({
            url,
            title: '',
            links: [],
            level: 0,
            auditResults: [{
              type: 'error',
              severity: 'error',
              message: 'Failed to audit page',
              details: errorMessage
            }]
          });
        }
      }

      project.lastAuditDate = new Date();
      
      // Mark modified arrays
      project.markModified('auditResults');
      project.markModified('pages');
      project.markModified('siteStructure');

      // Save with validation
      await project.save({ validateBeforeSave: true });

      console.log('Audit completed successfully');
      return NextResponse.json({ 
        success: true,
        siteStructure: project.siteStructure,
        pages: project.pages,
        auditResults: project.auditResults
      });

    } catch (structureError) {
      console.error('Structure analysis error:', structureError);
      return NextResponse.json({ 
        error: 'Failed to analyze site structure',
        details: structureError instanceof Error ? structureError.message : 'Unknown error in structure analysis'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Audit error:', error);
    return NextResponse.json({ 
      error: 'Failed to perform audit',
      details: error instanceof Error ? error.message : 'Unknown error in audit process',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}