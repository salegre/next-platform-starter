import { analyzeSiteStructure } from './site-crawler';
import axios, { AxiosError } from 'axios';
import { JSDOM } from 'jsdom';

interface AuditResult {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: string;
  url?: string;
}

interface SitewideAuditResult {
  siteStructure: {
    totalPages: number;
    maxDepth: number;
    internalLinks: number;
    externalLinks: number;
  };
  pageAudits: {
    [url: string]: AuditResult[];
  };
  globalIssues: AuditResult[];
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
      throw new Error(`Network error for URL ${url}: ${error.message}`);
    }
    throw error;
  }
}

function validateDomain(domain: string): string {
  if (!domain) {
    throw new Error('Domain is required');
  }

  try {
    const url = new URL(domain.startsWith('http') ? domain : `https://${domain}`);
    return url.toString().replace(/\/$/, '');
  } catch (error) {
    throw new Error('Invalid domain format');
  }
}

export async function performSitewideAudit(domain: string): Promise<SitewideAuditResult> {
  console.log('Starting sitewide audit for domain:', domain);
  
  const validatedDomain = validateDomain(domain);
  const pageAudits: { [url: string]: AuditResult[] } = {};
  const globalIssues: AuditResult[] = [];

  try {
    console.log('Analyzing site structure...');
    const siteStructure = await analyzeSiteStructure(validatedDomain, 20, 3);

    if (!siteStructure || !siteStructure.pages) {
      throw new Error('Failed to analyze site structure');
    }

    // Check global site structure
    if (siteStructure.maxDepth > 4) {
      globalIssues.push({
        type: 'structure',
        severity: 'warning',
        message: 'Site structure too deep',
        details: `Maximum depth of ${siteStructure.maxDepth} levels found. Recommended: 4 or fewer levels.`
      });
    }

    if (siteStructure.totalPages === 0) {
      globalIssues.push({
        type: 'structure',
        severity: 'error',
        message: 'No pages accessible',
        details: 'The crawler was unable to access any pages. Check site availability and robots.txt settings.'
      });
      
      return {
        siteStructure: {
          totalPages: 0,
          maxDepth: 0,
          internalLinks: 0,
          externalLinks: 0
        },
        pageAudits,
        globalIssues
      };
    }

    // Audit each page with proper error handling
    console.log(`Auditing ${siteStructure.pages.length} pages...`);
    for (const page of siteStructure.pages) {
      try {
        console.log(`Auditing page: ${page.url}`);
        const response = await fetchWithTimeout(page.url);
        const dom = new JSDOM(response.data);
        const document = dom.window.document;
        const pageResults: AuditResult[] = [];

        // Title checks
        const title = document.querySelector('title')?.textContent;
        if (!title) {
          pageResults.push({
            type: 'meta',
            severity: 'error',
            message: 'Missing title tag',
            url: page.url
          });
        } else if (title.length < 10 || title.length > 60) {
          pageResults.push({
            type: 'meta',
            severity: 'warning',
            message: 'Non-optimal title length',
            details: `Length: ${title.length} chars. Recommended: 10-60 chars.`,
            url: page.url
          });
        }

        // Meta description
        const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content');
        if (!metaDescription) {
          pageResults.push({
            type: 'meta',
            severity: 'warning',
            message: 'Missing meta description',
            url: page.url
          });
        } else if (metaDescription.length > 160) {
          pageResults.push({
            type: 'meta',
            severity: 'warning',
            message: 'Meta description too long',
            details: `Length: ${metaDescription.length} chars. Recommended: ≤160 chars.`,
            url: page.url
          });
        }

        // Heading structure
        const h1Tags = document.querySelectorAll('h1');
        if (h1Tags.length === 0) {
          pageResults.push({
            type: 'content',
            severity: 'error',
            message: 'Missing H1 tag',
            url: page.url
          });
        } else if (h1Tags.length > 1) {
          pageResults.push({
            type: 'content',
            severity: 'warning',
            message: 'Multiple H1 tags',
            details: `Found ${h1Tags.length} H1 tags`,
            url: page.url
          });
        }

        // Image optimization
        const images = document.querySelectorAll('img');
        const imagesWithoutAlt = Array.from(images).filter(img => !img.hasAttribute('alt'));
        if (imagesWithoutAlt.length > 0) {
          pageResults.push({
            type: 'content',
            severity: 'warning',
            message: 'Images missing alt text',
            details: `${imagesWithoutAlt.length} images found without alt attributes`,
            url: page.url
          });
        }

        pageAudits[page.url] = pageResults;
      } catch (error) {
        console.error(`Error auditing ${page.url}:`, error);
        pageAudits[page.url] = [{
          type: 'error',
          severity: 'error',
          message: 'Failed to audit page',
          details: error instanceof Error ? error.message : 'Unknown error',
          url: page.url
        }];
      }
    }

    return {
      siteStructure: {
        totalPages: siteStructure.totalPages,
        maxDepth: siteStructure.maxDepth,
        internalLinks: siteStructure.internalLinks,
        externalLinks: siteStructure.externalLinks
      },
      pageAudits,
      globalIssues
    };

  } catch (error) {
    console.error('Sitewide audit error:', error);
    globalIssues.push({
      type: 'error',
      severity: 'error',
      message: 'Failed to complete sitewide audit',
      details: error instanceof Error ? error.message : 'Unknown error'
    });

    return {
      siteStructure: {
        totalPages: 0,
        maxDepth: 0,
        internalLinks: 0,
        externalLinks: 0
      },
      pageAudits,
      globalIssues
    };
  }
}