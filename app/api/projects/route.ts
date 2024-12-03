// app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Project } from 'models/Project';
import connectMongoDB from 'utils/mongodb-connection';
import { getTokenData } from 'utils/auth';
import { sanitizeString } from 'utils/sanitize';

export async function POST(request: NextRequest) {
  try {
    await connectMongoDB();
    const userData = await getTokenData(request);
    if (!userData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, domain, description } = await request.json();
    
    // Validate required fields
    if (!name || !domain) {
      return NextResponse.json({ 
        error: 'Name and domain are required' 
      }, { status: 400 });
    }

    // Sanitize input
    const sanitizedData = {
      name: sanitizeString(name),
      domain: sanitizeString(domain.toLowerCase()),
      description: description ? sanitizeString(description) : undefined
    };

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
    if (!domainRegex.test(sanitizedData.domain)) {
      return NextResponse.json({ 
        error: 'Invalid domain format' 
      }, { status: 400 });
    }

    // Create project
    const project = new Project({
      user: userData.id,
      ...sanitizedData
    });

    await project.save();
    return NextResponse.json(project, { status: 201 });

  } catch (error) {
    console.error('Project creation error:', error);
    return NextResponse.json({ 
      error: 'Failed to create project',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectMongoDB();
    const userData = await getTokenData(request);
    if (!userData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const projects = await Project.find({ user: userData.id })
      .sort({ createdAt: -1 })
      .select('name domain description createdAt lastAuditDate'); // Only select needed fields

    return NextResponse.json(projects.map(project => ({
      ...project.toObject(),
      name: sanitizeString(project.name),
      domain: sanitizeString(project.domain),
      description: project.description ? sanitizeString(project.description) : undefined
    })));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}