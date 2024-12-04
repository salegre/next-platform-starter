import { analyzeSiteStructure } from './site-crawler';
import axios from 'axios';
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

export async function performSitewideAudit(domain: string): Promise<SitewideAuditResult> {
  const siteStructure = await analyzeSiteStructure(domain);
  const pageAudits: { [url: string]: AuditResult[] } = {};
  const globalIssues: AuditResult[] = [];

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
  }

  // Audit each page
  for (const page of siteStructure.pages) {
    try {
      const response = await axios.get(page.url);
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
        details: error.message,
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
}