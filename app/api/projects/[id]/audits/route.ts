// app/api/projects/[id]/audit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { Project } from 'models/Project';
import connectMongoDB from 'utils/mongodb-connection';
import { getTokenData } from 'utils/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Perform basic SEO audit
    const auditResults = await performSEOAudit(project.domain);

    // Update project with audit results
    project.lastAuditDate = new Date();
    project.auditResults = auditResults;
    await project.save();

    return NextResponse.json({ auditResults });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to perform audit' }, { status: 500 });
  }
}

async function performSEOAudit(domain: string) {
  try {
    const response = await axios.get(`https://${domain}`);
    const html = response.data;
    
    const auditResults = [];

    // Check title
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    if (!titleMatch) {
      auditResults.push({
        type: 'meta',
        severity: 'error',
        message: 'Missing title tag'
      });
    } else if (titleMatch[1].length < 10 || titleMatch[1].length > 60) {
      auditResults.push({
        type: 'meta',
        severity: 'warning',
        message: 'Title length is not optimal',
        details: `Current length: ${titleMatch[1].length} characters. Recommended: 10-60 characters.`
      });
    }

    // Check meta description
    const descriptionMatch = html.match(/<meta\s+name="description"\s+content="(.*?)"/i);
    if (!descriptionMatch) {
      auditResults.push({
        type: 'meta',
        severity: 'warning',
        message: 'Missing meta description'
      });
    }

    // Check H1
    const h1Match = html.match(/<h1>(.*?)<\/h1>/i);
    if (!h1Match) {
      auditResults.push({
        type: 'structure',
        severity: 'error',
        message: 'Missing H1 tag'
      });
    }

    // Add more checks as needed...

    return auditResults;
  } catch (error) {
    throw new Error('Failed to perform SEO audit');
  }
}