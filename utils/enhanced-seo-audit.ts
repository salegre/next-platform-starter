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

// Serverless-optimized configuration
const CONFIG = {
  TIMEOUT: 5000,         // Reduced timeout
  MAX_RETRIES: 1,        // Minimal retries
  RETRY_DELAY: 200,      // Shorter delay
  BATCH_SIZE: 1,         // Process one at a time
  BATCH_DELAY: 200,      // Minimal delay between batches
  MAX_PAGES: 5,          // Limit pages for initial audit
  MAX_DEPTH: 1           // Limit crawl depth
};

async function fetchWithRetry(url: string, retries = CONFIG.MAX_RETRIES): Promise<any> {
  try {
    return await axios.get(url, {
      timeout: CONFIG.TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOAuditBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      maxRedirects: 2
    });
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
      return fetchWithRetry(url, retries - 1);
    }
    throw error;
  }
}

async function auditPage(page: { url: string }): Promise<AuditResult[]> {
  const pageResults: AuditResult[] = [];
  let dom: JSDOM | null = null;
  
  try {
    console.log(`Auditing page: ${page.url}`);
    const response = await fetchWithRetry(page.url);
    
    dom = new JSDOM(response.data, {
      url: page.url,
      runScripts: 'outside-only',
      pretendToBeVisual: false,
      resources: 'usable'
    });

    const document = dom.window.document;

    // Essential checks only
    const title = document.querySelector('title')?.textContent;
    if (!title) {
      pageResults.push({
        type: 'meta',
        severity: 'error',
        message: 'Missing title tag',
        url: page.url
      });
    }

    const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content');
    if (!metaDescription) {
      pageResults.push({
        type: 'meta',
        severity: 'warning',
        message: 'Missing meta description',
        url: page.url
      });
    }

    const h1Tags = document.querySelectorAll('h1');
    if (h1Tags.length === 0) {
      pageResults.push({
        type: 'content',
        severity: 'error',
        message: 'Missing H1 tag',
        url: page.url
      });
    }

    return pageResults;
  } catch (error) {
    console.error(`Error auditing ${page.url}:`, error);
    return [{
      type: 'error',
      severity: 'error',
      message: 'Failed to audit page',
      details: error.message,
      url: page.url
    }];
  } finally {
    if (dom) {
      dom.window.close();
    }
  }
}

export async function performSitewideAudit(domain: string): Promise<SitewideAuditResult> {
  console.log('Starting optimized sitewide audit for:', domain);
  
  try {
    // Get minimal site structure
    const siteStructure = await analyzeSiteStructure(domain, CONFIG.MAX_PAGES, CONFIG.MAX_DEPTH);
    const pageAudits: { [url: string]: AuditResult[] } = {};
    const globalIssues: AuditResult[] = [];

    // Basic structure checks
    if (siteStructure.maxDepth > 2) {
      globalIssues.push({
        type: 'structure',
        severity: 'warning',
        message: 'Site structure too deep',
        details: `Maximum depth of ${siteStructure.maxDepth} levels found. Recommended: 2 or fewer levels.`
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
        pageAudits: {},
        globalIssues
      };
    }

    // Process pages sequentially
    for (const page of siteStructure.pages) {
      const results = await auditPage(page);
      pageAudits[page.url] = results;
      
      // Small delay between pages
      if (siteStructure.pages.indexOf(page) < siteStructure.pages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.BATCH_DELAY));
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
    console.error('Sitewide audit failed:', error);
    throw new Error(`Failed to complete sitewide audit: ${error.message}`);
  }
}