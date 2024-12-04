import { NextRequest, NextResponse } from 'next/server';
import { Project } from 'models/Project';
import connectMongoDB from 'utils/mongodb-connection';
import { getTokenData } from 'utils/auth';
import { analyzeSiteStructure } from 'utils/site-crawler';

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

    // Analyze site structure
    const structureData = await analyzeSiteStructure(project.domain);
    
    // Update project with both structure and pages
    project.siteStructure = {
      totalPages: structureData.totalPages,
      maxDepth: structureData.maxDepth,
      internalLinks: structureData.internalLinks,
      externalLinks: structureData.externalLinks
    };
    
    // Save pages data
    project.pages = structureData.pages;
    
    await project.save();

    return NextResponse.json({ 
      success: true,
      structure: project.siteStructure,
      pages: project.pages
    });
  } catch (error) {
    console.error('Structure analysis error:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze site structure',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(
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

    return NextResponse.json({ 
      structure: project.siteStructure,
      pages: project.pages
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch site structure' }, { status: 500 });
  }
}