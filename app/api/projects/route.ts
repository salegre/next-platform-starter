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

    // Create project with explicit schema structure
    const projectData = {
      user: userData.id,
      ...sanitizedData,
      createdAt: new Date(),
      lastAuditDate: null,
      auditResults: [], // MongoDB will handle the schema validation
      siteStructure: {
        totalPages: 0,
        maxDepth: 0,
        internalLinks: 0,
        externalLinks: 0
      },
      pages: [] // MongoDB will handle the schema validation
    };

    // Create and validate the project
    const project = new Project(projectData);

    // Explicitly validate before saving
    const validationError = project.validateSync();
    if (validationError) {
      console.error('Validation error:', validationError);
      return NextResponse.json({ 
        error: 'Invalid project data',
        details: validationError.message
      }, { status: 400 });
    }

    // Save the project
    const savedProject = await project.save();
    
    // Return only necessary fields
    return NextResponse.json({
      _id: savedProject._id,
      name: savedProject.name,
      domain: savedProject.domain,
      description: savedProject.description,
      createdAt: savedProject.createdAt
    }, { status: 201 });

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
      .select('name domain description createdAt lastAuditDate');

    return NextResponse.json(projects.map(project => ({
      ...project.toObject(),
      name: sanitizeString(project.name),
      domain: sanitizeString(project.domain),
      description: project.description ? sanitizeString(project.description) : undefined
    })));
  } catch (error) {
    console.error('Project fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}