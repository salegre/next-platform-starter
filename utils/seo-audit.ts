import axios from 'axios';
import { JSDOM } from 'jsdom';

interface AuditResult {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: string;
}

export async function performSEOAudit(domain: string): Promise<AuditResult[]> {
  const auditResults: AuditResult[] = [];
  
  try {
    // Ensure domain has protocol
    const url = domain.startsWith('http') ? domain : `https://${domain}`;
    console.log('Attempting to fetch:', url);

    // Add timeout and headers to avoid some common issues
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOAuditBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      validateStatus: (status) => status < 500 // Accept all status codes less than 500
    });

    console.log('Response received, status:', response.status);
    
    // Handle non-200 responses
    if (response.status !== 200) {
      return [{
        type: 'meta',
        severity: 'error',
        message: `Site returned status code: ${response.status}`,
        details: 'Unable to perform complete audit due to site access issues.'
      }];
    }

    const html = response.data;
    if (!html) {
      throw new Error('Empty response received from server');
    }

    // Create DOM with lenient parsing
    const dom = new JSDOM(html, {
      includeNodeLocations: true,
      pretendToBeVisual: true,
    });

    const document = dom.window.document;

    // Basic site accessibility check
    auditResults.push({
      type: 'meta',
      severity: 'info',
      message: 'Site is accessible',
      details: `Successfully connected to ${url}`
    });

    // Title checks
    const title = document.querySelector('title')?.textContent;
    if (!title) {
      auditResults.push({
        type: 'meta',
        severity: 'error',
        message: 'Missing title tag'
      });
    } else {
      if (title.length < 10) {
        auditResults.push({
          type: 'meta',
          severity: 'warning',
          message: 'Title too short',
          details: `Current length: ${title.length} characters. Recommended minimum: 10 characters.`
        });
      } else if (title.length > 60) {
        auditResults.push({
          type: 'meta',
          severity: 'warning',
          message: 'Title too long',
          details: `Current length: ${title.length} characters. Recommended maximum: 60 characters.`
        });
      } else {
        auditResults.push({
          type: 'meta',
          severity: 'info',
          message: 'Title length is optimal',
          details: `Current length: ${title.length} characters`
        });
      }
    }

    // Meta description checks
    const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content');
    if (!metaDescription) {
      auditResults.push({
        type: 'meta',
        severity: 'warning',
        message: 'Missing meta description'
      });
    } else {
      if (metaDescription.length > 160) {
        auditResults.push({
          type: 'meta',
          severity: 'warning',
          message: 'Meta description too long',
          details: `Current length: ${metaDescription.length} characters. Recommended maximum: 160 characters.`
        });
      } else {
        auditResults.push({
          type: 'meta',
          severity: 'info',
          message: 'Meta description length is optimal',
          details: `Current length: ${metaDescription.length} characters`
        });
      }
    }

    // Heading structure checks
    const h1Tags = document.querySelectorAll('h1');
    if (h1Tags.length === 0) {
      auditResults.push({
        type: 'content',
        severity: 'error',
        message: 'Missing H1 tag'
      });
    } else if (h1Tags.length > 1) {
      auditResults.push({
        type: 'content',
        severity: 'warning',
        message: 'Multiple H1 tags detected',
        details: `Found ${h1Tags.length} H1 tags. Recommended: 1 H1 tag per page.`
      });
    } else {
      auditResults.push({
        type: 'content',
        severity: 'info',
        message: 'H1 tag structure is correct',
        details: 'Page has exactly one H1 tag'
      });
    }

    // Mobile viewport check
    const viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      auditResults.push({
        type: 'meta',
        severity: 'error',
        message: 'Missing viewport meta tag',
        details: 'Viewport meta tag is required for mobile responsiveness.'
      });
    } else {
      auditResults.push({
        type: 'meta',
        severity: 'info',
        message: 'Viewport meta tag present',
        details: `Viewport configuration: ${viewport.getAttribute('content')}`
      });
    }

    return auditResults;

  } catch (error) {
    console.error('SEO Audit Error:', {
      message: error.message,
      stack: error.stack,
      domain,
      errorResponse: error.response?.data
    });

    // Return a user-friendly error result
    return [{
      type: 'meta',
      severity: 'error',
      message: 'Failed to complete SEO audit',
      details: `Error: ${error.message}. This might be due to the site being unavailable or blocking our requests.`
    }];
  }
}