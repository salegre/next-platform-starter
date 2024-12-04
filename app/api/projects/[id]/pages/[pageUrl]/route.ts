import { NextRequest, NextResponse } from 'next/server';
import { Project } from 'models/Project';
import connectMongoDB from 'utils/mongodb-connection';
import { getTokenData } from 'utils/auth';

function normalizeUrl(url: string): string {
  try {
    // Decode until no more encoding is present
    let decodedUrl = url;
    while (decodedUrl !== decodeURIComponent(decodedUrl)) {
      decodedUrl = decodeURIComponent(decodedUrl);
    }
    
    // Handle mailto: links
    if (decodedUrl.startsWith('mailto:')) {
      return decodedUrl;
    }

    // Create URL object to normalize the format
    const urlObj = new URL(decodedUrl);
    // Return normalized URL without trailing slash and without hash
    return urlObj.origin + urlObj.pathname.replace(/\/$/, '');
  } catch (e) {
    console.error('Error normalizing URL:', url, e);
    return url;
  }
}

export async function GET(
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

    // Normalize the search URL
    const searchUrl = normalizeUrl(params.pageUrl);
    console.log('Searching for URL:', searchUrl);

    // Find the page in the project's pages array
    const pageDetails = project.pages?.find(page => {
      const normalizedPageUrl = normalizeUrl(page.url);
      console.log('Comparing with:', normalizedPageUrl);
      return normalizedPageUrl === searchUrl;
    });

    if (!pageDetails) {
      const availableUrls = project.pages?.map(p => normalizeUrl(p.url)) || [];
      console.log('Available URLs:', availableUrls);
      return NextResponse.json({ 
        error: 'Page not found',
        searchedUrl: searchUrl,
        availableUrls
      }, { status: 404 });
    }

    // Get audit results specific to this page
    const pageAuditResults = project.auditResults?.filter(result => {
      return normalizeUrl(result.url) === normalizeUrl(pageDetails.url);
    }) || [];

    return NextResponse.json({
      url: pageDetails.url,
      title: pageDetails.title,
      status: pageDetails.status,
      links: pageDetails.links || [],
      level: pageDetails.level,
      parentUrl: pageDetails.parentUrl,
      auditResults: pageAuditResults
    });

  } catch (error) {
    console.error('Error fetching page details:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch page details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}