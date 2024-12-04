import axios from 'axios';
import { JSDOM } from 'jsdom';

interface PageAuditResult {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: string;
}

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url: string, timeout = 30000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await axios.get(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SiteAuditBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
      maxRedirects: 5,
      validateStatus: (status) => status < 400
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        throw new Error(`Request timeout for URL: ${url}`);
      }
      if (error.response) {
        throw new Error(`HTTP ${error.response.status} error for URL ${url}`);
      }
      throw new Error(`Network error for URL ${url}: ${error.message}`);
    }
    throw error;
  }
}

export async function auditSinglePage(url: string): Promise<PageAuditResult[]> {
  console.log('Starting audit for page:', url);
  const results: PageAuditResult[] = [];

  // Validate URL
  if (!url) {
    return [{
      type: 'error',
      severity: 'error',
      message: 'URL is required'
    }];
  }

  if (!isValidUrl(url)) {
    return [{
      type: 'error',
      severity: 'error',
      message: 'Invalid URL format'
    }];
  }

  try {
    console.log('Fetching page content...');
    const response = await fetchWithTimeout(url);

    if (!response.data) {
      return [{
        type: 'error',
        severity: 'error',
        message: 'Empty response'
      }];
    }

    console.log('Parsing page content...');
    const dom = new JSDOM(response.data);
    const document = dom.window.document;

    // Title checks
    const title = document.querySelector('title')?.textContent?.trim();
    if (!title) {
      results.push({
        type: 'meta',
        severity: 'error',
        message: 'Missing title tag'
      });
    } else {
      if (title.length < 10) {
        results.push({
          type: 'meta',
          severity: 'warning',
          message: 'Title too short',
          details: `Current length: ${title.length} characters. Recommended minimum: 10 characters.`
        });
      } else if (title.length > 60) {
        results.push({
          type: 'meta',
          severity: 'warning',
          message: 'Title too long',
          details: `Current length: ${title.length} characters. Recommended maximum: 60 characters.`
        });
      } else {
        results.push({
          type: 'meta',
          severity: 'info',
          message: 'Title length is optimal',
          details: `Current length: ${title.length} characters`
        });
      }
    }

    // Meta description
    const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim();
    if (!metaDescription) {
      results.push({
        type: 'meta',
        severity: 'warning',
        message: 'Missing meta description'
      });
    } else {
      if (metaDescription.length > 160) {
        results.push({
          type: 'meta',
          severity: 'warning',
          message: 'Meta description too long',
          details: `Current length: ${metaDescription.length} characters. Recommended maximum: 160 characters.`
        });
      } else {
        results.push({
          type: 'meta',
          severity: 'info',
          message: 'Meta description length is optimal',
          details: `Current length: ${metaDescription.length} characters`
        });
      }
    }

    // Heading structure
    const h1Tags = document.querySelectorAll('h1');
    const h2Tags = document.querySelectorAll('h2');
    const h3Tags = document.querySelectorAll('h3');

    if (h1Tags.length === 0) {
      results.push({
        type: 'content',
        severity: 'error',
        message: 'Missing H1 tag'
      });
    } else if (h1Tags.length > 1) {
      results.push({
        type: 'content',
        severity: 'warning',
        message: 'Multiple H1 tags detected',
        details: `Found ${h1Tags.length} H1 tags. Recommended: 1 H1 tag per page.`
      });
    }

    // Check heading hierarchy
    if (h2Tags.length === 0 && h3Tags.length > 0) {
      results.push({
        type: 'content',
        severity: 'warning',
        message: 'Improper heading hierarchy',
        details: 'H3 tags are present without H2 tags'
      });
    }

    // Image optimization
    const images = document.querySelectorAll('img');
    const imagesWithoutAlt = Array.from(images).filter(img => !img.hasAttribute('alt'));
    if (imagesWithoutAlt.length > 0) {
      results.push({
        type: 'content',
        severity: 'warning',
        message: 'Images missing alt text',
        details: `${imagesWithoutAlt.length} images found without alt attributes`
      });
    }

    // Mobile viewport
    const viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      results.push({
        type: 'meta',
        severity: 'error',
        message: 'Missing viewport meta tag',
        details: 'Viewport meta tag is required for mobile responsiveness'
      });
    }

    // Links
    const links = document.querySelectorAll('a');
    const brokenAnchors = Array.from(links).filter(link => !link.hasAttribute('href'));
    if (brokenAnchors.length > 0) {
      results.push({
        type: 'content',
        severity: 'warning',
        message: 'Empty or invalid links found',
        details: `${brokenAnchors.length} links found without href attributes`
      });
    }

    // Check for canonical URL
    const canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      results.push({
        type: 'meta',
        severity: 'warning',
        message: 'Missing canonical URL'
      });
    }

    // Language specification
    const htmlLang = document.querySelector('html')?.getAttribute('lang');
    if (!htmlLang) {
      results.push({
        type: 'meta',
        severity: 'warning',
        message: 'Language not specified',
        details: 'The HTML lang attribute is missing'
      });
    }

    console.log('Audit completed successfully');
    return results;

  } catch (error) {
    console.error('Audit error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return [{
      type: 'error',
      severity: 'error',
      message: 'Failed to audit page',
      details: errorMessage
    }];
  }
}